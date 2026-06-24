import { SDD_PHASES, phaseLabel, type SddPhase } from "../utils/sddLifecycle";
import { sddPhaseStyle } from "../utils/sddPhaseDisplay";
import { useT } from "../i18n/useT";

interface SddPhaseStepsProps {
  currentPhase: SddPhase;
  /** State of the current execution, used to show review highlight. */
  inReview: boolean;
}

export function SddPhaseSteps({ currentPhase, inReview }: SddPhaseStepsProps) {
  const t = useT();
  const currentIdx = SDD_PHASES.indexOf(currentPhase);

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      role="list"
      aria-label={t("agent.sddPhases")}
    >
      {SDD_PHASES.map((phase, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const style = sddPhaseStyle(phase, isCurrent && inReview);

        return (
          <div key={phase} className="flex items-center gap-1" role="listitem">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                isCurrent
                  ? style.badge
                  : isPast
                    ? "bg-success/10 text-success-400 border-success/20 line-through opacity-60"
                    : "bg-white/5 text-muted-400 border-white/10 opacity-50"
              }`}
            >
              {idx + 1}. {phaseLabel(phase)}
            </span>
            {idx < SDD_PHASES.length - 1 && (
              <span className="text-muted-500 text-[10px]" aria-hidden="true">
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
