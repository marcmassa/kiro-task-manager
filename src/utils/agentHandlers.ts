/**
 * Agent orchestration handlers (FEAT-006).
 *
 * DB-backed functions for agent assignment, human-side lifecycle transitions
 * (approve / request-changes) and attachments. Kept out of server.ts so they
 * can be unit-tested and reused. Agent-side transitions (claim/submit/resume)
 * live in the MCP layer, not here, so the actor is unambiguous.
 *
 * Human transitions use a compare-and-set UPDATE (WHERE state = <expected>) to
 * avoid races with the agent process over the same execution.
 */
import type { Database } from "bun:sqlite";
import { applyTransition, type AgentState } from "./agentLifecycle";
import { validateAttachment } from "./attachmentValidation";
import { attachmentStoragePath, taskUploadDir, UPLOADS_DIR } from "./attachmentPaths";
import path from "path";
import { mkdirSync, rmSync, existsSync } from "fs";

export interface HandlerResult {
  status: number;
  body: unknown;
}

interface ExecutionRow {
  id: number;
  task_id: number;
  agent_id: string;
  state: AgentState;
  agent_summary: string | null;
  review_feedback: string | null;
  created_at: string;
  updated_at: string;
}

// ── Agents ─────────────────────────────────────────────────────────────────

export function listAgents(db: Database): HandlerResult {
  const rows = db
    .query("SELECT id, name, kind, enabled FROM agents WHERE enabled = 1 ORDER BY name")
    .all() as Array<{ id: string; name: string; kind: string; enabled: number }>;
  return {
    status: 200,
    body: rows.map((r) => ({ ...r, enabled: r.enabled === 1 })),
  };
}

// ── Assignment ───────────────────────────────────────────────────────────────

