import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import db from "./db/database";
import path from "path";
import { AgentEngine } from "./src/agent/engine";
import {
  getSettings,
  patchWorkspaceSettings,
  patchNotificationSettings,
  getLinearStatus,
  connectLinear,
  disconnectLinear,
  syncLinear,
  exportAttachmentResponse,
  deleteAllTasks,
} from "./src/utils/settingsHandlers";
import {
  listAgents,
  assignAgent,
  getExecution,
  listAllExecutions,
  approveExecution,
  requestChanges,
  listAttachments,
  createAttachment,
  getAttachmentRecord,
  deleteAttachment,
  resolveAttachmentPath,
} from "./src/utils/agentHandlers";
import {
  getAiProviderConfig,
  saveAiProviderConfig,
  deleteAiProviderConfig,
  testAiProviderConnection,
} from "./src/utils/aiProviderHandlers";
import { PROVIDER_REGISTRY } from "./src/utils/aiProviderConfig";
import {
  listMcpServers,
  createMcpServer,
  updateMcpServer,
  toggleMcpServer,
  deleteMcpServer,
  applyMcpConfig,
} from "./src/utils/mcpHandlers";
import { probeMcpServer } from "./src/utils/mcpProbe";
import { decryptApiKey } from "./src/utils/crypto";

const PUBLIC_DIR = path.resolve(import.meta.dir, "public");
const PACKAGE_ROOT = import.meta.dir;

const agentEngine = new AgentEngine(db);

