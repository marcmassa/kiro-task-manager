import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  listAgents,
  assignAgent,
  getExecution,
  approveExecution,
  requestChanges,
  createAttachment,
  listAttachments,
  deleteAttachment,
  getAttachmentRecord,
} from "./agentHandlers";

function makeDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, status TEXT DEFAULT 'todo',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT, kind TEXT DEFAULT 'mcp', enabled INTEGER DEFAULT 1);
    CREATE TABLE agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER UNIQUE, agent_id TEXT,
      state TEXT DEFAULT 'assigned', agent_summary TEXT, review_feedback TEXT,
      sdd_phase TEXT DEFAULT NULL, phase_output TEXT DEFAULT NULL,
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
  db.exec("INSERT INTO agents (id,name,enabled) VALUES ('kiro','Kiro',1)");
  db.exec("INSERT INTO agents (id,name,enabled) VALUES ('disabled','Off',0)");
  return db;
}

function seedTask(db: Database): number {
  return Number(db.prepare("INSERT INTO tasks (title) VALUES ('T')").run().lastInsertRowid);
}

let db: Database;
let root: string;

beforeEach(() => {
  db = makeDb();
  root = mkdtempSync(path.join(tmpdir(), "feat006-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// ── R1: asignación crea ejecución 'assigned' ─────────────────────────────────
describe("agentHandlers — asignación (R1)", () => {
  test("asignar crea ejecución en 'assigned'", () => {
    const t = seedTask(db);
    const res = assignAgent(db, t, "kiro");
    expect(res.status).toBe(200);
    const exec = getExecution(db, t).body as { state: string; agent_id: string };
    expect(exec.state).toBe("assigned");
    expect(exec.agent_id).toBe("kiro");
  });

  test("R4: agente deshabilitado se rechaza", () => {
    const t = seedTask(db);
    expect(assignAgent(db, t, "disabled").status).toBe(400);
  });

  test("R4: agente inexistente se rechaza", () => {
    const t = seedTask(db);
    expect(assignAgent(db, t, "ghost").status).toBe(400);
  });

  test("listAgents solo devuelve habilitados", () => {
    const agents = listAgents(db).body as Array<{ id: string }>;
    expect(agents.map((a) => a.id)).toEqual(["kiro"]);
  });
});

// ── R9/R10: gate humano ───────────────────────────────────────────────────────
describe("agentHandlers — gate humano (R9/R10)", () => {
  function toPendingReview(taskId: number): void {
    db.prepare("UPDATE agent_executions SET state='pending_review' WHERE task_id=?").run(taskId);
  }

  test("R9: approve desde pending_review → done", () => {
    const t = seedTask(db);
    assignAgent(db, t, "kiro");
    toPendingReview(t);
    const res = approveExecution(db, t);
    expect(res.status).toBe(200);
    expect((res.body as { state: string }).state).toBe("done");
  });

  test("approve desde 'assigned' se rechaza (transición inválida)", () => {
    const t = seedTask(db);
    assignAgent(db, t, "kiro"); // assigned
    const res = approveExecution(db, t);
    expect(res.status).toBe(409);
    expect((getExecution(db, t).body as { state: string }).state).toBe("assigned");
  });

  test("R10: request-changes desde pending_review → changes_requested + feedback", () => {
    const t = seedTask(db);
    assignAgent(db, t, "kiro");
    toPendingReview(t);
    const res = requestChanges(db, t, "Faltan tests");
    expect(res.status).toBe(200);
    const exec = res.body as { state: string; review_feedback: string };
    expect(exec.state).toBe("changes_requested");
    expect(exec.review_feedback).toBe("Faltan tests");
  });

  test("request-changes sin feedback se rechaza", () => {
    const t = seedTask(db);
    assignAgent(db, t, "kiro");
    toPendingReview(t);
    expect(requestChanges(db, t, "   ").status).toBe(400);
  });
});

// ── R13/R14/R16/R25: adjuntos ─────────────────────────────────────────────────
describe("agentHandlers — adjuntos (R13/R14/R16/R25)", () => {
  test("R13: subir un archivo válido lo guarda en disco + DB", async () => {
    const t = seedTask(db);
    const bytes = new TextEncoder().encode("hola mundo");
    const res = await createAttachment(
      db,
      t,
      { name: "notas.txt", type: "text/plain", bytes },
      root,
    );
    expect(res.status).toBe(201);
    const list = listAttachments(db, t).body as unknown[];
    expect(list.length).toBe(1);
    // El fichero existe en disco bajo uploads/<taskId>/
    const dir = path.join(root, "uploads", String(t));
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).length).toBe(1);
  });

  test("R14: tipo no permitido se rechaza y no se guarda", async () => {
    const t = seedTask(db);
    const bytes = new Uint8Array([1, 2, 3]);
    const res = await createAttachment(
      db,
      t,
      { name: "virus.exe", type: "application/x-msdownload", bytes },
      root,
    );
    expect(res.status).toBe(400);
    expect((listAttachments(db, t).body as unknown[]).length).toBe(0);
  });

  test("R16: eliminar borra DB + fichero en disco", async () => {
    const t = seedTask(db);
    const bytes = new TextEncoder().encode("x");
    const created = (
      await createAttachment(db, t, { name: "a.txt", type: "text/plain", bytes }, root)
    ).body as { id: number };
    const rec = getAttachmentRecord(db, created.id)!;
    const abs = path.join(root, rec.stored_path);
    expect(existsSync(abs)).toBe(true);

    deleteAttachment(db, created.id, root);
    expect(existsSync(abs)).toBe(false);
    expect(getAttachmentRecord(db, created.id)).toBeNull();
  });

  test("R25: el contenido del fichero no se escribe en logs", async () => {
    const secret = "CONTENIDO-SECRETO-12345";
    const captured: string[] = [];
    const orig = { log: console.log, error: console.error, warn: console.warn };
    console.log = (...a) => captured.push(a.join(" "));
    console.error = (...a) => captured.push(a.join(" "));
    console.warn = (...a) => captured.push(a.join(" "));
    try {
      const t = seedTask(db);
      const bytes = new TextEncoder().encode(secret);
      await createAttachment(db, t, { name: "s.txt", type: "text/plain", bytes }, root);
    } finally {
      console.log = orig.log;
      console.error = orig.error;
      console.warn = orig.warn;
    }
    expect(captured.join("\n")).not.toContain(secret);
  });
});
