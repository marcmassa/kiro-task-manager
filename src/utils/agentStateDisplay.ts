import type { AgentState } from "../types";

/**
 * Presentation metadata for each agent lifecycle state (FEAT-006).
 * Pure mapping shared by TaskCard and TaskDetailModal so the badge looks
 * identical everywhere. Colours map to design-system tokens.
 */
export interface AgentStateDisplay {
  /** Spanish label. */
  label: string;
  /** Tailwind bg class for the dot. */
  dot: string;
  /** Tailwind classes for the badge (bg + text). */
  badge: string;
}

const DISPLAY: Record<AgentState, AgentStateDisplay> = {
  assigned: {
    label: "Asignada",
    dot: "bg-muted-400",
    badge: "bg-white/5 text-muted-300 border border-white/10",
  },
  agent_working: {
    label: "Agente trabajando",
    dot: "bg-accent",
    badge: "bg-accent/15 text-accent-300 border border-accent/20",
  },
  pending_review: {
    label: "Pendiente de revisión",
    dot: "bg-warning",
    badge: "bg-warning/15 text-warning-300 border border-warning/20",
  },
  changes_requested: {
    label: "Cambios solicitados",
    dot: "bg-danger",
    badge: "bg-danger/15 text-danger-300 border border-danger/20",
  },
  done: {
    label: "Aprobada",
    dot: "bg-success",
    badge: "bg-success/15 text-success-300 border border-success/20",
  },
};

export function agentStateDisplay(state: AgentState): AgentStateDisplay {
  return DISPLAY[state];
}
