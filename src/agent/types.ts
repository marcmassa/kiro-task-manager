/** Rol de un mensaje en el historial (compatible con OpenAI/Anthropic). */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/** Mensaje en el historial de conversación. */
export interface Message {
  role: MessageRole;
  content: string;
  /** Solo para role=assistant con tool calls. */
  toolCalls?: ToolCall[];
  /** Solo para role=tool — referencia al tool_call_id. */
  toolCallId?: string;
}

/** Invocación de herramienta pedida por el LLM. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Resultado de ejecutar una herramienta. */
export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

/** Definición de herramienta para enviar al LLM. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

/** Respuesta normalizada del LLM. */
export type LLMResponse =
  | { type: "text"; content: string }
  | { type: "tool_use"; toolCalls: ToolCall[] };

/** Estado del engine. */
export type EngineStatus = "idle" | "working" | "error" | "disabled";

/** Configuración persistida del agent engine. */
export interface AgentEngineConfig {
  autoStart: boolean;
  pollIntervalMs: number;
  maxIterations: number;
  maxRetries: number;
  toolTimeoutMs: number;
  maxChatTurnsPerExecution: number;
}

/** Estado público del agent (para GET /api/agent/status). */
export interface AgentStatusResponse {
  status: EngineStatus;
  currentTaskId: number | null;
  currentTaskTitle: string | null;
  lastError: string | null;
  lastCycleAt: string | null;
}

/** Contexto completo de una tarea para construir el prompt. */
export interface TaskContext {
  id: number;
  title: string;
  description: string;
  priority: string;
  category: string;
  dueDate: string | null;
  comments: Array<{ author: string; content: string; createdAt: string }>;
  attachments: Array<{ filename: string; content: string }>;
  reviewFeedback: string | null;
}
