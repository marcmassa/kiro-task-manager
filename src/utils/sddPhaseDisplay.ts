import type { SddPhase } from "./sddLifecycle";

export interface PhaseDisplayStyle {
  badge: string;
  headerColor: string;
  dot: string;
}

export function sddPhaseStyle(phase: SddPhase, inReview: boolean): PhaseDisplayStyle {
  const styles: Record<SddPhase, PhaseDisplayStyle> = {
    requirements: {
      badge: inReview
        ? "bg-accent/20 text-accent-200 border border-accent/30"
        : "bg-accent/15 text-accent-300 border border-accent/20",
      headerColor: "text-accent-300",
      dot: "bg-accent",
    },
    design: {
      badge: inReview
        ? "bg-warning/20 text-warning-200 border border-warning/30"
        : "bg-warning/15 text-warning-300 border border-warning/20",
      headerColor: "text-warning-300",
      dot: "bg-warning",
    },
    tasks: {
      badge: inReview
        ? "bg-yellow-500/20 text-yellow-200 border border-yellow-500/30"
        : "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20",
      headerColor: "text-yellow-300",
      dot: "bg-yellow-500",
    },
    execution: {
      badge: inReview
        ? "bg-success/20 text-success-200 border border-success/30"
        : "bg-success/15 text-success-300 border border-success/20",
      headerColor: "text-success-300",
      dot: "bg-success",
    },
  };
  return styles[phase];
}
