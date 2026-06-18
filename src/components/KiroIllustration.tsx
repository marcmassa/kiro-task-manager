import { useState, useEffect, type ReactNode } from "react";
import { KiroBase, NotebookLayer, NotebookWritingLayers } from "./KiroMascot";

/**
 * The six supported Kiro moods — each corresponds to a distinct illustration
 * and animation. Call sites receive a compile-time error for unsupported values.
 */
export type KiroMood = "saludo" | "trabajando" | "pensando" | "celebrando" | "error" | "vacio";

/**
 * Runtime value tuple of all supported moods. Used by `isKiroMood` for O(1)
 * membership checks via a Set derived from this tuple.
 */
const KIRO_MOODS = ["saludo", "trabajando", "pensando", "celebrando", "error", "vacio"] as const;

const KIRO_MOOD_SET: ReadonlySet<string> = new Set(KIRO_MOODS);

/**
 * Runtime type guard that checks whether an unknown value is a valid KiroMood.
 * Useful for safely narrowing dynamic/runtime values (e.g. from a CMS or URL param).
 */
export function isKiroMood(value: unknown): value is KiroMood {
  return typeof value === "string" && KIRO_MOOD_SET.has(value);
}

/**
 * Reads the `prefers-reduced-motion: reduce` media query and subscribes to
 * changes. Returns `true` when the user prefers reduced motion, `false`
 * otherwise.
 *
 * SSR/Bun-build safe: defaults to `false` when `matchMedia` is absent
 * (e.g. during server-side rendering or Bun's bundler environment).
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    // Sync initial value in case it changed between the lazy initializer and
    // the effect running (unlikely but correct).
    setReducedMotion(mql.matches);

    mql.addEventListener("change", handler);
    return () => {
      mql.removeEventListener("change", handler);
    };
  }, []);

  return reducedMotion;
}

// ---------------------------------------------------------------------------
// Per-mood decoration render functions (file-local, pure)
// Each pair returns ReactNode fragments in the 0 0 24 24 viewBox.
// Decoration only — never the ghost body, eyes, or purple background.
// ---------------------------------------------------------------------------

/** saludo: no behind layer */
function saludoBehind(): ReactNode {
  return null;
}

/** saludo: waving hand sparkles — brand palette only, no AWS color */
function saludoChildren(): ReactNode {
  return (
    <>
      {/* Waving hand (extended from ghost body) */}
      <g transform="translate(6.5 10.5) rotate(-15)">
        <ellipse cx="0" cy="0" rx="1.2" ry="1.4" fill="#ffffff" />
        <path
          d="M-0.3 -1.2 Q0 -2.4 0.6 -1.6"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      </g>
      {/* Sparkle top-left */}
      <path
        d="M4.5 4 L5 5.4 L6.4 5.9 L5 6.4 L4.5 7.8 L4 6.4 L2.6 5.9 L4 5.4 Z"
        fill="#b4a5fd"
        opacity="0.9"
      />
      {/* Sparkle top-right */}
      <path
        d="M19 4.5 L19.3 5.3 L20.1 5.6 L19.3 5.9 L19 6.7 L18.7 5.9 L17.9 5.6 L18.7 5.3 Z"
        fill="#9580fc"
        opacity="0.8"
      />
      {/* Small dot accent */}
      <circle cx="20.5" cy="8" r="0.4" fill="#b4a5fd" opacity="0.6" />
    </>
  );
}

/** trabajando: notebook behind the ghost (shared layer from KiroMascot) */
function trabajandoBehind(): ReactNode {
  return <NotebookLayer />;
}

/** trabajando: pencil/hand/sparkle children (shared layer from KiroMascot) */
function trabajandoChildren(): ReactNode {
  return <NotebookWritingLayers />;
}

/** pensando: no behind layer */
function pensandoBehind(): ReactNode {
  return null;
}

/** pensando: three thought dots using AWS orange #FF9900 (state cue) */
function pensandoChildren(): ReactNode {
  return (
    <g>
      <circle cx="5.5" cy="6" r="0.7" fill="#FF9900" opacity="0.7" />
      <circle cx="3.8" cy="4.5" r="0.9" fill="#FF9900" opacity="0.85" />
      <circle cx="2.2" cy="2.8" r="1.1" fill="#FF9900" />
    </g>
  );
}

/** celebrando: no behind layer */
function celebrandoBehind(): ReactNode {
  return null;
}

/** celebrando: confetti + checkmark using AWS green #037F0C (state cue) */
function celebrandoChildren(): ReactNode {
  return (
    <>
      {/* Checkmark accent */}
      <path
        d="M18 5.5 L19.2 7 L21.5 3.8"
        fill="none"
        stroke="#037F0C"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Confetti pieces — brand palette */}
      <rect
        x="3"
        y="3"
        width="1.2"
        height="0.5"
        rx="0.25"
        fill="#9580fc"
        transform="rotate(25 3.6 3.25)"
      />
      <rect
        x="20"
        y="7"
        width="1"
        height="0.4"
        rx="0.2"
        fill="#b4a5fd"
        transform="rotate(-30 20.5 7.2)"
      />
      <circle cx="5" cy="5.5" r="0.4" fill="#7c5cfc" opacity="0.8" />
      <circle cx="19.5" cy="9.5" r="0.35" fill="#9580fc" opacity="0.7" />
    </>
  );
}

