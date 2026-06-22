import type { Database } from "bun:sqlite";
import type {
  EngineStatus,
  AgentEngineConfig,
  AgentStatusResponse,
  TaskContext,
  Message,
  ToolDefinition,
} from "./types";
import type { McpClientPool } from "./mcpClientPool";
import type { ToolRouter } from "./toolRouter";
import type { ProviderAdapter } from "./providerAdapter";
import type { RepoPromptContext } from "../utils/gitTypes";
import { createProviderAdapter } from "./providerAdapter";
import { createToolRouter } from "./toolRouter";
import { createMcpClientPool } from "./mcpClientPool";
import { buildSystemPrompt } from "./systemPrompt";
import { getActiveProviderConfig } from "../utils/aiProviderHandlers";
import { claimTask, postComment, submitForReview, getTask, getTaskComments } from "../mcp/handlers";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Función pura: calcula el delay de reintento con backoff exponencial.
 * Implementa: min(baseDelayMs * 2^attempt, maxDelayMs).
 * Siempre retorna un valor positivo.
 */
export function computeRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
}

/**
 * Verifica si un error es de autenticación (401/403).
 * Los errores de auth no se reintentan.
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("401") || error.message.includes("403");
  }
  return false;
}

/** Directorios ignorados al construir el árbol de primer nivel del repo. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  ".cache",
]);

/**
 * Motor principal del agente autónomo.
 * Orquesta el ciclo de polling → claim → procesamiento → submit.
 *
 * Cubre: R1.1–R1.5, R2.1, R5.1–R5.5, R7.1–R7.3, R8.1–R8.5, R10.2, R12.1, R12.3, R13.3
 */
export class AgentEngine {
  private status: EngineStatus = "disabled";
  private intervalId: Timer | null = null;
  private currentTaskId: number | null = null;
  private currentTaskTitle: string | null = null;
  private lastError: string | null = null;
  private lastCycleAt: string | null = null;
  private processing: boolean = false;
  private pollCycleCount: number = 0;
  private mcpPool: McpClientPool;
  private toolRouter: ToolRouter | null = null;
  private config: AgentEngineConfig;

  constructor(private db: Database) {
    this.mcpPool = createMcpClientPool(db);
    this.config = this.loadConfig();
  }

  /** Inicializa el engine: conecta MCP, crea router, inicia loop si aplica. */
  async init(): Promise<void> {
    this.config = this.loadConfig();
    await this.mcpPool.initialize();
    this.toolRouter = createToolRouter(this.db, this.mcpPool, {
      toolTimeoutMs: this.config.toolTimeoutMs,
    });

    const providerConfig = await getActiveProviderConfig(this.db);
    if (providerConfig && this.config.autoStart) {
      this.start();
    } else if (!providerConfig) {
      this.status = "disabled";
    }
  }

  /** Inicia el loop de polling. */
  start(): void {
    if (this.intervalId) return;
    this.status = "idle";
    this.intervalId = setInterval(async () => {
      await this.runCycle();
      this.pollCycleCount++;
      // Reconectar MCP cada 5 ciclos
      if (this.pollCycleCount % 5 === 0) {
        await this.mcpPool.reconnectFailed();
      }
      // Verificar salud del repositorio
      this.checkRepoHealth();
    }, this.config.pollIntervalMs);
  }

