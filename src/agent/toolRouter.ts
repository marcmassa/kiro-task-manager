/**
 * toolRouter.ts — Enruta llamadas de herramientas a handlers internos o
 * servidores MCP externos. Combina las definiciones de ambas fuentes para
 * exponer un catálogo unificado al LLM.
 *
 * Cubre: R6.2, R6.3, R5.3, R12.4
 */
import type { Database } from "bun:sqlite";
import type { McpClientPool } from "./mcpClientPool";
import type { ToolDefinition, ToolCall, ToolResult } from "./types";
import {
  getTask,
  getAttachment,
  getTaskComments,
  postComment,
  submitForReview,
  type ToolResult as HandlerToolResult,
} from "../mcp/handlers";

// ---------------------------------------------------------------------------
// Tipos existentes
// ---------------------------------------------------------------------------

/**
 * Resultado de clasificar una herramienta.
 */
export type ToolClassification =
  | { type: "internal" }
  | { type: "external"; serverName: string }
  | { type: "unknown" };

/**
 * Función pura: clasifica una herramienta según su pertenencia a registros internos o externos.
 *
 * - Si toolName está en internalToolNames → { type: "internal" }
 * - Si toolName está en externalToolMap (y no en internal) → { type: "external", serverName }
 * - Si no está en ninguno → { type: "unknown" }
 */
export function classifyTool(
  toolName: string,
  internalToolNames: string[],
  externalToolMap: Map<string, string>,
): ToolClassification {
  if (internalToolNames.includes(toolName)) {
    return { type: "internal" };
  }
  const serverName = externalToolMap.get(toolName);
  if (serverName !== undefined) {
    return { type: "external", serverName };
  }
  return { type: "unknown" };
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

/** Router de herramientas: expone catálogo unificado y ejecuta llamadas. */
export interface ToolRouter {
  /** Devuelve todas las definiciones de herramientas disponibles (internas + MCP externas). */
  getAvailableTools(): ToolDefinition[];

  /** Ejecuta una llamada de herramienta, enrutando al handler interno o cliente MCP. */
  executeTool(call: ToolCall): Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Definiciones de herramientas internas
// ---------------------------------------------------------------------------

const INTERNAL_TOOLS: ToolDefinition[] = [
  {
    name: "get_task",
    description: "Obtiene el contexto completo de una tarea",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "number" } },
      required: ["taskId"],
    },
  },
  {
    name: "get_attachment",
    description: "Obtiene el contenido de un adjunto",
    inputSchema: {
      type: "object",
      properties: { attachmentId: { type: "number" } },
      required: ["attachmentId"],
    },
  },
  {
    name: "get_task_comments",
    description: "Lista los comentarios de una tarea",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "number" } },
      required: ["taskId"],
    },
  },
  {
    name: "post_comment",
    description: "Publica un comentario en una tarea",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        content: { type: "string" },
      },
      required: ["taskId", "content"],
    },
  },
  {
    name: "submit_for_review",
    description: "Envía la tarea a revisión humana con resumen",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number" },
        summary: { type: "string" },
      },
      required: ["taskId", "summary"],
    },
  },
];

const INTERNAL_TOOL_NAMES = INTERNAL_TOOLS.map((t) => t.name);

// ---------------------------------------------------------------------------
// Helper interno
// ---------------------------------------------------------------------------

/**
 * Ejecuta una herramienta interna delegando al handler correspondiente.
 */
function executeInternalTool(db: Database, call: ToolCall): HandlerToolResult {
  switch (call.name) {
    case "get_task":
      return getTask(db, call.arguments.taskId as number);
    case "get_attachment":
      return getAttachment(db, call.arguments.attachmentId as number, process.cwd());
    case "get_task_comments":
      return getTaskComments(db, call.arguments.taskId as number);
    case "post_comment":
      return postComment(db, call.arguments.taskId as number, call.arguments.content as string);
    case "submit_for_review":
      return submitForReview(db, call.arguments.taskId as number, call.arguments.summary as string);
    default:
      return { ok: false, error: `Herramienta interna desconocida: ${call.name}` };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Crea un ToolRouter que combina herramientas internas (handlers locales) con
 * herramientas externas (servidores MCP conectados vía mcpPool).
 */
export function createToolRouter(
  db: Database,
  mcpPool: McpClientPool,
  _config: { toolTimeoutMs: number },
): ToolRouter {
  return {
    getAvailableTools(): ToolDefinition[] {
      return [...INTERNAL_TOOLS, ...mcpPool.getExternalTools()];
    },

    async executeTool(call: ToolCall): Promise<ToolResult> {
      const toolMap = mcpPool.getToolMap();
      const classification = classifyTool(call.name, INTERNAL_TOOL_NAMES, toolMap);

      try {
        if (classification.type === "internal") {
          const handlerResult = executeInternalTool(db, call);
          return {
            toolCallId: call.id,
            content: handlerResult.ok ? JSON.stringify(handlerResult.data) : handlerResult.error,
            isError: !handlerResult.ok,
          };
        }

        if (classification.type === "external") {
          const result = await mcpPool.callTool(
            classification.serverName,
            call.name,
            call.arguments,
          );
          return { toolCallId: call.id, content: result, isError: false };
        }

        // Herramienta desconocida
        return {
          toolCallId: call.id,
          content: `Herramienta desconocida: ${call.name}`,
          isError: true,
        };
      } catch (error) {
        return {
          toolCallId: call.id,
          content:
            error instanceof Error ? error.message : "Error desconocido al ejecutar herramienta",
          isError: true,
        };
      }
    },
  };
}
