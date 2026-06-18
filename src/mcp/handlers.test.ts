import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { listAssignedTasks, getTask, claimTask, submitForReview, resumeTask } from "./handlers";
import * as handlers from "./handlers";

/**
 * In-memory DB mirroring the FEAT-006 schema, so handler tests are isolated
 * from the real tasks.db. Mirrors db/database.ts for the relevant tables.
 */
function makeDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE priorities (id INTEGER PRIMARY KEY, name TEXT, level INTEGER, color TEXT);
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, color TEXT);
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo', priority_id INTEGER DEFAULT 1, category_id INTEGER DEFAULT 1,
      due_date TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT, kind TEXT DEFAULT 'mcp', enabled INTEGER DEFAULT 1);
    CREATE TABLE agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER UNIQUE, agent_id TEXT,
      state TEXT DEFAULT 'assigned', agent_summary TEXT, review_feedback TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agent_execution_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, execution_id INTEGER, from_state TEXT, to_state TEXT,
      actor TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, filename TEXT, stored_path TEXT,
      mime_type TEXT, size_bytes INTEGER, created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec("INSERT INTO priorities (id,name,level,color) VALUES (1,'Media',2,'#FF9900')");
  db.exec("INSERT INTO categories (id,name,color) VALUES (1,'Desarrollo','#0972D3')");
  db.exec("INSERT INTO agents (id,name) VALUES ('kiro','Kiro')");
  return db;
}

function seedTask(db: Database, title = "Tarea"): number {
  const r = db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title);
  return Number(r.lastInsertRowid);
}

function assign(db: Database, taskId: number, agentId = "kiro"): void {
  db.prepare(
    "INSERT INTO agent_executions (task_id, agent_id, state) VALUES (?,?, 'assigned')",
  ).run(taskId, agentId);
}

let db: Database;
beforeEach(() => {
  db = makeDb();
});

// ── R3: tareas sin agente no aparecen ────────────────────────────────────────
describe("handlers — list_assigned_tasks (R3)", () => {
  test("solo lista tareas con ejecución del agente", () => {
    const t1 = seedTask(db, "Asignada");
    seedTask(db, "Sin agente");
    assign(db, t1, "kiro");

    const res = listAssignedTasks(db, "kiro");
    expect(res.ok).toBe(true);
    const rows = (res as { ok: true; data: Array<{ task_id: number }> }).data;
    expect(rows.length).toBe(1);
    expect(rows[0].task_id).toBe(t1);
  });

  test("no lista tareas de otro agente", () => {
    const t1 = seedTask(db);
    assign(db, t1, "kiro");
    const res = listAssignedTasks(db, "otro");
    expect((res as { ok: true; data: unknown[] }).data).toEqual([]);
  });
});

// ── R17: read tools devuelven datos ───────────────────────────────────────────
describe("handlers — get_task (R17)", () => {
  test("devuelve task + execution + attachments", () => {
    const t = seedTask(db, "Con datos");
    assign(db, t, "kiro");
    const res = getTask(db, t);
    expect(res.ok).toBe(true);
    const data = (res as { ok: true; data: any }).data;
    expect(data.task.title).toBe("Con datos");
    expect(data.execution.agent_id).toBe("kiro");
    expect(Array.isArray(data.attachments)).toBe(true);
  });

  test("tarea inexistente → error", () => {
    expect(getTask(db, 999).ok).toBe(false);
  });
});

// ── R18: NO existe handler que lleve a 'done' ────────────────────────────────
describe("handlers — gate humano (R18)", () => {
  test("el módulo no exporta ninguna tool de aprobación / done", () => {
    const exported = Object.keys(handlers);
    expect(exported).not.toContain("approveTask");
    expect(exported).not.toContain("approve");
    expect(exported).not.toContain("markDone");
    // Las tools de transición expuestas son exactamente estas tres:
    expect(exported).toContain("claimTask");
    expect(exported).toContain("submitForReview");
    expect(exported).toContain("resumeTask");
  });

  test("un agente no puede llegar a 'done' por ninguna tool de transición", () => {
    const t = seedTask(db);
    assign(db, t, "kiro");
    claimTask(db, t); // assigned → agent_working
    submitForReview(db, t, "hecho"); // agent_working → pending_review
    // No hay tool para pending_review → done; el estado se queda en pending_review.
    const state = (
      db.query("SELECT state FROM agent_executions WHERE task_id = ?").get(t) as { state: string }
    ).state;
    expect(state).toBe("pending_review");
  });
});

// ── R6/R7/R11: transiciones válidas de agente ────────────────────────────────
describe("handlers — transiciones de agente", () => {
  test("claim → submit → (changes) → resume", () => {
    const t = seedTask(db);
    assign(db, t, "kiro");

    expect(claimTask(db, t).ok).toBe(true); // R6
    expect(submitForReview(db, t, "v1").ok).toBe(true); // R7

    // Simula que un humano pide cambios (REST), aquí lo forzamos en DB:
    db.prepare("UPDATE agent_executions SET state='changes_requested' WHERE task_id=?").run(t);

    expect(resumeTask(db, t).ok).toBe(true); // R11
    const state = (
      db.query("SELECT state FROM agent_executions WHERE task_id = ?").get(t) as { state: string }
    ).state;
    expect(state).toBe("agent_working");
  });

  test("submit sin resumen se rechaza", () => {
    const t = seedTask(db);
    assign(db, t, "kiro");
    claimTask(db, t);
    expect(submitForReview(db, t, "  ").ok).toBe(false);
  });
});

// ── R20: transición inválida de agente → error, sin mutar ────────────────────
describe("handlers — transición inválida (R20)", () => {
  test("submit desde 'assigned' (sin claim) se rechaza y no muta", () => {
    const t = seedTask(db);
    assign(db, t, "kiro"); // state = assigned
    const res = submitForReview(db, t, "x"); // assigned → pending_review NO permitido
    expect(res.ok).toBe(false);
    const state = (
      db.query("SELECT state FROM agent_executions WHERE task_id = ?").get(t) as { state: string }
    ).state;
    expect(state).toBe("assigned");
  });

  test("transición sobre tarea sin ejecución → error", () => {
    const t = seedTask(db);
    expect(claimTask(db, t).ok).toBe(false);
  });
});
