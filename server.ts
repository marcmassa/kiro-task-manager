import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import db from "./db/database";
import path from "path";
import { existsSync, statSync, readdirSync, mkdirSync } from "node:fs";
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
import { decryptApiKey, encryptApiKey } from "./src/utils/crypto";
import {
  gitStatus,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPush,
  gitPull,
  gitBranches,
  gitCheckout,
  gitClone,
  slugify,
} from "./src/utils/gitOperations";

const PUBLIC_DIR = path.resolve(import.meta.dir, "public");
const PACKAGE_ROOT = import.meta.dir;

// FEAT-011: Multi-workspace / Server mode — workspaces directory (R24)
const WORKSPACES_DIR = process.env.WORKSPACES_DIR || "./workspaces";
if (!existsSync(WORKSPACES_DIR)) {
  mkdirSync(WORKSPACES_DIR, { recursive: true });
}

const agentEngine = new AgentEngine(db);

// ── FEAT-011: Workspace row mapper ──────────────────────────────────────────
function mapWorkspaceRow(row: any): any {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    repoPath: row.repo_path,
    repoRemoteUrl: row.repo_remote_url,
    repoDefaultBranch: row.repo_default_branch,
    repoStatus: row.repo_status,
    repoCurrentBranch: row.repo_current_branch,
    gitTokenConfigured: !!row.git_token_encrypted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    const { title, description, status, priority_id, category_id, due_date, workspace_id } =
      body as any;
    const result = db
      .prepare(
        "INSERT INTO tasks (title, description, status, priority_id, category_id, due_date, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        title,
        description || "",
        status || "todo",
        priority_id || 2,
        category_id || 1,
        due_date || null,
        workspace_id || 1,
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
    const { title, description, status, priority_id, category_id, due_date, workspace_id } =
      body as any;
    db.prepare(
      "UPDATE tasks SET title = ?, description = ?, status = ?, priority_id = ?, category_id = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(
      title,
      description || "",
      status,
      priority_id,
      category_id,
      due_date || null,
      workspace_id || 1,
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
        "SELECT repo_path, repo_remote_url, repo_default_branch, repo_status, repo_current_branch, git_token_encrypted FROM workspace_settings WHERE id = 1",
      )
      .get() as any;
    return {
      repoPath: row?.repo_path ?? null,
      repoRemoteUrl: row?.repo_remote_url ?? null,
      repoDefaultBranch: row?.repo_default_branch ?? "main",
      repoStatus: row?.repo_status ?? "not_configured",
      currentBranch: row?.repo_current_branch ?? null,
      gitTokenConfigured: !!row?.git_token_encrypted,
    };
  })

  .put("/api/workspace/repo", async ({ body, set }) => {
    const { repoPath, repoRemoteUrl, repoDefaultBranch, gitToken } = body as any;

    // Handle git token: encrypt and store (or clear)
    if (gitToken !== undefined) {
      if (gitToken && gitToken.trim()) {
        const encrypted = await encryptApiKey(gitToken.trim());
        db.prepare("UPDATE workspace_settings SET git_token_encrypted = ? WHERE id = 1").run(
          encrypted,
        );
      } else {
        // Clear token
        db.prepare("UPDATE workspace_settings SET git_token_encrypted = '' WHERE id = 1").run();
      }
    }

    if (repoPath === null || repoPath === undefined || repoPath.trim() === "") {
      // Disconnect / clear config
      db.prepare(
        "UPDATE workspace_settings SET repo_path = NULL, repo_remote_url = ?, repo_default_branch = ?, repo_status = 'not_configured', repo_current_branch = NULL WHERE id = 1",
      ).run(repoRemoteUrl ?? null, repoDefaultBranch ?? "main");
      const tokenRow = db
        .query("SELECT git_token_encrypted FROM workspace_settings WHERE id = 1")
        .get() as any;
      return {
        repoPath: null,
        repoRemoteUrl: repoRemoteUrl ?? null,
        repoDefaultBranch: repoDefaultBranch ?? "main",
        repoStatus: "not_configured",
        currentBranch: null,
        gitTokenConfigured: !!tokenRow?.git_token_encrypted,
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

    const tokenRow = db
      .query("SELECT git_token_encrypted FROM workspace_settings WHERE id = 1")
      .get() as any;
    return {
      repoPath: result.repoPath,
      repoRemoteUrl: repoRemoteUrl ?? null,
      repoDefaultBranch: repoDefaultBranch ?? "main",
      repoStatus: "connected",
      currentBranch: result.currentBranch,
      gitTokenConfigured: !!tokenRow?.git_token_encrypted,
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

  .put("/api/workspace/file", async ({ body, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado" };
    }
    const { path: filePath, content } = body as { path?: string; content?: string };
    if (!filePath || content === undefined || content === null) {
      set.status = 400;
      return { error: "Se requieren los campos 'path' y 'content'" };
    }
    const resolved = resolveInSandbox(ws.repo_path, filePath);
    if (!resolved) {
      set.status = 422;
      return { error: "Ruta inválida o fuera del directorio de trabajo" };
    }
    // Determine change type
    const existed = existsSync(resolved);
    const changeType = existed ? "modified" : "created";
    // Ensure parent directory exists
    const dir = path.dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // Write file
    await Bun.write(resolved, content);
    const size = Buffer.byteLength(content, "utf-8");
    // Register File_Change (manual edit, no agent_execution_id, task_id = 0)
    db.prepare(
      "INSERT INTO task_file_changes (task_id, file_path, change_type, agent_execution_id) VALUES (0, ?, ?, NULL)",
    ).run(filePath, changeType);
    return { ok: true, size };
  })

  .post("/api/workspace/upload", async ({ query, body, set }) => {
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
        return { error: "Ruta de directorio inválida o fuera del workspace" };
      }
      targetDir = resolved;
    } else {
      targetDir = ws.repo_path;
    }
    // Ensure target directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    // Handle multipart file upload
    const formData = body as any;
    const file = formData?.file;
    if (!file || !(file instanceof Blob)) {
      set.status = 400;
      return { error: "Se requiere un fichero en el campo 'file'" };
    }
    const filename = (file as File).name || "uploaded_file";
    const filePath = path.join(targetDir, filename);
    // Verify the resolved path is still in sandbox
    const relativePath = dirPath ? `${dirPath}/${filename}` : filename;
    const sandboxCheck = resolveInSandbox(ws.repo_path, relativePath);
    if (!sandboxCheck) {
      set.status = 422;
      return { error: "El nombre del fichero produce una ruta inválida" };
    }
    // Write the uploaded file
    const content = await file.arrayBuffer();
    await Bun.write(filePath, content);
    const size = content.byteLength;
    // Register File_Change
    db.prepare(
      "INSERT INTO task_file_changes (task_id, file_path, change_type, agent_execution_id) VALUES (0, ?, 'created', NULL)",
    ).run(relativePath);
    return { ok: true, filePath: relativePath, size };
  })

  .get("/api/workspace/changes", ({ query }) => {
    const limit = Number(query.limit) || 50;
    const rows = db
      .query(
        "SELECT id, task_id, file_path, change_type, agent_execution_id, created_at FROM task_file_changes ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      filePath: r.file_path,
      changeType: r.change_type,
      agentExecutionId: r.agent_execution_id,
      createdAt: r.created_at,
    }));
  })

  // ── FEAT-011: Git Operations (R16-R20) — Human-only endpoints ─────────────

  .get("/api/workspace/git/status", async ({ set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    try {
      const files = await gitStatus(ws.repo_path);
      return { files };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al obtener estado Git" };
    }
  })

  .post("/api/workspace/git/stage", async ({ body, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    const { paths } = body as { paths?: string[] };
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      set.status = 400;
      return { error: "Se requiere un array 'paths' con al menos un fichero" };
    }
    try {
      await gitStage(ws.repo_path, paths);
      return { ok: true };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al hacer stage" };
    }
  })

  .post("/api/workspace/git/unstage", async ({ body, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    const { paths } = body as { paths?: string[] };
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      set.status = 400;
      return { error: "Se requiere un array 'paths' con al menos un fichero" };
    }
    try {
      await gitUnstage(ws.repo_path, paths);
      return { ok: true };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al hacer unstage" };
    }
  })

  .post("/api/workspace/git/commit", async ({ body, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    const { message } = body as { message?: string };
    if (!message || !message.trim()) {
      set.status = 400;
      return { error: "Se requiere un mensaje de commit" };
    }
    try {
      const hash = await gitCommit(ws.repo_path, message.trim());
      return { ok: true, hash };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al hacer commit" };
    }
  })

  .post("/api/workspace/git/push", async ({ set }) => {
    const ws = db
      .query(
        "SELECT repo_path, repo_status, git_token_encrypted FROM workspace_settings WHERE id = 1",
      )
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    if (!ws.git_token_encrypted) {
      set.status = 422;
      return { error: "Se requiere configurar un token de acceso en Configuración" };
    }
    try {
      await gitPush(ws.repo_path, ws.git_token_encrypted);
      return { ok: true };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al hacer push" };
    }
  })

  .post("/api/workspace/git/pull", async ({ set }) => {
    const ws = db
      .query(
        "SELECT repo_path, repo_status, git_token_encrypted FROM workspace_settings WHERE id = 1",
      )
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    if (!ws.git_token_encrypted) {
      set.status = 422;
      return { error: "Se requiere configurar un token de acceso en Configuración" };
    }
    try {
      await gitPull(ws.repo_path, ws.git_token_encrypted);
      return { ok: true };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al hacer pull" };
    }
  })

  .get("/api/workspace/git/branches", async ({ set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    try {
      const info = await gitBranches(ws.repo_path);
      return info;
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al listar ramas" };
    }
  })

  .post("/api/workspace/git/checkout", async ({ body, set }) => {
    const ws = db
      .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
      .get() as any;
    if (!ws || ws.repo_status !== "connected" || !ws.repo_path) {
      set.status = 422;
      return { error: "Repositorio no configurado o desconectado" };
    }
    const { branch, create } = body as { branch?: string; create?: boolean };
    if (!branch || !branch.trim()) {
      set.status = 400;
      return { error: "Se requiere el nombre de la rama" };
    }
    try {
      await gitCheckout(ws.repo_path, branch.trim(), create);
      // Update current branch in DB
      db.prepare("UPDATE workspace_settings SET repo_current_branch = ? WHERE id = 1").run(
        branch.trim(),
      );
      return { ok: true, branch: branch.trim() };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Error al cambiar de rama" };
    }
  })

  // ── FEAT-011: Multi-Workspace CRUD (R22-R25) ────────────────────────────────

  .get("/api/workspaces", () => {
    const rows = db.query("SELECT * FROM workspaces ORDER BY id").all();
    return (rows as any[]).map(mapWorkspaceRow);
  })

  .get("/api/workspaces/:id", ({ params, set }) => {
    const row = db.query("SELECT * FROM workspaces WHERE id = ?").get(Number(params.id)) as any;
    if (!row) {
      set.status = 404;
      return { error: "Workspace no encontrado" };
    }
    return mapWorkspaceRow(row);
  })

  .post("/api/workspaces", ({ body, set }) => {
    const { name, remoteUrl, branch } = body as any;
    if (!name?.trim()) {
      set.status = 422;
      return { error: "El nombre es obligatorio" };
    }
    const slug = slugify(name.trim());
    try {
      db.prepare(
        "INSERT INTO workspaces (name, slug, repo_remote_url, repo_default_branch) VALUES (?, ?, ?, ?)",
      ).run(name.trim(), slug, remoteUrl ?? null, branch ?? "main");
    } catch (e: any) {
      if (e.message?.includes("UNIQUE")) {
        set.status = 409;
        return { error: "Ya existe un workspace con ese nombre" };
      }
      throw e;
    }
    const id = (db.query("SELECT last_insert_rowid() AS id").get() as any).id;
    return mapWorkspaceRow(db.query("SELECT * FROM workspaces WHERE id = ?").get(id));
  })

  .put("/api/workspaces/:id", async ({ params, body, set }) => {
    const id = Number(params.id);
    const row = db.query("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
    if (!row) {
      set.status = 404;
      return { error: "Workspace no encontrado" };
    }
    const { name, repoPath, remoteUrl, branch, gitToken } = body as any;

    // Handle token encryption
    let tokenValue = row.git_token_encrypted;
    if (gitToken !== undefined) {
      tokenValue = gitToken ? await encryptApiKey(gitToken) : "";
    }

    // Validate repoPath if provided
    let repoStatus = row.repo_status;
    let currentBranch = row.repo_current_branch;
    if (repoPath !== undefined) {
      if (repoPath) {
        const validation = validateRepoPath(repoPath);
        if (!validation.ok) {
          set.status = 422;
          return { code: validation.code, message: validation.message };
        }
        repoStatus = "connected";
        currentBranch = validation.currentBranch;
      } else {
        repoStatus = "not_configured";
        currentBranch = null;
      }
    }

    db.prepare(
      "UPDATE workspaces SET name = COALESCE(?, name), slug = COALESCE(?, slug), repo_path = ?, repo_remote_url = ?, repo_default_branch = ?, repo_status = ?, repo_current_branch = ?, git_token_encrypted = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(
      name?.trim() ?? null,
      name ? slugify(name.trim()) : null,
      repoPath ?? row.repo_path,
      remoteUrl ?? row.repo_remote_url,
      branch ?? row.repo_default_branch,
      repoStatus,
      currentBranch,
      tokenValue,
      id,
    );
    return mapWorkspaceRow(db.query("SELECT * FROM workspaces WHERE id = ?").get(id));
  })

  .delete("/api/workspaces/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (id === 1) {
      set.status = 422;
      return { error: "No se puede eliminar el workspace por defecto" };
    }
    db.prepare("UPDATE tasks SET workspace_id = 1 WHERE workspace_id = ?").run(id);
    db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    return { ok: true };
  })

  // Clone endpoint (R21)
  .post("/api/workspaces/:id/clone", async ({ params, set }) => {
    const id = Number(params.id);
    const row = db.query("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
    if (!row) {
      set.status = 404;
      return { error: "Workspace no encontrado" };
    }
    if (!row.repo_remote_url) {
      set.status = 422;
      return { error: "No hay URL remota configurada" };
    }
    const localDir = path.resolve(WORKSPACES_DIR, row.slug);
    if (existsSync(localDir)) {
      set.status = 409;
      return { error: "El directorio ya existe. Elimínalo primero o usa 'Usar existente'." };
    }
    db.prepare("UPDATE workspaces SET repo_status = 'cloning' WHERE id = ?").run(id);
    try {
      await gitClone(
        row.repo_remote_url,
        localDir,
        row.repo_default_branch || undefined,
        row.git_token_encrypted || undefined,
      );
      db.prepare(
        "UPDATE workspaces SET repo_path = ?, repo_status = 'connected', repo_current_branch = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(localDir, row.repo_default_branch || "main", id);
      return { ok: true, repoPath: localDir };
    } catch (e: any) {
      db.prepare(
        "UPDATE workspaces SET repo_status = 'error', updated_at = datetime('now') WHERE id = ?",
      ).run(id);
      set.status = 500;
      return { error: e.message || "Error al clonar" };
    }
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