export function assignAgent(db: Database, taskId: number, agentId: string): HandlerResult {
  const task = db.query("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) return { status: 404, body: { error: "Tarea no encontrada" } };

  const agent = db.query("SELECT id, enabled FROM agents WHERE id = ?").get(agentId) as {
    id: string;
    enabled: number;
  } | null;
  if (!agent || agent.enabled !== 1) {
    return { status: 400, body: { error: "Agente inexistente o deshabilitado" } };
  }

  // Upsert the execution: assigning (re)starts the lifecycle at 'assigned'.
  db.prepare(
    `INSERT INTO agent_executions (task_id, agent_id, state)
     VALUES (?, ?, 'assigned')
     ON CONFLICT(task_id) DO UPDATE SET
       agent_id = excluded.agent_id,
       state = 'assigned',
       agent_summary = NULL,
       review_feedback = NULL,
       updated_at = datetime('now')`,
  ).run(taskId, agentId);

  return getExecution(db, taskId);
}

export function getExecution(db: Database, taskId: number): HandlerResult {
  const row = db
    .query("SELECT * FROM agent_executions WHERE task_id = ?")
    .get(taskId) as ExecutionRow | null;
  return { status: 200, body: row ?? null };
}

/** All executions (for the board to render per-card state badges — R21). */
export function listAllExecutions(db: Database): HandlerResult {
  const rows = db.query("SELECT * FROM agent_executions ORDER BY updated_at DESC").all();
  return { status: 200, body: rows };
}

// ── Human transitions (approve / request changes) ───────────────────────────

function recordEvent(
  db: Database,
  executionId: number,
  from: AgentState,
  to: AgentState,
  actor: "human" | "agent",
  note: string | null,
): void {
  db.prepare(
    `INSERT INTO agent_execution_events (execution_id, from_state, to_state, actor, note)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(executionId, from, to, actor, note);
}

/** Shared core for a human transition with compare-and-set. */
function humanTransition(
  db: Database,
  taskId: number,
  to: AgentState,
  extra: { summaryReset?: boolean; feedback?: string | null },
): HandlerResult {
  const exec = db
    .query("SELECT * FROM agent_executions WHERE task_id = ?")
    .get(taskId) as ExecutionRow | null;
  if (!exec) return { status: 404, body: { error: "La tarea no tiene una ejecución de agente" } };

  const result = applyTransition(exec.state, to, "human");
  if (!result.ok) return { status: 409, body: { error: result.reason } };

  const changed = db
    .prepare(
      `UPDATE agent_executions
       SET state = ?, review_feedback = ?, updated_at = datetime('now')
       WHERE task_id = ? AND state = ?`,
    )
    .run(to, extra.feedback ?? exec.review_feedback, taskId, exec.state);

  if (changed.changes === 0) {
    // State moved under us (race) — reject without mutating.
    return { status: 409, body: { error: "El estado cambió; reintenta" } };
  }

  recordEvent(db, exec.id, exec.state, to, "human", extra.feedback ?? null);
  return getExecution(db, taskId);
}

export function approveExecution(db: Database, taskId: number): HandlerResult {
  return humanTransition(db, taskId, "done", {});
}

export function requestChanges(db: Database, taskId: number, feedback: string): HandlerResult {
  if (!feedback || !feedback.trim()) {
    return { status: 400, body: { error: "El feedback es obligatorio" } };
  }
  return humanTransition(db, taskId, "changes_requested", { feedback: feedback.trim() });
}

// ── Attachments ──────────────────────────────────────────────────────────────

export function listAttachments(db: Database, taskId: number): HandlerResult {
  const rows = db
    .query(
      "SELECT id, task_id, filename, mime_type, size_bytes, created_at FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC",
    )
    .all(taskId);
  return { status: 200, body: rows };
}

/**
 * Validates and stores an uploaded file. `bytes` is the raw content; the file
 * is written under uploads/<taskId>/. Never logs file content (R25).
 */
export async function createAttachment(
  db: Database,
  taskId: number,
  file: { name: string; type: string; bytes: ArrayBuffer | Uint8Array },
  packageRoot: string,
): Promise<HandlerResult> {
  const task = db.query("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) return { status: 404, body: { error: "Tarea no encontrada" } };

  const size = file.bytes instanceof ArrayBuffer ? file.bytes.byteLength : file.bytes.length;
  const validation = validateAttachment({ mime: file.type, size });
  if (!validation.ok) return { status: 400, body: { error: validation.reason } };

  const uuid = crypto.randomUUID();
  const relPath = attachmentStoragePath(taskId, uuid, file.name);
  const absDir = path.join(packageRoot, taskUploadDir(taskId));
  const absPath = path.join(packageRoot, relPath);

  mkdirSync(absDir, { recursive: true });
  await Bun.write(absPath, file.bytes);

  const result = db
    .prepare(
      `INSERT INTO task_attachments (task_id, filename, stored_path, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(taskId, file.name, relPath, file.type, size);

  const row = db
    .query(
      "SELECT id, task_id, filename, mime_type, size_bytes, created_at FROM task_attachments WHERE id = ?",
    )
    .get(result.lastInsertRowid);
  return { status: 201, body: row };
}

interface AttachmentRow {
  id: number;
  task_id: number;
  filename: string;
  stored_path: string;
  mime_type: string;
  size_bytes: number;
}

export function getAttachmentRecord(db: Database, attachmentId: number): AttachmentRow | null {
  return db
    .query("SELECT * FROM task_attachments WHERE id = ?")
    .get(attachmentId) as AttachmentRow | null;
}

export function deleteAttachment(
  db: Database,
  attachmentId: number,
  packageRoot: string,
): HandlerResult {
  const row = getAttachmentRecord(db, attachmentId);
  if (!row) return { status: 404, body: { error: "Adjunto no encontrado" } };

  const absPath = path.join(packageRoot, row.stored_path);
  if (existsSync(absPath)) {
    rmSync(absPath, { force: true });
  }
  db.prepare("DELETE FROM task_attachments WHERE id = ?").run(attachmentId);
  return { status: 200, body: { success: true } };
}

/** Exposed for the download route — resolves the absolute path safely. */
export function resolveAttachmentPath(packageRoot: string, storedPath: string): string {
  // storedPath always starts with UPLOADS_DIR/ and was sanitized on creation.
  const abs = path.join(packageRoot, storedPath);
  const uploadsRoot = path.join(packageRoot, UPLOADS_DIR);
  // Defense-in-depth: ensure the resolved path stays inside uploads/.
  if (!abs.startsWith(uploadsRoot)) {
    throw new Error("Ruta de adjunto inválida");
  }
  return abs;
}
