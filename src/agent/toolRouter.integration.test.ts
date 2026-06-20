/**
 * Integration tests for toolRouter — verifies routing to internal handlers
 * using a real in-memory SQLite DB, and routing to external MCP pool mocks.
 *
 * Cubre: R6.2, R6.3 (tasks 13.2)
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { createToolRouter } from "./toolRouter";
import type { ToolCall } from "./types";
import type { McpClientPool } from "./mcpClientPool";

// ---------------------------------------------------------------------------
// Mock MCP pool — sin herramientas externas
// ---------------------------------------------------------------------------

function createMockMcpPool(): McpClientPool {
  return {
    async initialize() {},
    getExternalTools() {
      return [];
    },
    async callTool(_server: string, _tool: string, _args: Record<string, unknown>) {
      return "mock result";
    },
    async reconnectFailed() {},
    async shutdown() {},
    getToolMap() {
      return new Map();
    },
  };
}

// ---------------------------------------------------------------------------
// Mock MCP pool — con herramientas externas
// ---------------------------------------------------------------------------

function createMockMcpPoolWithTools(): McpClientPool {
  return {
    async initialize() {},
    getExternalTools() {
      return [
        { name: "external_tool", description: "An external tool", inputSchema: { type: "object" } },
      ];
    },
    async callTool(_server: string, _tool: string, _args: Record<string, unknown>) {
      return JSON.stringify({ result: "external result" });
    },
    async reconnectFailed() {},
    async shutdown() {},
    getToolMap() {
      return new Map([["external_tool", "test-server"]]);
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: crea DB in-memory con esquema completo
// ---------------------------------------------------------------------------

function createTestDb(): Database {
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

    -- Seed data
    INSERT INTO priorities (id, name, level, color) VALUES (1, 'Media', 2, '#FF9900');
    INSERT INTO categories (id, name, color) VALUES (1, 'General', '#6366f1');
    INSERT INTO agents (id, name) VALUES ('kiro', 'Kiro');
    INSERT INTO tasks (id, title, description) VALUES (1, 'Tarea de prueba', 'Descripción');
    INSERT INTO comments (task_id, content, author) VALUES (1, 'Hola mundo', 'Usuario');
    INSERT INTO agent_executions (task_id, agent_id, state) VALUES (1, 'kiro', 'agent_working');
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolRouter integration tests", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test("internal tool get_task_comments routes to handler and returns data", async () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const call: ToolCall = { id: "tc_1", name: "get_task_comments", arguments: { taskId: 1 } };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(false);
    expect(result.toolCallId).toBe("tc_1");
    // Should contain the seeded comment
    expect(result.content).toContain("Hola mundo");
  });

  test("internal tool post_comment routes to handler and creates comment", async () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const call: ToolCall = {
      id: "tc_2",
      name: "post_comment",
      arguments: { taskId: 1, content: "Comentario del agente" },
    };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(false);
    expect(result.toolCallId).toBe("tc_2");

    // Verify comment was actually inserted in DB
    const comments = db.query("SELECT content FROM comments WHERE task_id = 1").all() as Array<{
      content: string;
    }>;
    expect(comments.some((c) => c.content === "Comentario del agente")).toBe(true);
  });

  test("internal tool get_task returns task context", async () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const call: ToolCall = { id: "tc_5", name: "get_task", arguments: { taskId: 1 } };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(false);
    expect(result.content).toContain("Tarea de prueba");
  });

  test("internal tool submit_for_review transitions execution state", async () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const call: ToolCall = {
      id: "tc_6",
      name: "submit_for_review",
      arguments: { taskId: 1, summary: "Trabajo completado" },
    };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(false);

    // Verify state transition in DB
    const exec = db.query("SELECT state FROM agent_executions WHERE task_id = 1").get() as {
      state: string;
    };
    expect(exec.state).toBe("pending_review");
  });

  test("external tool routes to MCP pool", async () => {
    const router = createToolRouter(db, createMockMcpPoolWithTools(), { toolTimeoutMs: 30000 });
    const call: ToolCall = { id: "tc_3", name: "external_tool", arguments: { query: "test" } };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(false);
    expect(result.content).toContain("external result");
  });

  test("unknown tool returns error ToolResult", async () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const call: ToolCall = { id: "tc_4", name: "nonexistent_tool", arguments: {} };

    const result = await router.executeTool(call);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("desconocida");
  });

  test("getAvailableTools includes internal + external tools", () => {
    const router = createToolRouter(db, createMockMcpPoolWithTools(), { toolTimeoutMs: 30000 });
    const tools = router.getAvailableTools();
    const names = tools.map((t) => t.name);

    // Internal tools
    expect(names).toContain("get_task");
    expect(names).toContain("get_task_comments");
    expect(names).toContain("post_comment");
    expect(names).toContain("submit_for_review");
    expect(names).toContain("get_attachment");

    // External tools
    expect(names).toContain("external_tool");
  });

  test("getAvailableTools with empty MCP pool only returns internal tools", () => {
    const router = createToolRouter(db, createMockMcpPool(), { toolTimeoutMs: 30000 });
    const tools = router.getAvailableTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("get_task");
    expect(names).toContain("post_comment");
    expect(names).not.toContain("external_tool");
  });
});
