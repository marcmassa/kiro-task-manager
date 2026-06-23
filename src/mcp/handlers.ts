/**
 * MCP tool handlers (FEAT-006) — Model C.
 *
 * Pure-ish DB-backed functions, independent of the MCP transport, so they can
 * be unit-tested without spawning a stdio server. The MCP entry point
 * (mcp-server.ts) registers these against the official SDK.
 *
 * GATE (R18): there is intentionally NO handler that transitions an execution
 * to "done". Agents can only claim / submit / resume. Approval is human-only
 * and lives in the REST layer.
 *
 * Every agent-side transition goes through `applyTransition(..., "agent")`;
 * an invalid transition returns an error result and never mutates (R20).
 */
import type { Database } from "bun:sqlite";
import { applyTransition, type AgentState } from "../utils/agentLifecycle";
import { readFileSync, existsSync } from "fs";
import path from "path";

export interface ToolOk {
  ok: true;
  data: unknown;
}
export interface ToolErr {
  ok: false;
  error: string;
}
export type ToolResult = ToolOk | ToolErr;

interface ExecutionRow {
  id: number;
  task_id: number;
  agent_id: string;
  state: AgentState;
  agent_summary: string | null;
  review_feedback: string | null;
}

// ── Read tools ───────────────────────────────────────────────────────────────

/** Lists tasks that have an execution assigned to the given agent (R3). */
export function listAssignedTasks(db: Database, agentId: string): ToolResult {
  const rows = db
    .query(
      `SELECT t.id AS task_id, t.title, t.status AS kanban_status,
              e.state AS agent_state, e.agent_summary, e.review_feedback
       FROM agent_executions e
       JOIN tasks t ON t.id = e.task_id
       WHERE e.agent_id = ?
       ORDER BY e.updated_at DESC`,
    )
    .all(agentId);
  return { ok: true, data: rows };
}