const app = new Elysia()
  .use(cors())

  // Serve static files from public directory
  .get("/styles.css", () => Bun.file(path.join(PUBLIC_DIR, "styles.css")))
  .get("/dist/index.js", () => Bun.file(path.join(PUBLIC_DIR, "dist/index.js")))

  // Get all tasks with related data
  .get("/api/tasks", () => {
    const tasks = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `,
      )
      .all();
    return tasks;
  })

  // Get single task
  .get("/api/tasks/:id", ({ params }) => {
    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    if (!task) return new Response("Task not found", { status: 404 });
    return task;
  })

  // Create task
  .post("/api/tasks", ({ body }) => {
    const { title, description, status, priority_id, category_id, due_date } = body as any;
    const result = db
      .prepare(
        "INSERT INTO tasks (title, description, status, priority_id, category_id, due_date) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        title,
        description || "",
        status || "todo",
        priority_id || 2,
        category_id || 1,
        due_date || null,
      );

    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(result.lastInsertRowid);
    return task;
  })

  // Update task
  .put("/api/tasks/:id", ({ params, body }) => {
    const { title, description, status, priority_id, category_id, due_date } = body as any;
    db.prepare(
      "UPDATE tasks SET title = ?, description = ?, status = ?, priority_id = ?, category_id = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(title, description || "", status, priority_id, category_id, due_date || null, params.id);

    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    return task;
  })

  // Update task status only
  .patch("/api/tasks/:id/status", ({ params, body }) => {
    const { status } = body as any;
    db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      params.id,
    );
    const task = db
      .query(
        `
      SELECT t.*, p.name as priority_name, p.color as priority_color, p.level as priority_level,
             c.name as category_name, c.color as category_color
      FROM tasks t
      JOIN priorities p ON t.priority_id = p.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `,
      )
      .get(params.id);
    return task;
  })

  // Delete task
  .delete("/api/tasks/:id", ({ params }) => {
    db.prepare("DELETE FROM comments WHERE task_id = ?").run(params.id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(params.id);
    return { success: true };
  })

  // Get comments for a task
  .get("/api/tasks/:id/comments", ({ params }) => {
    return db
      .query("SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC")
      .all(params.id);
  })

  // Add comment to a task
  .post("/api/tasks/:id/comments", ({ params, body }) => {
    const { content, author } = body as any;
    const result = db
      .prepare("INSERT INTO comments (task_id, content, author) VALUES (?, ?, ?)")
      .run(params.id, content, author || "Usuario");
    return db.query("SELECT * FROM comments WHERE id = ?").get(result.lastInsertRowid);
  })

  // Get categories
  .get("/api/categories", () => {
    return db.query("SELECT * FROM categories ORDER BY name").all();
  })

  // Get priorities
  .get("/api/priorities", () => {
    return db.query("SELECT * FROM priorities ORDER BY level").all();
  })

  // ── FEAT-005: Settings + Integrations + Export + Delete-all ──────────────

  .get("/api/settings", () => getSettings(db))

  .patch("/api/settings/workspace", ({ body, set }) => {
    const result = patchWorkspaceSettings(db, body as any);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .patch("/api/settings/notifications", ({ body, set }) => {
    const result = patchNotificationSettings(db, body as any);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .get("/api/integrations/linear", () => getLinearStatus(db))

  .post("/api/integrations/linear/connect", async ({ body, set }) => {
    const result = await connectLinear(db, body as any);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/integrations/linear/sync", ({ set }) => {
    const result = syncLinear(db);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .delete("/api/integrations/linear", () => disconnectLinear(db).body)

  .get("/api/export", () => exportAttachmentResponse(db))

  .delete("/api/tasks/all", () => deleteAllTasks(db).body)

  // ── FEAT-006: Agent orchestration ───────────────────────────────────────

  .get("/api/agents", () => listAgents(db).body)

  .get("/api/executions", () => listAllExecutions(db).body)

  .post("/api/tasks/:id/assign", ({ params, body, set }) => {
    const { agentId } = body as { agentId: string };
    const result = assignAgent(db, Number(params.id), agentId);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .get("/api/tasks/:id/execution", ({ params }) => {
    const result = getExecution(db, Number(params.id));
    return new Response(JSON.stringify(result.body), {
      headers: { "Content-Type": "application/json" },
    });
  })

  .post("/api/tasks/:id/execution/approve", ({ params, set }) => {
    const result = approveExecution(db, Number(params.id));
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/tasks/:id/execution/request-changes", ({ params, body, set }) => {
    const { feedback } = body as { feedback: string };
    const result = requestChanges(db, Number(params.id), feedback);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  // ── FEAT-006: Attachments ────────────────────────────────────────────────

  .get("/api/tasks/:id/attachments", ({ params }) => listAttachments(db, Number(params.id)).body)

  .post("/api/tasks/:id/attachments", async ({ params, request, set }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      set.status = 400;
      return { error: "No se recibió ningún archivo" };
    }
    const bytes = await file.arrayBuffer();
    const result = await createAttachment(
      db,
      Number(params.id),
      { name: file.name, type: file.type, bytes },
      PACKAGE_ROOT,
    );
    if (result.status !== 201) set.status = result.status;
    return result.body;
  })

  .get("/api/attachments/:id/download", ({ params, set }) => {
    const row = getAttachmentRecord(db, Number(params.id));
    if (!row) {
      set.status = 404;
      return { error: "Adjunto no encontrado" };
    }
    const abs = resolveAttachmentPath(PACKAGE_ROOT, row.stored_path);
    return new Response(Bun.file(abs), {
      headers: {
        "Content-Type": row.mime_type,
        "Content-Disposition": `attachment; filename="${row.filename}"`,
      },
    });
  })

  .delete("/api/attachments/:id", ({ params, set }) => {
    const result = deleteAttachment(db, Number(params.id), PACKAGE_ROOT);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  // ── FEAT-009: AI Provider Configuration ───────────────────────────────────

  .get("/api/ai-provider", async ({ set }) => {
    const result = await getAiProviderConfig(db);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .put("/api/ai-provider", async ({ body, set }) => {
    const result = await saveAiProviderConfig(db, body);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .delete("/api/ai-provider", ({ set }) => {
    const result = deleteAiProviderConfig(db);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/ai-provider/test", async ({ body, set }) => {
    const result = await testAiProviderConnection(body);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .get("/api/ai-provider/registry", () => PROVIDER_REGISTRY)

  // ── FEAT-007: MCP Servers Registry ─────────────────────────────────────────

  .get("/api/mcp-servers", async ({ set }) => {
    const result = await listMcpServers(db);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/mcp-servers", async ({ body, set }) => {
    const result = await createMcpServer(db, body);
    if (result.status >= 300) set.status = result.status;
    return result.body;
  })

  .post("/api/mcp-servers/apply", async ({ set }) => {
    const result = await applyMcpConfig(db);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .patch("/api/mcp-servers/:id", async ({ params, body, set }) => {
    const result = await updateMcpServer(db, Number(params.id), body);
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .delete("/api/mcp-servers/:id", ({ params, set }) => {
    const result = deleteMcpServer(db, Number(params.id));
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/mcp-servers/:id/toggle", async ({ params, set }) => {
    const result = await toggleMcpServer(db, Number(params.id));
    if (result.status !== 200) set.status = result.status;
    return result.body;
  })

  .post("/api/mcp-servers/:id/test", async ({ params, set }) => {
    const row = db.query("SELECT * FROM mcp_servers WHERE id = ?").get(Number(params.id)) as any;
    if (!row) {
      set.status = 404;
      return { error: "Servidor no encontrado" };
    }
    let env: Record<string, string> = {};
    if (row.env_encrypted) {
      const decrypted = await decryptApiKey(row.env_encrypted);
      env = JSON.parse(decrypted);
    }
    const result = await probeMcpServer({
      transport: row.transport,
      command: row.command,
      args: JSON.parse(row.args),
      env,
      url: row.url,
    });
    return result;
  })

  // ── FEAT-010: Agent Engine routes ─────────────────────────────────────────

  .get("/api/agent/status", () => {
    return agentEngine.getStatus();
  })

  .get("/api/agent/config", () => {
    return agentEngine.getConfig();
  })

  .put("/api/agent/config", async ({ body, set }) => {
    try {
      agentEngine.updateConfig(body as Partial<import("./src/agent/types").AgentEngineConfig>);
      return agentEngine.getConfig();
    } catch (error) {
      set.status = 400;
      return { error: error instanceof Error ? error.message : "Error al actualizar config" };
    }
  })

  .post("/api/agent/run", async ({ set }) => {
    const result = await agentEngine.runCycle();
    if (!result.ok) {
      set.status = result.taskId ? 500 : 409;
    }
    return result;
  })

  // Serve index.html for all non-API routes (SPA fallback)
  .get("/*", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(Bun.file(path.join(PUBLIC_DIR, "index.html")), {
      headers: { "Content-Type": "text/html" },
    });
  });

// Start the server only when this file is run directly (not when imported
// for tests in the future — server.ts is the production entry point).
if (import.meta.main) {
  app.listen(3000);
  console.log(`🚀 Task Manager running at http://localhost:3000`);

  // FEAT-010: Initialize agent engine (connects MCP, starts loop if configured)
  agentEngine.init().catch((err) => {
    console.error("⚠️ Agent engine initialization failed:", err.message);
  });
}

export { app };