  /** Detiene el loop de polling. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (!this.processing) {
      this.status = "disabled";
    }
  }

  /** Ejecuta un ciclo completo del agente (poll → claim → process → submit). */
  async runCycle(): Promise<{ ok: boolean; taskId?: number; message: string }> {
    if (this.processing) {
      return { ok: false, message: "El agente está ocupado" };
    }

    const providerConfig = await getActiveProviderConfig(this.db);
    if (!providerConfig) {
      this.status = "disabled";
      return { ok: false, message: "Proveedor de IA no configurado" };
    }

    // Buscar tarea asignada al agente
    const taskRow = this.db
      .query(
        `SELECT t.id, t.title FROM tasks t
         JOIN agent_executions e ON e.task_id = t.id
         WHERE e.state = 'assigned' AND e.agent_id = 'kiro'
         ORDER BY e.created_at ASC LIMIT 1`,
      )
      .get() as { id: number; title: string } | null;

    if (!taskRow) {
      return { ok: true, message: "No hay tareas pendientes" };
    }

    const taskId = taskRow.id;
    this.processing = true;
    this.status = "working";
    this.currentTaskId = taskId;
    this.currentTaskTitle = taskRow.title;

    try {
      // Reclamar la tarea (assigned → agent_working)
      const claimResult = claimTask(this.db, taskId);
      if (!claimResult.ok) {
        this.processing = false;
        this.status = "idle";
        this.currentTaskId = null;
        this.currentTaskTitle = null;
        return { ok: false, taskId, message: claimResult.error };
      }

      // Procesar la tarea (tool-use loop)
      await this.processTask(taskId);

      return { ok: true, taskId, message: "Tarea procesada" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      this.lastError = errorMsg;
      this.status = "error";

      // Publicar comentario de error en la tarea
      try {
        postComment(this.db, taskId, `❌ Error durante el procesamiento: ${errorMsg}`);
      } catch {
        // No propagar errores de comentario
      }

      return { ok: false, taskId, message: errorMsg };
    } finally {
      this.processing = false;
      this.status = "idle";
      this.currentTaskId = null;
      this.currentTaskTitle = null;
      this.lastCycleAt = new Date().toISOString();
    }
  }

  /** Retorna el estado público del engine para la API. */
  getStatus(): AgentStatusResponse {
    return {
      status: this.status,
      currentTaskId: this.currentTaskId,
      currentTaskTitle: this.currentTaskTitle,
      lastError: this.lastError,
      lastCycleAt: this.lastCycleAt,
    };
  }

  /** Retorna la configuración actual del engine desde DB. */
  getConfig(): AgentEngineConfig {
    return this.config;
  }

  /** Actualiza la configuración y aplica hot-reload si es necesario. */
  updateConfig(partial: Partial<AgentEngineConfig>): void {
    const prevPollInterval = this.config.pollIntervalMs;
    const prevAutoStart = this.config.autoStart;

    // Construir nuevo config con los campos actualizados
    const updated = { ...this.config, ...partial };

    // Persistir en DB
    this.db
      .prepare(
        `UPDATE agent_engine_config SET
         auto_start = ?,
         poll_interval_ms = ?,
         max_iterations = ?,
         max_retries = ?,
         tool_timeout_ms = ?
         WHERE id = 1`,
      )
      .run(
        updated.autoStart ? 1 : 0,
        updated.pollIntervalMs,
        updated.maxIterations,
        updated.maxRetries,
        updated.toolTimeoutMs,
      );

    this.config = updated;

    // Hot-reload: si pollIntervalMs cambió y el loop está activo, reiniciar
    if (updated.pollIntervalMs !== prevPollInterval && this.intervalId) {
      this.stop();
      this.start();
    }

    // Si autoStart cambió a false y el loop está activo, detener
    if (!updated.autoStart && prevAutoStart && this.intervalId) {
      this.stop();
    }
  }

  /**
   * Procesa una tarea reclamada a través del loop de tool-use.
   * Construye el prompt, itera con el LLM y ejecuta herramientas.
   */
  private async processTask(taskId: number): Promise<void> {
    // 1. Cargar contexto completo de la tarea
    const taskContext = this.loadTaskContext(taskId);

    // 2. Check repo configuration
    let repoConfig: { workingDir: string; taskId: number; executionId: number | null } | undefined;
    let repoContext: RepoPromptContext | undefined;

    const repoRow = this.db
      .query(
        "SELECT repo_path, repo_status, repo_current_branch FROM workspace_settings WHERE id = 1",
      )
      .get() as {
      repo_path: string | null;
      repo_status: string | null;
      repo_current_branch: string | null;
    } | null;

    if (repoRow?.repo_status === "connected" && repoRow?.repo_path) {
      // Get current execution id
      const execRow = this.db
        .query(
          "SELECT id FROM agent_executions WHERE task_id = ? AND state = 'agent_working' ORDER BY created_at DESC LIMIT 1",
        )
        .get(taskId) as { id: number } | null;

      repoConfig = {
        workingDir: repoRow.repo_path,
        taskId,
        executionId: execRow?.id ?? null,
      };

      // Build directory tree (first level)
      try {
        const entries = readdirSync(repoRow.repo_path, { withFileTypes: true })
          .filter((e) => !IGNORED_DIRS.has(e.name))
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort()
          .join("\n");

        // Get context file references
        const contextFiles = this.db
          .query(
            "SELECT file_path FROM task_file_references WHERE task_id = ? AND reference_type = 'context'",
          )
          .all(taskId) as Array<{ file_path: string }>;

        repoContext = {
          workingDir: repoRow.repo_path,
          currentBranch: repoRow.repo_current_branch ?? "main",
          directoryTree: entries,
          contextFiles: contextFiles.map((f) => f.file_path),
        };
      } catch {
        // If we can't read the directory, skip repo context
      }
    }

    // 3. Create tool router with repoConfig
    const toolRouter = createToolRouter(
      this.db,
      this.mcpPool,
      { toolTimeoutMs: this.config.toolTimeoutMs },
      repoConfig,
    );

    // 4. Obtener herramientas disponibles
    const tools: ToolDefinition[] = toolRouter.getAvailableTools();

    // 5. Construir system prompt
    const systemPrompt = buildSystemPrompt(taskContext, tools, repoContext);

    // 6. Publicar comentario de inicio
    postComment(this.db, taskId, "🤖 Comenzando a trabajar en la tarea...");

    // 7. Crear mensajes iniciales
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Ejecuta la tarea descrita en el system prompt." },
    ];

    // 8. Crear provider adapter
    const providerConfig = await getActiveProviderConfig(this.db);
    if (!providerConfig) {
      throw new Error("Proveedor de IA no configurado");
    }
    const adapter: ProviderAdapter = createProviderAdapter(providerConfig);

    // 9. Tool-use loop
    let summary = "";
    for (let i = 0; i < this.config.maxIterations; i++) {
      // Llamada al LLM con reintentos
      const response = await this.sendWithRetry(adapter, messages, tools);

      if (response.type === "text") {
        summary = response.content;
        break;
      }

      // type === "tool_use"
      // Agregar mensaje del asistente con toolCalls
      messages.push({
        role: "assistant",
        content: "",
        toolCalls: response.toolCalls,
      });

      // Ejecutar cada herramienta y agregar resultados
      for (const toolCall of response.toolCalls) {
        const result = await toolRouter.executeTool(toolCall);

        messages.push({
          role: "tool",
          content: result.content,
          toolCallId: result.toolCallId,
        });
      }
    }

    // Si el loop se agotó sin respuesta de texto
    if (!summary) {
      summary = "Se alcanzó el límite de iteraciones";
    }

    // 10. Publicar comentario resumen
    postComment(this.db, taskId, summary);

    // 11. Enviar a revisión
    const reviewResult = submitForReview(this.db, taskId, summary);
    if (!reviewResult.ok) {
      postComment(this.db, taskId, `⚠️ No se pudo enviar a revisión: ${reviewResult.error}`);
    }
  }

