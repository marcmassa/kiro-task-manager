/**
 * Integration tests for AgentEngine — verifies engine state management,
 * busy guard, and config hot-reload using a real in-memory SQLite DB.
 *
 * Note: Full LLM cycle tests are not feasible without real provider calls,
 * so these focus on the observable engine behavior: state transitions,
 * concurrency guard, and config persistence.
 *
 * Cubre: R1.2, R1.3, R5.1, R5.2, R6.4, R7.1, R7.2, R10.2 (task 13.1)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { AgentEngine } from "./engine";
import { _invalidateCache_forTest } from "../utils/aiProviderHandlers";

// ---------------------------------------------------------------------------
// Helper: crea DB in-memory con esquema completo para el engine
// ---------------------------------------------------------------------------

function createFullTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE priorities (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1'
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority_id INTEGER NOT NULL DEFAULT 1,
      category_id INTEGER NOT NULL DEFAULT 1,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (priority_id) REFERENCES priorities(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Usuario',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'mcp',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL UNIQUE,
      agent_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'assigned',
      agent_summary TEXT,
      review_feedback TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
    CREATE TABLE agent_execution_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id INTEGER NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (execution_id) REFERENCES agent_executions(id) ON DELETE CASCADE
    );
    CREATE TABLE task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      transport TEXT NOT NULL DEFAULT 'stdio',
      command TEXT,
      args TEXT NOT NULL DEFAULT '[]',
      env_encrypted TEXT NOT NULL DEFAULT '',
      url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      auto_approve TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_provider_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      secret_access_key_encrypted TEXT NOT NULL DEFAULT '',
      access_key_id TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL DEFAULT '',
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE agent_engine_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_start INTEGER NOT NULL DEFAULT 0,
      poll_interval_ms INTEGER NOT NULL DEFAULT 30000,
      max_iterations INTEGER NOT NULL DEFAULT 50,
      max_retries INTEGER NOT NULL DEFAULT 3,
      tool_timeout_ms INTEGER NOT NULL DEFAULT 30000,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed data
    INSERT INTO priorities (id, name, level, color) VALUES (1, 'Media', 2, '#FF9900');
    INSERT INTO categories (id, name, color) VALUES (1, 'General', '#6366f1');
    INSERT INTO agents (id, name) VALUES ('kiro', 'Kiro');
    INSERT INTO agent_engine_config (id) VALUES (1);
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentEngine integration tests", () => {
  let db: Database;

  beforeEach(() => {
    _invalidateCache_forTest();
    db = createFullTestDb();
  });

  test("engine status is disabled when no provider configured", () => {
    const engine = new AgentEngine(db);
    expect(engine.getStatus().status).toBe("disabled");
  });

  test("engine status transitions: disabled → idle after start()", () => {
    const engine = new AgentEngine(db);
    expect(engine.getStatus().status).toBe("disabled");

    engine.start();
    expect(engine.getStatus().status).toBe("idle");
    engine.stop();
  });

  test("runCycle returns disabled when no provider configured", async () => {
    const engine = new AgentEngine(db);

    const result = await engine.runCycle();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("no configurado");
  });

  test("runCycle returns no tasks when provider configured but no assigned tasks", async () => {
    // Configure a provider with empty api_key (skips decryption)
    db.exec(`
      INSERT INTO ai_provider_config (id, provider_id, model, api_key_encrypted)
      VALUES (1, 'ollama', 'llama3', '')
    `);

    const engine = new AgentEngine(db);

    const result = await engine.runCycle();

    expect(result.ok).toBe(true);
    expect(result.message).toContain("No hay tareas");
  });

  test("runCycle with assigned task claims it and handles LLM error gracefully", async () => {
    // Configure provider (Ollama with unreachable URL to trigger connection refused fast)
    db.exec(`
      INSERT INTO ai_provider_config (id, provider_id, model, api_key_encrypted, base_url)
      VALUES (1, 'ollama', 'llama3', '', 'http://127.0.0.1:1')
    `);
    db.exec("INSERT INTO tasks (id, title, status) VALUES (1, 'Test Task', 'todo')");
    db.exec(
      "INSERT INTO agent_executions (task_id, agent_id, state) VALUES (1, 'kiro', 'assigned')",
    );
    // Minimize retries so the test finishes quickly
    db.exec("UPDATE agent_engine_config SET max_retries = 0, max_iterations = 1 WHERE id = 1");

    const engine = new AgentEngine(db);

    // runCycle will claim the task, attempt to process (LLM call will fail),
    // then return with an error — but it should not throw/crash
    const result = await engine.runCycle();

    // The task was found and claimed, but processing failed (no LLM server)
    // Engine should have handled the error and returned gracefully
    expect(result.taskId).toBe(1);

    // After the cycle, the engine should be back to idle (not stuck in "working")
    expect(engine.getStatus().status).toBe("idle");

    // Verify the task was claimed (transitioned to agent_working)
    const exec = db.query("SELECT state FROM agent_executions WHERE task_id = 1").get() as {
      state: string;
    };
    expect(exec.state).toBe("agent_working");
  });

  test("updateConfig persists poll interval to DB", () => {
    const engine = new AgentEngine(db);

    engine.updateConfig({ pollIntervalMs: 10000 });

    expect(engine.getConfig().pollIntervalMs).toBe(10000);

    // Verify persisted in DB
    const row = db.query("SELECT poll_interval_ms FROM agent_engine_config WHERE id = 1").get() as {
      poll_interval_ms: number;
    };
    expect(row.poll_interval_ms).toBe(10000);
  });

  test("updateConfig persists autoStart to DB", () => {
    const engine = new AgentEngine(db);

    engine.updateConfig({ autoStart: true });

    expect(engine.getConfig().autoStart).toBe(true);

    const row = db.query("SELECT auto_start FROM agent_engine_config WHERE id = 1").get() as {
      auto_start: number;
    };
    expect(row.auto_start).toBe(1);
  });

  test("updateConfig persists multiple fields", () => {
    const engine = new AgentEngine(db);

    engine.updateConfig({
      pollIntervalMs: 15000,
      maxIterations: 25,
      maxRetries: 5,
      toolTimeoutMs: 60000,
    });

    const config = engine.getConfig();
    expect(config.pollIntervalMs).toBe(15000);
    expect(config.maxIterations).toBe(25);
    expect(config.maxRetries).toBe(5);
    expect(config.toolTimeoutMs).toBe(60000);
  });

  test("getStatus returns correct metadata when idle", () => {
    const engine = new AgentEngine(db);
    engine.start();

    const status = engine.getStatus();

    expect(status.status).toBe("idle");
    expect(status.currentTaskId).toBeNull();
    expect(status.currentTaskTitle).toBeNull();

    engine.stop();
  });

  test("getConfig returns default values from DB", () => {
    const engine = new AgentEngine(db);
    const config = engine.getConfig();

    expect(config.autoStart).toBe(false);
    expect(config.pollIntervalMs).toBe(30000);
    expect(config.maxIterations).toBe(50);
    expect(config.maxRetries).toBe(3);
    expect(config.toolTimeoutMs).toBe(30000);
  });

  test("stop after start transitions back to disabled", () => {
    const engine = new AgentEngine(db);

    engine.start();
    expect(engine.getStatus().status).toBe("idle");

    engine.stop();
    expect(engine.getStatus().status).toBe("disabled");
  });
});
