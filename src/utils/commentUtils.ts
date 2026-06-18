/**
 * Utilidades puras para clasificación de comentarios (agente vs humano).
 * Sin efectos secundarios — todas las funciones son puras y testeables.
 *
 * Cubre: R4.3, R7.1
 */

import type { Comment, AgentState } from "../types";

/**
 * Determina si un comentario fue escrito por un agente.
 * Comparación case-sensitive del `author` contra la lista de `agentNames`.
 */
export function isAgentComment(author: string, agentNames: string[]): boolean {
  return agentNames.includes(author);
}

/**
 * Determina si se debe mostrar el indicador de actividad del agente.
 *
 * Condiciones (ambas deben cumplirse):
 * 1. `executionState` es "agent_working"
 * 2. Existe al menos un comentario humano con `created_at` posterior
 *    al último comentario del agente (o cualquier comentario humano
 *    si no hay comentarios del agente)
 */
export function shouldShowActivityIndicator(
  comments: Comment[],
  agentNames: string[],
  executionState: AgentState | null,
): boolean {
  // Condition 1: execution must be in agent_working state
  if (executionState !== "agent_working") return false;

  // Condition 2: there must be human comments after the last agent comment
  if (comments.length === 0) return false;

  // Find the last agent comment's created_at
  let lastAgentCommentDate: string | null = null;
  for (const comment of comments) {
    if (isAgentComment(comment.author, agentNames)) {
      if (!lastAgentCommentDate || comment.created_at > lastAgentCommentDate) {
        lastAgentCommentDate = comment.created_at;
      }
    }
  }

  // Check if there are human comments after the last agent comment
  for (const comment of comments) {
    if (!isAgentComment(comment.author, agentNames)) {
      // It's a human comment
      if (lastAgentCommentDate === null || comment.created_at > lastAgentCommentDate) {
        return true;
      }
    }
  }

  return false;
}
