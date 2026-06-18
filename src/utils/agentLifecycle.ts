/**
 * Agent execution lifecycle — pure state-machine logic (FEAT-006).
 *
 * This module has no React / DOM / network / DB dependencies so it can be
 * property-tested in isolation (analogous to statsCalculator.ts) and shared by
 * both the Elysia HTTP server (human transitions) and the MCP server (agent
 * transitions).
 *
 * The human-approval gate is enforced **by construction**: there is no entry in
 * TRANSITIONS whose `to` is "done" with `actor: "agent"`. Therefore an agent can
 * never reach "done" regardless of the calling code (R8 / R18).
 */

export type AgentState =
  | "assigned"
  | "agent_working"
  | "pending_review"
  | "changes_requested"
  | "done";

export type Actor = "human" | "agent";

export interface Transition {
  from: AgentState;
  to: AgentState;
  actor: Actor;
}

/** The 5 lifecycle states, in canonical order (R5). */
export const AGENT_STATES: readonly AgentState[] = [
  "assigned",
  "agent_working",
  "pending_review",
  "changes_requested",
  "done",
] as const;

/**
 * The single source of truth for allowed transitions.
 * Every transition not listed here is rejected (R12 / R20).
 */
export const TRANSITIONS: readonly Transition[] = [
  { from: "assigned", to: "agent_working", actor: "agent" }, // R6 claim
  { from: "agent_working", to: "pending_review", actor: "agent" }, // R7 submit
  { from: "pending_review", to: "done", actor: "human" }, // R9 approve (gate)
  { from: "pending_review", to: "changes_requested", actor: "human" }, // R10 request changes
  { from: "changes_requested", to: "agent_working", actor: "agent" }, // R11 resume
] as const;

/** True iff `(from → to)` is a transition allowed for `actor`. */
export function canTransition(from: AgentState, to: AgentState, actor: Actor): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actor === actor);
}

export type TransitionResult = { ok: true; next: AgentState } | { ok: false; reason: string };

/**
 * Validates and applies a transition. Returns the next state on success, or a
 * Spanish-language reason on failure. Never throws.
 */
export function applyTransition(from: AgentState, to: AgentState, actor: Actor): TransitionResult {
  if (!AGENT_STATES.includes(from)) {
    return { ok: false, reason: `Estado de origen inválido: ${from}` };
  }
  if (!AGENT_STATES.includes(to)) {
    return { ok: false, reason: `Estado de destino inválido: ${to}` };
  }
  if (!canTransition(from, to, actor)) {
    return {
      ok: false,
      reason: `Transición no permitida para ${actor}: ${from} → ${to}`,
    };
  }
  return { ok: true, next: to };
}
