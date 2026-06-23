/**
 * MCP server entry point (FEAT-006) — Model C.
 *
 * Exposes the Task Manager's task-orchestration tools over MCP (stdio) so Kiro
 * and other MCP-capable agents can read assigned tasks, read attachments, and
 * advance the lifecycle up to `pending_review`. It shares the same SQLite DB as
 * the Elysia HTTP server (parallel processes, shared persistence — R19).
 *
 * GATE (R18): no tool here can move an execution to `done`. Human approval is
 * REST-only.
 *
 * Run with:  bun run task-manager/mcp-server.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import db from "./db/database";
import {
  listAssignedTasks,
  getTask,
  getAttachment,
  claimTask,
  submitForReview,
  resumeTask,
  getTaskComments,
  postComment,
  type ToolResult,
} from "./src/mcp/handlers";

// FEAT-011 / R24 — attachments live under DATA_DIR (persistent volume in Docker),
// matching the HTTP server's ATTACHMENTS_ROOT so both processes resolve the
// same on-disk location.
const ATTACHMENTS_ROOT = path.resolve(process.env.DATA_DIR || ".");

/** Wraps a handler result into the MCP content shape. */
function toContent(result: ToolResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    isError: !result.ok,
  };
}

const server = new McpServer({ name: "task-manager", version: "1.0.0" });

// ── Read tools ───────────────────────────────────────────────────────────────

server.tool(
  "list_assigned_tasks",
  "Lista las tareas asignadas a un agente, con su estado de ejecución.",
  { agentId: z.string().describe("Identificador del agente, p. ej. 'kiro'") },
  ({ agentId }) => toContent(listAssignedTasks(db, agentId)),
);

server.tool(
  "get_task",
  "Devuelve el detalle de una tarea (título, descripción, prioridad, categoría) y la metadata de sus adjuntos.",
  { taskId: z.number().int().positive() },
  ({ taskId }) => toContent(getTask(db, taskId)),
);

server.tool(
  "get_attachment",
  "Devuelve el contenido de un adjunto (texto en UTF-8 o binario en base64).",
  { attachmentId: z.number().int().positive() },
  ({ attachmentId }) => toContent(getAttachment(db, attachmentId, ATTACHMENTS_ROOT)),
);

// ── Transition tools (actor = agent; nunca llegan a 'done') ──────────────────

server.tool(
  "claim_task",
  "Reclama una tarea asignada para empezar a trabajarla (assigned → agent_working).",
  { taskId: z.number().int().positive() },
  ({ taskId }) => toContent(claimTask(db, taskId)),
);

server.tool(
  "submit_for_review",
  "Envía el trabajo a revisión humana (agent_working → pending_review). Requiere un resumen.",
  {
    taskId: z.number().int().positive(),
    summary: z.string().min(1).describe("Resumen del trabajo realizado"),
  },
  ({ taskId, summary }) => toContent(submitForReview(db, taskId, summary)),
);

server.tool(
  "resume_task",
  "Retoma una tarea tras solicitarse cambios (changes_requested → agent_working).",
  { taskId: z.number().int().positive() },
  ({ taskId }) => toContent(resumeTask(db, taskId)),
);

// ── Comment tools (FEAT-008) ────────────────────────────────────────────

server.tool(
  "get_task_comments",
  "Devuelve los comentarios de una tarea ordenados cronológicamente.",
  { taskId: z.number().int().positive() },
  ({ taskId }) => toContent(getTaskComments(db, taskId)),
);

server.tool(
  "post_comment",
  "Publica un comentario en una tarea asignada. El autor se asigna automáticamente según el agente.",
  {
    taskId: z.number().int().positive(),
    content: z.string().min(1).describe("Contenido del comentario"),
  },
  ({ taskId, content }) => toContent(postComment(db, taskId, content)),
);

// ── Start (stdio) ────────────────────────────────────────────────────────────

if (import.meta.main) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is reserved for the MCP protocol.
  console.error("🤖 Task Manager MCP server listo (stdio)");
}

export { server };
