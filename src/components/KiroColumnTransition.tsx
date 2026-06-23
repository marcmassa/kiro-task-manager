import { useEffect, useRef, useState } from "react";
import { KiroBase } from "./KiroMascot";
import type { SddPhase } from "../utils/sddLifecycle";

interface KiroColumnTransitionProps {
  /** The phase that just changed (triggers animation). */
  currentPhase: SddPhase | null;
}

/**
 * Shows a brief Kiro "sliding right" animation whenever the SDD phase changes.
 * Placed absolutely over the kanban board; respects prefers-reduced-motion via CSS.
 */
export function KiroColumnTransition({ currentPhase }: KiroColumnTransitionProps) {
  const [visible, setVisible] = useState(false);
  const prevPhaseRef = useRef<SddPhase | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = currentPhase;

    // Trigger only when phase transitions (not on mount)
    if (prev !== null && currentPhase !== null && prev !== currentPhase) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 900);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentPhase]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-8 right-8 z-50"
      aria-hidden="true"
      role="presentation"
    >
      <div className="animate-kiro-slide-right">
        <KiroBase size={64} />
      </div>
    </div>
  );
}
