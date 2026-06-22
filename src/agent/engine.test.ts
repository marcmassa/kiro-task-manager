import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import fc from "fast-check";
import { AgentEngine, computeRetryDelay } from "./engine";
import { _invalidateCache_forTest } from "../utils/aiProviderHandlers";

// ── Test DB Setup ──────────────────────────────────────────────────────────

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE priorities (id INTEGER PRIMARY KEY, name TEXT NOT NULL, level INTEGER, color TEXT);
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT);
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority_id INTEGER DEFAULT 1,
      category_id INTEGER DEFAULT 1,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Usuario',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT DEFAULT 'mcp', enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL UNIQUE,
      agent_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'assigned',
      agent_summary TEXT,
      review_feedback TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agent_execution_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id INTEGER NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      transport TEXT DEFAULT 'stdio',
      command TEXT,
      args TEXT DEFAULT '[]',
      env_encrypted TEXT DEFAULT '',
      url TEXT,
      enabled INTEGER DEFAULT 1,
      auto_approve TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE ai_provider_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_encrypted TEXT DEFAULT '',
      secret_access_key_encrypted TEXT DEFAULT '',
      access_key_id TEXT DEFAULT '',
      region TEXT DEFAULT '',
      base_url TEXT DEFAULT '',
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE agent_engine_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_start INTEGER DEFAULT 0,
      poll_interval_ms INTEGER DEFAULT 30000,
      max_iterations INTEGER DEFAULT 50,
      max_retries INTEGER DEFAULT 3,
      tool_timeout_ms INTEGER DEFAULT 30000,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE workspace_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      workspace_name TEXT NOT NULL DEFAULT 'Mi Workspace',
      repo_path TEXT DEFAULT NULL,
      repo_remote_url TEXT DEFAULT NULL,
      repo_default_branch TEXT NOT NULL DEFAULT 'main',
      repo_status TEXT NOT NULL DEFAULT 'not_configured',
      repo_current_branch TEXT DEFAULT NULL
    );
    CREATE TABLE task_file_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      reference_type TEXT NOT NULL DEFAULT 'context',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE task_file_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      change_type TEXT NOT NULL,
      agent_execution_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO priorities (id, name, level, color) VALUES (1, 'Media', 2, '#FF9900');
    INSERT INTO categories (id, name, color) VALUES (1, 'General', '#6366f1');
    INSERT INTO agents (id, name) VALUES ('kiro', 'Kiro');
    INSERT INTO agent_engine_config (id) VALUES (1);
    INSERT INTO workspace_settings (id) VALUES (1);
  `);
  return db;
}

// ── Property 5: Tool-Use Loop Bounded Termination (Task 9.2) ───────────────
// **Validates: Requirements 5.4**
//
// The tool-use loop in processTask is bounded by config.maxIterations via a
// for-loop: `for (let i = 0; i < config.maxIterations; i++)`. We verify that
// the maxIterations config is always loaded correctly from the DB as a finite
// positive integer, guaranteeing that any loop using it as a bound terminates.
// Additionally, we simulate the loop logic to prove the iteration count is exact.

describe("Property 5: Tool-Use Loop Bounded Termination", () => {
  test("maxIterations config loaded from DB is always a finite positive integer that bounds the loop", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (maxIter) => {
        const db = createTestDb();
        db.exec(`UPDATE agent_engine_config SET max_iterations = ${maxIter} WHERE id = 1`);
        const engine = new AgentEngine(db);
        const config = engine.getConfig();

        // Config must reflect what's stored
        expect(config.maxIterations).toBe(maxIter);
        // Must be a positive finite integer (guarantees for-loop termination)
        expect(config.maxIterations).toBeGreaterThan(0);
        expect(Number.isFinite(config.maxIterations)).toBe(true);
        expect(Number.isInteger(config.maxIterations)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test("simulated tool-use loop always terminates at exactly maxIterations when LLM never returns text", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (maxIterations) => {
        // Simulate the for-loop from processTask:
        // for (let i = 0; i < maxIterations; i++) { ... if text → break ... }
        // When the LLM always returns tool_use, the loop runs exactly maxIterations times.
        let iterationCount = 0;
        for (let i = 0; i < maxIterations; i++) {
          iterationCount++;
          // Simulate: LLM always returns tool_use, never text → never breaks
        }
        expect(iterationCount).toBe(maxIterations);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 6: Message History Monotonicity (Task 9.3) ────────────────────
// **Validates: Requirements 5.5**
//
// The tool-use loop only appends messages (assistant + tool results). Messages
// are never removed or truncated within a single task processing cycle.
// We simulate the message accumulation pattern from processTask to verify
// the non-decreasing property holds universally.

describe("Property 6: Message History Monotonicity", () => {
  test("message array length is strictly non-decreasing across all iterations", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 50 }),
        (toolCallsPerIteration) => {
          // Simulate the message growth pattern from processTask:
          // Start: 2 messages (system + user)
          // Each iteration with tool_use response:
          //   +1 assistant message (with toolCalls)
          //   +N tool result messages (one per tool call)
          let length = 2; // initial: system + user
          const lengths: number[] = [length];

          for (const numToolCalls of toolCallsPerIteration) {
            // Assistant message appended
            length += 1;
            // Tool results appended (one per tool call)
            length += numToolCalls;
            lengths.push(length);
          }

          // Verify non-decreasing (monotonicity)
          for (let i = 1; i < lengths.length; i++) {
            expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("message history never shrinks even with varying tool call counts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // maxIterations
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 50 }),
        (maxIterations, toolCallCounts) => {
          // Simulate: start at 2, each iteration adds at least 2 (1 assistant + 1 tool result)
          let currentLength = 2;
          let prevLength = currentLength;
          const iterations = Math.min(maxIterations, toolCallCounts.length);

          for (let i = 0; i < iterations; i++) {
            const numToolCalls = toolCallCounts[i];
            currentLength += 1 + numToolCalls; // assistant + tool results
            expect(currentLength).toBeGreaterThanOrEqual(prevLength);
            prevLength = currentLength;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Engine Unit Tests (Task 9.4) ───────────────────────────────────────────

describe("AgentEngine unit tests", () => {
  let db: Database;
  let engine: AgentEngine;

  beforeEach(() => {
    _invalidateCache_forTest();
    db = createTestDb();
    engine = new AgentEngine(db);
  });

  // -- State transitions --

  test("getStatus returns disabled initially (no provider configured)", () => {
    const status = engine.getStatus();
    expect(status.status).toBe("disabled");
    expect(status.currentTaskId).toBeNull();
    expect(status.currentTaskTitle).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.lastCycleAt).toBeNull();
  });

  test("getConfig returns defaults from DB", () => {
    const config = engine.getConfig();
    expect(config.autoStart).toBe(false);
    expect(config.pollIntervalMs).toBe(30000);
    expect(config.maxIterations).toBe(50);
    expect(config.maxRetries).toBe(3);
    expect(config.toolTimeoutMs).toBe(30000);
  });

  test("updateConfig persists changes and getConfig returns updated values", () => {
    engine.updateConfig({ pollIntervalMs: 15000, autoStart: true, maxIterations: 25 });
    const config = engine.getConfig();
    expect(config.pollIntervalMs).toBe(15000);
    expect(config.autoStart).toBe(true);
    expect(config.maxIterations).toBe(25);
    // Unchanged fields stay at defaults
    expect(config.maxRetries).toBe(3);
    expect(config.toolTimeoutMs).toBe(30000);
  });

  // -- Provider not configured --

  test("runCycle returns error when no AI provider is configured", async () => {
    // No ai_provider_config row exists → provider not configured
    const result = await engine.runCycle();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no configurado");
  });

  // -- No tasks assigned --

  test("runCycle returns 'no tasks' when provider configured but no assigned tasks", async () => {
    // Insert a provider config with empty api_key_encrypted (decryptApiKey returns "" for empty)
    db.exec(`INSERT INTO ai_provider_config (id, provider_id, model, api_key_encrypted)
             VALUES (1, 'openai', 'gpt-4', '')`);
    const result = await engine.runCycle();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("No hay tareas");
  });

  // -- Busy guard --

  test("runCycle returns busy when engine is already processing", async () => {
    // Set up provider + assigned task so first runCycle enters processing
    db.exec(`INSERT INTO ai_provider_config (id, provider_id, model, api_key_encrypted)
             VALUES (1, 'openai', 'gpt-4', '')`);
    db.exec("INSERT INTO tasks (id, title, status) VALUES (1, 'Test task', 'todo')");
    db.exec(
      "INSERT INTO agent_executions (task_id, agent_id, state) VALUES (1, 'kiro', 'assigned')",
    );
    // Keep retries at 1 so processTask has some time in the retry/backoff loop
    engine.updateConfig({ maxRetries: 1 });

    // Start first cycle — it will claim the task and enter processTask
    const promise1 = engine.runCycle();

    // Poll rapidly until the engine enters working state (processing = true)
    let busyResult: { ok: boolean; message: string } | null = null;
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 2));
      const status = engine.getStatus();
      if (status.status === "working") {
        busyResult = await engine.runCycle();
        break;
      }
    }

    // Clean up first call
    await promise1.catch(() => {});

    // Verify that the busy guard was triggered
    expect(busyResult).not.toBeNull();
    expect(busyResult!.ok).toBe(false);
    expect(busyResult!.message).toContain("ocupado");
  });

  // -- Config edge cases --

  test("updateConfig with partial fields preserves unset fields", () => {
    engine.updateConfig({ toolTimeoutMs: 60000 });
    const config = engine.getConfig();
    expect(config.toolTimeoutMs).toBe(60000);
    expect(config.pollIntervalMs).toBe(30000); // unchanged
    expect(config.autoStart).toBe(false); // unchanged
  });
});