/** error: no behind layer */
function errorBehind(): ReactNode {
  return null;
}

/** error: alert/exclamation mark using AWS red #D91515 (state cue) */
function errorChildren(): ReactNode {
  return (
    <g transform="translate(18.5 3.5)">
      {/* Exclamation body */}
      <rect x="-0.5" y="0" width="1" height="3.2" rx="0.5" fill="#D91515" />
      {/* Exclamation dot */}
      <circle cx="0" cy="4.2" r="0.55" fill="#D91515" />
    </g>
  );
}

/** vacio: no behind layer */
function vacioBehind(): ReactNode {
  return null;
}

/** vacio: sleeping zz decoration — brand palette only, no AWS color */
function vacioChildren(): ReactNode {
  return (
    <g opacity="0.7">
      {/* Small "z" */}
      <text
        x="17"
        y="5.5"
        fontSize="2.2"
        fontFamily="system-ui, sans-serif"
        fontWeight="bold"
        fill="#b4a5fd"
      >
        z
      </text>
      {/* Larger "Z" */}
      <text
        x="19"
        y="4"
        fontSize="3"
        fontFamily="system-ui, sans-serif"
        fontWeight="bold"
        fill="#9580fc"
      >
        Z
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// MOOD_CONFIG — centralizes metadata for all six moods
// ---------------------------------------------------------------------------

interface MoodConfig {
  behind: () => ReactNode;
  children: () => ReactNode;
  shiftX: number;
  label: string;
  animClass: string;
  hasState: boolean;
}

const MOOD_CONFIG: Record<KiroMood, MoodConfig> = {
  saludo: {
    behind: saludoBehind,
    children: saludoChildren,
    shiftX: 0,
    label: "Kiro, asistente de IA saludando",
    animClass: "animate-kiro-wave",
    hasState: false,
  },
  trabajando: {
    behind: trabajandoBehind,
    children: trabajandoChildren,
    shiftX: -3.3,
    label: "Kiro, asistente de IA anotando tareas en un cuaderno",
    animClass: "animate-kiro-float",
    hasState: false,
  },
  pensando: {
    behind: pensandoBehind,
    children: pensandoChildren,
    shiftX: 0,
    label: "Kiro, asistente de IA pensando",
    animClass: "animate-kiro-think",
    hasState: true,
  },
  celebrando: {
    behind: celebrandoBehind,
    children: celebrandoChildren,
    shiftX: 0,
    label: "Kiro, asistente de IA celebrando",
    animClass: "animate-kiro-pop",
    hasState: true,
  },
  error: {
    behind: errorBehind,
    children: errorChildren,
    shiftX: 0,
    label: "Kiro, asistente de IA con un error",
    animClass: "animate-kiro-shake",
    hasState: true,
  },
  vacio: {
    behind: vacioBehind,
    children: vacioChildren,
    shiftX: 0,
    label: "Kiro, asistente de IA en reposo",
    animClass: "animate-kiro-float",
    hasState: false,
  },
};

// ---------------------------------------------------------------------------
// KiroIllustration — the public, mood-driven component
// ---------------------------------------------------------------------------

export interface KiroIllustrationProps {
  /** Which Kiro mood to render. Defaults to "saludo". */
  mood?: KiroMood;
  /** Rendered width/height in px (square). Defaults to 160. */
  size?: number;
  /** Class applied to the root <svg> (composed with the mood animation class). */
  className?: string;
  /** Apply the mood's animation. Defaults to true. Reduced motion overrides this. */
  animated?: boolean;
  /** Mark purely decorative: aria-hidden, no role/aria-label. Defaults to false. */
  decorative?: boolean;
  /** Override the default Spanish aria-label (ignored when decorative or whitespace-only). */
  label?: string;
}

export function KiroIllustration({
  mood = "saludo",
  size = 160,
  className = "",
  animated = true,
  decorative = false,
  label,
}: KiroIllustrationProps): JSX.Element {
  const reducedMotion = useReducedMotion();

  // Mood resolution: fallback to "saludo" for out-of-union runtime values
  const resolved = isKiroMood(mood) ? mood : "saludo";
  const config = MOOD_CONFIG[resolved];

  // Size normalization: non-finite, non-numeric, or ≤0 values become 160
  const normalizedSize = typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 160;

  // Label resolution: skipped when decorative; prefer trimmed caller label, else default
  let resolvedLabel: string | undefined;
  if (!decorative) {
    const trimmed = typeof label === "string" ? label.trim() : "";
    resolvedLabel = trimmed.length > 0 ? trimmed : config.label;
  }

  // Animation class: only when animated and reduced motion is not active
  const animClass = animated !== false && !reducedMotion ? config.animClass : "";

  // Compose className from caller's class and animation class
  const composedClass = [className, animClass].filter(Boolean).join(" ");

  return (
    <KiroBase
      size={normalizedSize}
      className={composedClass}
      behind={config.behind()}
      silhouetteShiftX={config.shiftX}
      label={resolvedLabel}
      decorative={decorative}
    >
      {config.children()}
    </KiroBase>
  );
}
