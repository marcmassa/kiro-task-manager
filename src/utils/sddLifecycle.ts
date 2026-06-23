export type SddPhase = "requirements" | "design" | "tasks" | "execution";

export const SDD_PHASES: readonly SddPhase[] = [
  "requirements",
  "design",
  "tasks",
  "execution",
] as const;

/** Returns the next SDD phase, or null if `phase` is the last one. */
export function nextPhase(phase: SddPhase): SddPhase | null {
  const idx = SDD_PHASES.indexOf(phase);
  return idx < SDD_PHASES.length - 1 ? SDD_PHASES[idx + 1] : null;
}

export function isFinalPhase(phase: SddPhase): boolean {
  return phase === "execution";
}

export function phaseLabel(phase: SddPhase): string {
  const L: Record<SddPhase, string> = {
    requirements: "Requirements",
    design: "Diseño",
    tasks: "Tasks",
    execution: "Ejecución",
  };
  return L[phase];
}

export type PhaseApprovalResult =
  | { ok: true; nextState: "agent_working"; nextPhase: SddPhase }
  | { ok: true; nextState: "done"; nextPhase: null }
  | { ok: false; reason: string };

export function applyPhaseApproval(currentPhase: SddPhase): PhaseApprovalResult {
  const next = nextPhase(currentPhase);
  return next
    ? { ok: true, nextState: "agent_working", nextPhase: next }
    : { ok: true, nextState: "done", nextPhase: null };
}