/** Returns a task's full context + attachment metadata for the agent (R15). */
export function getTask(db: Database, taskId: number): ToolResult {
  const task = db
    .query(
      `SELECT t.id, t.title, t.description, t.status AS kanban_status, t.due_date,
              p.name AS priority, c.name AS category
       FROM tasks t
       JOIN priorities p ON t.priority_id = p.id
       JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
    )
    .get(taskId);
  if (!task) return { ok: false, error: "Tarea no encontrada" };

  const execution = db
    .query(
      "SELECT agent_id, state, agent_summary, review_feedback FROM agent_executions WHERE task_id = ?",
    )
    .get(taskId);

  const attachments = db
    .query(
      "SELECT id, filename, mime_type, size_bytes FROM task_attachments WHERE task_id = ? ORDER BY created_at",
    )
    .all(taskId);

  return { ok: true, data: { task, execution, attachments } };
}

/**
 * Returns the content of an attachment (R15). Text MIME types are returned as
 * UTF-8; binary types as base64. Never logs the content.
 */
export function getAttachment(db: Database, attachmentId: number, packageRoot: string): ToolResult {
  const row = db
    .query("SELECT filename, stored_path, mime_type FROM task_attachments WHERE id = ?")
    .get(attachmentId) as { filename: string; stored_path: string; mime_type: string } | null;
  if (!row) return { ok: false, error: "Adjunto no encontrado" };

  const abs = path.join(packageRoot, row.stored_path);
  if (!existsSync(abs)) return { ok: false, error: "El fichero del adjunto no existe en disco" };

  const buf = readFileSync(abs);
  const isText = row.mime_type.startsWith("text/") || row.mime_type === "application/json";
  return {
    ok: true,
    data: {
      filename: row.filename,
      mime_type: row.mime_type,
      encoding: isText ? "utf-8" : "base64",
      content: isText ? buf.toString("utf-8") : buf.toString("base64"),
    },
  };
}

// ── Transition tools (actor = agent) ─────────────────────────────────────────

function agentTransition(
  db: Database,
  taskId: number,
  to: AgentState,
  opts: { summary?: string } = {},
): ToolResult {
  const exec = db
    .query("SELECT * FROM agent_executions WHERE task_id = ?")
    .get(taskId) as ExecutionRow | null;
  if (!exec) return { ok: false, error: "La tarea no tiene una ejecución de agente" };

  const result = applyTransition(exec.state, to, "agent");
  if (!result.ok) return { ok: false, error: result.reason };

  const changed = db
    .prepare(
      `UPDATE agent_executions
       SET state = ?, agent_summary = COALESCE(?, agent_summary), updated_at = datetime('now')
       WHERE task_id = ? AND state = ?`,
    )
    .run(to, opts.summary ?? null, taskId, exec.state);

  if (changed.changes === 0) {
    return { ok: false, error: "El estado cambió; reintenta" };
  }

  db.prepare(
    `INSERT INTO agent_execution_events (execution_id, from_state, to_state, actor, note)
     VALUES (?, ?, ?, 'agent', ?)`,
  ).run(exec.id, exec.state, to, opts.summary ?? null);

  const updated = db.query("SELECT * FROM agent_executions WHERE task_id = ?").get(taskId);
  return { ok: true, data: updated };
}

/** assigned → agent_working (R6). */
export function claimTask(db: Database, taskId: number): ToolResult {
  return agentTransition(db, taskId, "agent_working");
}

/** agent_working → pending_review, records the agent's summary (R7). */
export function submitForReview(db: Database, taskId: number, summary: string): ToolResult {
  if (!summary || !summary.trim()) {
    return { ok: false, error: "El resumen es obligatorio para enviar a revisión" };
  }
  return agentTransition(db, taskId, "pending_review", { summary: summary.trim() });
}

/** changes_requested → agent_working (R11). */
export function resumeTask(db: Database, taskId: number): ToolResult {
  return agentTransition(db, taskId, "agent_working");
}

/**
 * FEAT-012 — Saves the output of the current SDD phase and transitions the
 * execution to pending_review so the human can validate.
 */
export function submitPhaseOutput(db: Database, taskId: number, output: string): ToolResult {
  if (!output || !output.trim()) {
    return { ok: false, error: "El output de la fase es obligatorio" };
  }

  const exec = db
    .query("SELECT * FROM agent_executions WHERE task_id = ?")
    .get(taskId) as ExecutionRow | null;
  if (!exec) return { ok: false, error: "La tarea no tiene una ejecución de agente" };
  if (!("sdd_phase" in exec) || !(exec as any).sdd_phase) {
    return { ok: false, error: "Esta ejecución no está en modo SDD" };
  }

  const result = applyTransition(exec.state, "pending_review", "agent");
  if (!result.ok) return { ok: false, error: result.reason };

  const changed = db
    .prepare(
      `UPDATE agent_executions
       SET state = 'pending_review', phase_output = ?, agent_summary = ?, updated_at = datetime('now')
       WHERE task_id = ? AND state = ?`,
    )
    .run(output.trim(), output.trim(), taskId, exec.state);

  if (changed.changes === 0) {
    return { ok: false, error: "El estado cambió; reintenta" };
  }

  db.prepare(
    `INSERT INTO agent_execution_events (execution_id, from_state, to_state, actor, note)
     VALUES (?, ?, 'pending_review', 'agent', ?)`,
  ).run(exec.id, exec.state, `sdd_phase output submitted`);

  const updated = db.query("SELECT * FROM agent_executions WHERE task_id = ?").get(taskId);
  return { ok: true, data: updated };
}

// ── FEAT-008: Comment tools ──────────────────────────────────────────────

/**
 * Returns comments for a task, ordered chronologically (ASC).
 * R1.1, R1.2, R1.3, R6.1
 */
export function getTaskComments(db: Database, taskId: number): ToolResult {
  // Verify task exists
  const task = db.query("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    return { ok: false, error: "Tarea no encontrada" };
  }

  const comments = db
    .query(
      "SELECT id, content, author, created_at FROM comments WHERE task_id = ? ORDER BY created_at ASC",
    )
    .all(taskId);

  return { ok: true, data: comments };
}

/**
 * Creates a comment deriving the author from the active agent execution.
 * R2.1, R2.2, R2.3, R2.4, R3.1, R3.2
 */
export function postComment(db: Database, taskId: number, content: string): ToolResult {
  // Verify task exists
  const task = db.query("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    return { ok: false, error: "Tarea no encontrada" };
  }

  // Validate content is not empty/whitespace
  if (!content || content.trim().length === 0) {
    return { ok: false, error: "El contenido del comentario no puede estar vacío" };
  }

  // Find active agent execution and derive author name
  const execution = db
    .query(
      `SELECT a.name
     FROM agent_executions e
     JOIN agents a ON a.id = e.agent_id
     WHERE e.task_id = ?
       AND e.state IN ('assigned', 'agent_working', 'pending_review', 'changes_requested')`,
    )
    .get(taskId) as { name: string } | null;

  if (!execution) {
    return { ok: false, error: "El agente no tiene una ejecución activa en esta tarea" };
  }

  // Insert comment with derived author
  const result = db
    .prepare("INSERT INTO comments (task_id, content, author) VALUES (?, ?, ?)")
    .run(taskId, content.trim(), execution.name);

  // Return created comment
  const created = db
    .query("SELECT id, task_id, content, author, created_at FROM comments WHERE id = ?")
    .get(result.lastInsertRowid);

  return { ok: true, data: created };
}
