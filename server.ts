import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import db from "./db/database";
import path from "path";
import { existsSync, statSync, readdirSync } from "node:fs";
import { AgentEngine } from "./src/agent/engine";
import {
  validateRepoPath,
  validateFilePath,
  resolveInSandbox,
} from "./src/utils/gitPathValidation";
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

  // ── FEAT-011: Workspace Git routes ────────────────────────────────────────

  .get("/api/workspace/repo", () => {
    const row = db
      .query(
        "SELECT repo_path, repo_remote_url, repo_default_branch, repo_status, repo_current_branch FROM workspace_settings WHERE id = 1",
      )
      .get() as any;
    return {
      repoPath: row?.repo_path ?? null,
      repoRemoteUrl: row?.repo_remote_url ?? null,
      repoDefaultBranch: row?.repo_default_branch ?? "main",
      repoStatus: row?.repo_status ?? "not_configured",
      currentBranch: row?.repo_current_branch ?? null,
    };
  })

  .put("/api/workspace/repo", ({ body, set }) => {
    const { repoPath, repoRemoteUrl, repoDefaultBranch } = body as any;

    if (repoPath === null || repoPath === undefined || repoPath.trim() === "") {
      // Disconnect / clear config
      db.prepare(
        "UPDATE workspace_settings SET repo_path = NULL, repo_remote_url = ?, repo_default_branch = ?, repo_status = 'not_configured', repo_current_branch = NULL WHERE id = 1",
      ).run(repoRemoteUrl ?? null, repoDefaultBranch ?? "main");
      return {
        repoPath: null,
        repoRemoteUrl: repoRemoteUrl ?? null,
        repoDefaultBranch: repoDefaultBranch ?? "main",
        repoStatus: "not_configured",
        currentBranch: null,
      };
    }

    // Validate
    const result = validateRepoPath(repoPath);
    if (!result.ok) {
      set.status = 422;
      return { code: result.code, message: result.message };
    }

    // Save
    db.prepare(
      "UPDATE workspace_settings SET repo_path = ?, repo_remote_url = ?, repo_default_branch = ?, repo_status = 'connected', repo_current_branch = ? WHERE id = 1",
    ).run(
      result.repoPath,
      repoRemoteUrl ?? null,
      repoDefaultBranch ?? "main",
      result.currentBranch,
    );

    return {
      repoPath: result.repoPath,
      repoRemoteUrl: repoRemoteUrl ?? null,
      repoDefaultBranch: repoDefaultBranch ?? "main",
      repoStatus: "connected",
      currentBranch: result.currentBranch,
    };
  })

  .post("/api/workspace/repo/validate", ({ body, set }) => {
    const { repoPath } = body as any;
    if (!repoPath) {
      set.status = 422;
      return {
        ok: false,
        code: "EMPTY_PATH",
        message: "La ruta del repositorio no puede estar vacía",
      };
    }
    return validateRepoPath(repoPath);
  })

  .get("/api/tasks/:id/files", ({ params, set }) => {
    const ws = db.query("SELECT repo_status FROM workspace_settings WHERE id = 1").get() as any;
    if (!ws || ws.repo_status === "not_configured") {
      set.status = 422;
      return { error: "Se requiere configurar un repositorio en Configuración" };
    }
    const files = db
      .query(
        "SELECT id, task_id, file_path, reference_type, created_at FROM task_file_references WHERE task_id = ? ORDER BY created_at",
      )
      .all(Number(params.id));
    return (files as any[]).map((f) => ({
      id: f.id,
      taskId: f.task_id,
      filePath: f.file_path,
      referenceType: f.reference_type,
      createdAt: f.created_at,
    }));
  })

  .post("/api/tasks/:id/files", ({ params, body, set }) => {
    const ws = db.query("SELECT repo_status FROM workspace_settings WHERE id = 1").get() as any;
    if (!ws || ws.repo_status === "not_configured") {
      set.status = 422;
      return { error: "Se requiere configurar un repositorio en Configuración" };
    }
    const { filePath, referenceType } = body as any;
    const validation = validateFilePath(filePath ?? "");
    if (!validation.ok) {
      set.status = 422;
      return { code: validation.code, message: validation.message };
    }
    const stmt = db.prepare(
      "INSERT INTO task_file_references (task_id, file_path, reference_type) VALUES (?, ?, ?)",
    );
    stmt.run(Number(params.id), validation.normalizedPath, referenceType ?? "context");
    const id = (db.query("SELECT last_insert_rowid() AS id").get() as any).id;
    const row = db.query("SELECT * FROM task_file_references WHERE id = ?").get(id) as any;
    return {
      id: row.id,
      taskId: row.task_id,
      filePath: row.file_path,
      referenceType: row.reference_type,
      createdAt: row.created_at,
    };
  })

  .delete("/api/tasks/:id/files/:fileId", ({ params, set }) => {
    const result = db
      .prepare("DELETE FROM task_file_references WHERE id = ? AND task_id = ?")
      .run(Number(params.fileId), Number(params.id));
    if (result.changes === 0) {
      set.status = 404;
      return { error: "Referencia no encontrada" };
    }
    return { deleted: true };
  })

  .get("/api/tasks/:id/changes", ({ params, query }) => {
    const taskId = Number(params.id);
    let sql =
      "SELECT id, task_id, file_path, change_type, agent_execution_id, created_at FROM task_file_changes WHERE task_id = ?";
    const args: any[] = [taskId];
    if (query.execution_id) {
      sql += " AND agent_execution_id = ?";
      args.push(Number(query.execution_id));
    }
    sql += " ORDER BY created_at";
    const rows = db.query(sql).all(...args);
    return (rows as any[]).map((r) => ({
      id: r.id,
      taskId: r.task_id,
      filePath: r.file_path,
      changeType: r.change_type,
      agentExecutionId: r.agent_execution_id,
      createdAt: r.created_at,
    }));
  })

  .get("/api/workspace/file", async ({ query, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado" };
    }
    const filePath = query.path as string;
    if (!filePath) {
      set.status = 422;
      return { error: "Se requiere el parámetro path" };
    }
    const resolved = resolveInSandbox(ws.repo_path, filePath);
    if (!resolved) {
      set.status = 422;
      return { error: "Ruta inválida o fuera del directorio de trabajo" };
    }
    if (!existsSync(resolved)) {
      set.status = 404;
      return { error: `Fichero no encontrado: ${filePath}` };
    }
    const stat = statSync(resolved);
    if (stat.size > 1024 * 1024) {
      set.status = 422;
      return { error: "Fichero demasiado grande (máximo 1 MB)" };
    }
    const content = await Bun.file(resolved).text();
    const ext = filePath.split(".").pop() ?? "";
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      css: "css",
      json: "json",
      md: "markdown",
      html: "html",
      py: "python",
      rs: "rust",
      go: "go",
    };
    return { content, size: stat.size, language: languageMap[ext] ?? "plaintext" };
  })

  .get("/api/workspace/tree", ({ query, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado" };
    }
    const dirPath = (query.path as string) || "";
    let targetDir: string;
    if (dirPath) {
      const resolved = resolveInSandbox(ws.repo_path, dirPath);
      if (!resolved) {
        set.status = 422;
        return { error: "Ruta inválida o fuera del directorio de trabajo" };
      }
      targetDir = resolved;
    } else {
      targetDir = ws.repo_path;
    }
    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
      set.status = 404;
      return { error: "Directorio no encontrado" };
    }
    const IGNORED = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      "__pycache__",
      ".next",
      ".cache",
    ]);
    const entries = readdirSync(targetDir, { withFileTypes: true })
      .filter((e) => !IGNORED.has(e.name))
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        size: e.isDirectory() ? 0 : statSync(path.join(targetDir, e.name)).size,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { entries };
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
