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
import { buildSystemPrompt, buildSddPhasePrompt, buildChatPrompt } from "./systemPrompt";
import { getActiveProviderConfig } from "../utils/aiProviderHandlers";
import {
  claimTask,
  postComment,
  submitForReview,
  submitPhaseOutput,
  getTask,
  getTaskComments,
} from "../mcp/handlers";
import { type SddPhase } from "../utils/sddLifecycle";
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

    // Buscar tarea asignada al agente (newly assigned)
    const taskRow = this.db
      .query(
        `SELECT t.id, t.title, e.sdd_phase FROM tasks t
         JOIN agent_executions e ON e.task_id = t.id
         WHERE e.state = 'assigned' AND e.agent_id = 'kiro'
         ORDER BY e.created_at ASC LIMIT 1`,
      )
      .get() as { id: number; title: string; sdd_phase: SddPhase | null } | null;

    // FEAT-012: also look for SDD phases resumed after human approval
    const resumedSddRow = !taskRow
      ? (this.db
          .query(
            `SELECT t.id, t.title, e.sdd_phase FROM tasks t
             JOIN agent_executions e ON e.task_id = t.id
             WHERE e.state = 'agent_working' AND e.sdd_phase IS NOT NULL AND e.agent_id = 'kiro'
             ORDER BY e.updated_at ASC LIMIT 1`,
          )
          .get() as { id: number; title: string; sdd_phase: SddPhase } | null)
      : null;

    const activeRow = taskRow ?? resumedSddRow;
    const isSddResumed = !taskRow && resumedSddRow !== null;

    // FEAT-013: third priority — chat turn for tasks with unanswered user messages
    if (!activeRow) {
      const chatRow = this.findChatEligibleTask();
      if (chatRow) {
        this.processing = true;
        this.status = "working";
        this.currentTaskId = chatRow.id;
        this.currentTaskTitle = chatRow.title;
        try {
          await this.processChatTurn(chatRow.id);
          return { ok: true, taskId: chatRow.id, message: "Chat turn procesado" };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Error desconocido";
          this.lastError = msg;
          this.status = "error";
          return { ok: false, taskId: chatRow.id, message: msg };
        } finally {
          this.processing = false;
          if (this.status !== "error") this.status = "idle";
          this.currentTaskId = null;
          this.currentTaskTitle = null;
        }
      }
      return { ok: true, message: "No hay tareas pendientes" };
    }

    const taskId = activeRow.id;
    this.processing = true;
    this.status = "working";
    this.currentTaskId = taskId;
    this.currentTaskTitle = activeRow.title;

    try {
      if (!isSddResumed) {
        // Reclamar la tarea (assigned → agent_working)
        const claimResult = claimTask(this.db, taskId);
        if (!claimResult.ok) {
          this.processing = false;
          this.status = "idle";
          this.currentTaskId = null;
          this.currentTaskTitle = null;
          return { ok: false, taskId, message: claimResult.error };
        }
      }

      // Dispatch: SDD mode or standard mode
      const sddPhase = activeRow.sdd_phase;
      if (sddPhase) {
        await this.processSddPhase(taskId, sddPhase);
      } else {
        // Procesar la tarea (tool-use loop)
        await this.processTask(taskId);
      }

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
         tool_timeout_ms = ?,
         max_chat_turns_per_execution = ?
         WHERE id = 1`,
      )
      .run(
        updated.autoStart ? 1 : 0,
        updated.pollIntervalMs,
        updated.maxIterations,
        updated.maxRetries,
        updated.toolTimeoutMs,
        updated.maxChatTurnsPerExecution,
      );

    this.config = updated;

    // Hot-reload: si pollIntervalMs cambió y el loop está activo, reiniciar
    if (updated.pollIntervalMs !== prevPollInterval && this.intervalId) {
      this.stop();
      this.start();
    }

    // Si autoStart cambió a true y el loop no está activo, arrancar
    if (updated.autoStart && !prevAutoStart && !this.intervalId) {
      this.start();
    }

    // Si autoStart cambió a false y el loop está activo, detener
    if (!updated.autoStart && prevAutoStart && this.intervalId) {
      this.stop();
    }
  }

  /**
   * Intenta arrancar el loop de polling si hay proveedor configurado y autoStart=true.
   * Llamado externamente cuando se guarda una nueva config de proveedor.
   */
  tryStart(): void {
    if (this.config.autoStart && !this.intervalId) {
      this.start();
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
   * FEAT-012: Processes a single SDD phase. Builds phase-specific prompt,
   * runs the tool-use loop, then saves output and sets state to pending_review.
   */
  private async processSddPhase(taskId: number, phase: SddPhase): Promise<void> {
    const taskContext = this.loadTaskContext(taskId);

    // Build repo config if available
    let repoContext: import("../utils/gitTypes").RepoPromptContext | undefined;
    let repoConfig: { workingDir: string; taskId: number; executionId: number | null } | undefined;

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
      const execRow = this.db
        .query("SELECT id FROM agent_executions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(taskId) as { id: number } | null;
      repoConfig = { workingDir: repoRow.repo_path, taskId, executionId: execRow?.id ?? null };
      try {
        const entries = readdirSync(repoRow.repo_path, { withFileTypes: true })
          .filter((e) => !IGNORED_DIRS.has(e.name))
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort()
          .join("\n");
        repoContext = {
          workingDir: repoRow.repo_path,
          currentBranch: repoRow.repo_current_branch ?? "main",
          directoryTree: entries,
          contextFiles: [],
        };
      } catch {}
    }

    const toolRouter = createToolRouter(
      this.db,
      this.mcpPool,
      { toolTimeoutMs: this.config.toolTimeoutMs },
      repoConfig,
    );
    const tools: ToolDefinition[] = toolRouter.getAvailableTools();

    // Collect prior approved phase outputs from comments
    const priorOutputs: Array<{ phase: SddPhase; output: string }> = (() => {
      const comments = this.db
        .query(
          "SELECT content FROM comments WHERE task_id = ? AND author = 'Kiro' ORDER BY created_at ASC",
        )
        .all(taskId) as Array<{ content: string }>;
      const phases: SddPhase[] = ["requirements", "design", "tasks"];
      const result: Array<{ phase: SddPhase; output: string }> = [];
      for (const p of phases) {
        if (p === phase) break;
        const marker = `[SDD:${p}]`;
        const match = comments.find((c) => c.content.startsWith(marker));
        if (match) result.push({ phase: p, output: match.content.replace(marker, "").trim() });
      }
      return result;
    })();

    const systemPrompt = buildSddPhasePrompt(phase, taskContext, tools, priorOutputs, repoContext);

    postComment(this.db, taskId, `🤖 [SDD] Comenzando fase: ${phase}...`);

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Ejecuta la fase "${phase}" del proceso SDD para esta tarea.` },
    ];

    const providerConfig = await getActiveProviderConfig(this.db);
    if (!providerConfig) throw new Error("Proveedor de IA no configurado");
    const adapter: ProviderAdapter = createProviderAdapter(providerConfig);

    let phaseOutput = "";
    for (let i = 0; i < this.config.maxIterations; i++) {
      const response = await this.sendWithRetry(adapter, messages, tools);
      if (response.type === "text") {
        phaseOutput = response.content;
        break;
      }
      messages.push({ role: "assistant", content: "", toolCalls: response.toolCalls });
      for (const toolCall of response.toolCalls) {
        const result = await toolRouter.executeTool(toolCall);
        messages.push({ role: "tool", content: result.content, toolCallId: result.toolCallId });
      }
    }

    if (!phaseOutput) phaseOutput = "Se alcanzó el límite de iteraciones";

    // Store phase output in comment with SDD marker so future phases can reference it
    postComment(this.db, taskId, `[SDD:${phase}] ${phaseOutput}`);

    const submitResult = submitPhaseOutput(this.db, taskId, phaseOutput);
    if (!submitResult.ok) {
      postComment(this.db, taskId, `⚠️ No se pudo enviar fase a revisión: ${submitResult.error}`);
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
   * FEAT-013: Busca la tarea más antigua con una ejecución activa que tenga
   * mensajes humanos sin respuesta del agente (Pending_Messages). R1.1–R1.4
   */
  private findChatEligibleTask(): { id: number; title: string } | null {
    return this.db
      .query(
        `SELECT t.id, t.title
         FROM tasks t
         JOIN agent_executions e ON e.task_id = t.id
         WHERE e.state IN ('pending_review', 'agent_working')
           AND e.agent_id = 'kiro'
           AND EXISTS (
             SELECT 1 FROM comments c
             WHERE c.task_id = t.id
               AND c.author != 'Kiro'
               AND c.created_at > COALESCE(
                 (SELECT MAX(created_at) FROM comments
                  WHERE task_id = t.id AND author = 'Kiro'),
                 '1970-01-01'
               )
           )
         ORDER BY e.updated_at ASC
         LIMIT 1`,
      )
      .get() as { id: number; title: string } | null;
  }

  /**
   * FEAT-013: Genera y publica una Conversational_Reply para la tarea indicada.
   * No transiciona el estado de la ejecución ni usa herramientas de edición.
   * R2.1–R2.6, R5.2, R6.2, R6.5
   */
  private async processChatTurn(taskId: number): Promise<void> {
    // Contar turns previos del agente en esta ejecución
    const agentCommentCount = (
      this.db
        .query("SELECT COUNT(*) AS c FROM comments WHERE task_id = ? AND author = 'Kiro'")
        .get(taskId) as { c: number }
    ).c;

    if (agentCommentCount >= this.config.maxChatTurnsPerExecution) {
      postComment(
        this.db,
        taskId,
        `⏸ Límite de respuestas alcanzado (${this.config.maxChatTurnsPerExecution}). Aprueba o solicita cambios para continuar.`,
      );
      return;
    }

    // Cargar contexto de tarea
    const taskContext = this.loadTaskContext(taskId);

    // Recuperar último output de fase SDD aprobado si existe
    const phaseOutputRow = this.db
      .query(
        `SELECT phase_output FROM agent_executions
         WHERE task_id = ? AND phase_output IS NOT NULL
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(taskId) as { phase_output: string } | null;

    const systemPrompt = buildChatPrompt(taskContext, phaseOutputRow?.phase_output);

    // Construir historial: comments → roles (Kiro = assistant, resto = user)
    // Truncar a los últimos 20 para limitar tokens
    const recentComments = taskContext.comments.slice(-20);
    const messages: import("./types").Message[] = [
      { role: "system", content: systemPrompt },
      ...recentComments.map((c) => ({
        role: (c.author === "Kiro" ? "assistant" : "user") as "assistant" | "user",
        content: c.author === "Kiro" ? c.content : `[${c.author}]: ${c.content}`,
      })),
    ];

    const providerConfig = await getActiveProviderConfig(this.db);
    if (!providerConfig) throw new Error("Proveedor de IA no configurado");
    const adapter = createProviderAdapter(providerConfig);

    let reply: string;
    try {
      const response = await this.sendWithRetry(adapter, messages, []); // sin tools
      reply = response.type === "text" ? response.content : "(sin respuesta de texto)";
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      // Verificar que la ejecución sigue activa antes de publicar error
      const exec = this.db
        .query("SELECT state FROM agent_executions WHERE task_id = ?")
        .get(taskId) as { state: string } | null;
      if (exec && !["done", "changes_requested"].includes(exec.state)) {
        postComment(
          this.db,
          taskId,
          `❌ No pude generar una respuesta: ${msg}. Inténtalo de nuevo.`,
        );
      }
      return;
    }

    // Comprobar carrera: ejecución puede haber transitado mientras generábamos la respuesta
    const execNow = this.db
      .query("SELECT state FROM agent_executions WHERE task_id = ?")
      .get(taskId) as { state: string } | null;
    if (!execNow || ["done", "changes_requested"].includes(execNow.state)) {
      return; // Descartar reply — R6.5
    }

    postComment(this.db, taskId, reply);
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
      max_chat_turns_per_execution: number;
    } | null;

    if (!row) {
      return {
        autoStart: false,
        pollIntervalMs: 30000,
        maxIterations: 10,
        maxRetries: 3,
        toolTimeoutMs: 30000,
        maxChatTurnsPerExecution: 10,
      };
    }

    return {
      autoStart: row.auto_start === 1,
      pollIntervalMs: row.poll_interval_ms,
      maxIterations: row.max_iterations,
      maxRetries: row.max_retries,
      toolTimeoutMs: row.tool_timeout_ms,
      maxChatTurnsPerExecution: row.max_chat_turns_per_execution ?? 10,
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