  /**
   * Envía mensajes al LLM con lógica de reintento y backoff exponencial.
   * No reintenta errores de autenticación (401/403).
   */
  private async sendWithRetry(
    adapter: ProviderAdapter,
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<import("./types").LLMResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await adapter.sendMessage(messages, tools);
      } catch (error) {
        lastError = error;
        if (isAuthError(error)) throw error;
        if (attempt === this.config.maxRetries) throw error;
        await Bun.sleep(computeRetryDelay(attempt, 1000, 30000));
      }
    }
    // No debería llegar aquí, pero TypeScript necesita el throw
    throw lastError;
  }

  /**
   * Lee la configuración del engine desde la tabla agent_engine_config.
   */
  private loadConfig(): AgentEngineConfig {
    const row = this.db.query("SELECT * FROM agent_engine_config WHERE id = 1").get() as {
      auto_start: number;
      poll_interval_ms: number;
      max_iterations: number;
      max_retries: number;
      tool_timeout_ms: number;
    } | null;

    if (!row) {
      // Defaults si no existe la fila
      return {
        autoStart: false,
        pollIntervalMs: 30000,
        maxIterations: 10,
        maxRetries: 3,
        toolTimeoutMs: 30000,
      };
    }

    return {
      autoStart: row.auto_start === 1,
      pollIntervalMs: row.poll_interval_ms,
      maxIterations: row.max_iterations,
      maxRetries: row.max_retries,
      toolTimeoutMs: row.tool_timeout_ms,
    };
  }

  /**
   * Carga el contexto completo de una tarea para el prompt del agente.
   */
  private loadTaskContext(taskId: number): TaskContext {
    // Datos de la tarea
    const taskRow = this.db
      .query(
        `SELECT t.id, t.title, t.description, t.due_date,
                p.name AS priority, c.name AS category
         FROM tasks t
         LEFT JOIN priorities p ON p.id = t.priority_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = ?`,
      )
      .get(taskId) as {
      id: number;
      title: string;
      description: string;
      due_date: string | null;
      priority: string | null;
      category: string | null;
    } | null;

    if (!taskRow) {
      return {
        id: taskId,
        title: "Tarea no encontrada",
        description: "",
        priority: "Media",
        category: "General",
        dueDate: null,
        comments: [],
        attachments: [],
        reviewFeedback: null,
      };
    }

    // Comentarios
    const comments = this.db
      .query(
        "SELECT content, author, created_at FROM comments WHERE task_id = ? ORDER BY created_at",
      )
      .all(taskId) as Array<{ content: string; author: string; created_at: string }>;

    // Adjuntos
    const attachments = this.db
      .query("SELECT filename FROM task_attachments WHERE task_id = ?")
      .all(taskId) as Array<{ filename: string }>;

    // Feedback de revisión
    const execution = this.db
      .query("SELECT review_feedback FROM agent_executions WHERE task_id = ?")
      .get(taskId) as { review_feedback: string | null } | null;

    return {
      id: taskRow.id,
      title: taskRow.title,
      description: taskRow.description ?? "",
      priority: taskRow.priority ?? "Media",
      category: taskRow.category ?? "General",
      dueDate: taskRow.due_date,
      comments: comments.map((c) => ({
        author: c.author,
        content: c.content,
        createdAt: c.created_at,
      })),
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: "",
      })),
      reviewFeedback: execution?.review_feedback ?? null,
    };
  }

  /**
   * Verifica la salud del repositorio configurado.
   * Si está "connected" pero el path no existe o no es Git → "disconnected".
   * Si está "disconnected" pero el path vuelve a ser accesible → "connected".
   */
  private checkRepoHealth(): void {
    try {
      const repoRow = this.db
        .query("SELECT repo_path, repo_status FROM workspace_settings WHERE id = 1")
        .get() as { repo_path: string | null; repo_status: string | null } | null;

      if (repoRow?.repo_status === "connected" && repoRow?.repo_path) {
        if (!existsSync(repoRow.repo_path) || !existsSync(join(repoRow.repo_path, ".git"))) {
          this.db
            .prepare("UPDATE workspace_settings SET repo_status = 'disconnected' WHERE id = 1")
            .run();
        }
      } else if (repoRow?.repo_status === "disconnected" && repoRow?.repo_path) {
        if (existsSync(repoRow.repo_path) && existsSync(join(repoRow.repo_path, ".git"))) {
          this.db
            .prepare("UPDATE workspace_settings SET repo_status = 'connected' WHERE id = 1")
            .run();
        }
      }
    } catch {
      /* ignore monitoring errors */
    }
  }
}
