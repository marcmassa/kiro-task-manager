import { useId, type ReactNode } from "react";
import { Kiro } from "@lobehub/icons";

interface KiroMascotProps {
  className?: string;
  size?: number;
  variant?: "full" | "compact";
}

// Official Kiro icon paths (viewBox 0 0 24 24)
const KIRO_BG_PATH =
  "M18.8 0H5.2A5.2 5.2 0 000 5.2v13.6A5.2 5.2 0 005.2 24h13.6a5.2 5.2 0 005.2-5.2V5.2A5.2 5.2 0 0018.8 0z";
const KIRO_GHOST_PATH =
  "M7.97 16.376c-1.644 3.642 1.86 4.556 4.443 2.424.76 2.39 3.608.607 4.631-1.247 2.251-4.084 1.342-8.249 1.108-9.108-1.6-5.859-9.6-5.869-10.976.03-.323 1.033-.328 2.206-.507 3.423-.09.617-.16 1.009-.393 1.655-.139.373-.323.7-.62 1.257-.458.865-.264 2.53 2.101 1.665l.224-.1h-.01l-.001.001z";
const KIRO_EYE_LEFT_PATH =
  "M12.722 10.985c-.656 0-.755-.785-.755-1.252 0-.423.074-.756.218-.97a.61.61 0 01.537-.283c.229 0 .428.095.567.289.159.218.243.55.243.964 0 .785-.303 1.252-.805 1.252h-.005z";
const KIRO_EYE_RIGHT_PATH =
  "M15.425 10.985c-.656 0-.755-.785-.755-1.252 0-.423.074-.756.219-.97a.61.61 0 01.536-.283c.229 0 .428.095.567.289.159.218.243.55.243.964 0 .785-.303 1.252-.805 1.252h-.005z";

interface KiroBaseProps {
  className?: string;
  size?: number;
  /** Accessible label for the whole illustration. */
  label?: string;
  /**
   * Extra SVG layers rendered BEHIND the ghost (between the purple background
   * and the silhouette), still inside the rounded clip. Use this for props that
   * should peek out from behind Kiro.
   */
  behind?: ReactNode;
  /**
   * Horizontal offset (in viewBox units) applied to the Kiro silhouette
   * (ghost + eyes) only. Lets a variation nudge Kiro aside to make room for a
   * prop without affecting the purple background or any decorative layers.
   * Negative values move Kiro to the left.
   */
  silhouetteShiftX?: number;
  /**
   * Extra SVG layers rendered ON TOP of the standard Kiro, inside the rounded
   * clip. This is the extension point: variations add their own layers here
   * without modifying the base Kiro markup.
   */
  children?: ReactNode;
  /**
   * When true, render the SVG as purely decorative: emit `aria-hidden="true"`
   * and omit `role="img"` and `aria-label`. Default false.
   */
  decorative?: boolean;
}

/**
 * Standard Kiro mascot — the reusable base.
 *
 * Renders ONLY the official Kiro silhouette (purple rounded square + ghost body
 * + eyes) inside a clipped <svg>. Anything passed as `children` is layered above
 * the ghost but still clipped to the rounded square, so callers can decorate the
 * mascot (tools, props, sparkles, ...) without touching this component.
 */
export function KiroBase({
  className = "",
  size = 160,
  label = "Kiro, asistente de IA",
  behind,
  silhouetteShiftX = 0,
  children,
  decorative = false,
}: KiroBaseProps) {
  // useId() includes ":" which is invalid in CSS selectors — strip it so the
  // clipPath reference stays valid everywhere.
  const clipId = `kiro-bg-clip-${useId().replace(/:/g, "")}`;
  // Guard against 0 / negative sizes (parameter default only covers undefined).
  const dim = size > 0 ? size : 160;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      className={className}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={KIRO_BG_PATH} />
        </clipPath>
      </defs>

      {/* Purple background */}
      <path d={KIRO_BG_PATH} fill="#9046FF" />

      {/* Standard Kiro + any extra layers, all clipped to the rounded square */}
      <g clipPath={`url(#${clipId})`}>
        {/* Layers BEHIND the ghost (between background and silhouette) */}
        {behind}
        {/* Kiro silhouette — optionally nudged aside to make room for a prop */}
        <g transform={`translate(${silhouetteShiftX} 0)`}>
          <path d={KIRO_GHOST_PATH} fill="#ffffff" />
          <path d={KIRO_EYE_LEFT_PATH} fill="#000000" />
          <path d={KIRO_EYE_RIGHT_PATH} fill="#000000" />
        </g>
        {children}
      </g>
    </svg>
  );
}

/**
 * The spiral notebook — rendered BEHIND the ghost so it peeks out from behind
 * Kiro's body. Lower area, tilted slightly right.
 *
 * Shared between `KiroMascot` "full" variant and the `trabajando` mood in
 * `KiroIllustration` to guarantee visual parity from a single source.
 */
export function NotebookLayer() {
  return (
    <g transform="translate(17.6 11.5) rotate(20)">
      {/* Shadow */}
      <rect x="-5.3" y="-5.7" width="11" height="13" rx="1" fill="#000" opacity="0.2" />
      {/* Page */}
      <rect
        x="-5.5"
        y="-6"
        width="11"
        height="13"
        rx="1"
        fill="#ffffff"
        stroke="#5733e0"
        strokeWidth="0.4"
      />
      {/* Spiral binding (top edge) */}
      <circle cx="-3.6" cy="-6" r="0.45" fill="#1a1b26" opacity="0.55" />
      <circle cx="-1.8" cy="-6" r="0.45" fill="#1a1b26" opacity="0.55" />
      <circle cx="0" cy="-6" r="0.45" fill="#1a1b26" opacity="0.55" />
      <circle cx="1.8" cy="-6" r="0.45" fill="#1a1b26" opacity="0.55" />
      <circle cx="3.6" cy="-6" r="0.45" fill="#1a1b26" opacity="0.55" />
      {/* Completed task — checkmark + struck line */}
      <path
        d="M-4 -3.5 l0.7 0.7 l1.3 -1.5"
        fill="none"
        stroke="#10b981"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="-1.6"
        y1="-3.5"
        x2="3.2"
        y2="-3.5"
        stroke="#7c5cfc"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {/* Line currently being written — stops exactly under the pencil tip */}
      <line
        x1="-4"
        y1="-0.7"
        x2="-0.6"
        y2="-0.7"
        stroke="#7c5cfc"
        strokeWidth="0.55"
        opacity="0.85"
      />
      {/* Pending lines */}
      <line x1="-4" y1="2" x2="3" y2="2" stroke="#7c5cfc" strokeWidth="0.5" opacity="0.4" />
      <line x1="-4" y1="4.5" x2="2.2" y2="4.5" stroke="#7c5cfc" strokeWidth="0.5" opacity="0.3" />
    </g>
  );
}

/**
 * Variation #1 front layers — Kiro taking notes.
 *
 * The arm, pencil, gripping hand, scribble cue and sparkles. The notebook
 * itself lives in {@link NotebookLayer} and is rendered behind the ghost.
 *
 * Shared between `KiroMascot` "full" variant and the `trabajando` mood in
 * `KiroIllustration` to guarantee visual parity from a single source.
 */
export function NotebookWritingLayers() {
  return (
    <>
      {/* Pencil + hand + writing cue are grouped and shifted to follow the
          notebook (which lives in NotebookLayer). Lowered so the pencil stays
          below Kiro's eyes and writes on a lower notebook line. */}
      <g transform="translate(6.3 -2.8)">
        {/* Pencil ON TOP — smaller, mirrored tilt: eraser up-LEFT, tip pointing
          down-right onto the active line. Scaled down to read as a smaller pencil. */}
        <g transform="translate(8.3 12.31) rotate(-35) scale(0.72)">
          {/* Shadow */}
          <rect x="-1.5" y="-8.2" width="3" height="14.8" rx="0.7" fill="#000" opacity="0.18" />
          {/* Eraser */}
          <rect x="-1.5" y="-8" width="3" height="2" rx="0.7" fill="#ef4444" />
          {/* Ferrule */}
          <rect x="-1.5" y="-6" width="3" height="1" fill="#9ca3af" />
          <line x1="-0.6" y1="-6" x2="-0.6" y2="-5" stroke="#6b7280" strokeWidth="0.2" />
          <line x1="0.6" y1="-6" x2="0.6" y2="-5" stroke="#6b7280" strokeWidth="0.2" />
          {/* Body (yellow) */}
          <rect x="-1.5" y="-5" width="3" height="9" fill="#fbbf24" />
          {/* Body highlight */}
          <rect x="-1.5" y="-5" width="1" height="9" fill="#fde68a" opacity="0.7" />
          {/* Body shadow */}
          <rect x="0.6" y="-5" width="0.9" height="9" fill="#1a1b26" opacity="0.18" />
          {/* Wood tip */}
          <polygon points="-1.5,4 1.5,4 0,6.5" fill="#fde68a" />
          <polygon points="0,4 1.5,4 0,6.5" fill="#fbbf24" opacity="0.4" />
          {/* Lead tip — touches the page */}
          <polygon points="-0.6,5.4 0.6,5.4 0,6.5" fill="#1a1b26" />
        </g>

        {/* Hand gripping the pencil — drawn ON TOP of the pencil body so it reads
          as a fist wrapped around it. Same white as the ghost. */}
        <circle cx="8.92" cy="13.19" r="1.45" fill="#ffffff" />
        {/* Soft shading on the underside of the hand for a little depth */}
        <path
          d="M7.82 13.89 a1.45 1.45 0 0 0 2.2 0"
          fill="none"
          stroke="#1a1b26"
          strokeWidth="0.3"
          strokeLinecap="round"
          opacity="0.18"
        />

        {/* Writing-motion cue — tiny scribble strokes just under the pencil tip */}
        <line
          x1="10.2"
          y1="16.1"
          x2="10.9"
          y2="16.1"
          stroke="#7c5cfc"
          strokeWidth="0.45"
          strokeLinecap="round"
          opacity="0.6"
        />
        <line
          x1="10.1"
          y1="16.7"
          x2="10.5"
          y2="16.7"
          stroke="#7c5cfc"
          strokeWidth="0.4"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>

      {/* Sparkles */}
      <path
        d="M4.5 5 L5 6.4 L6.4 6.9 L5 7.4 L4.5 8.8 L4 7.4 L2.6 6.9 L4 6.4 Z"
        fill="#b4a5fd"
        opacity="0.9"
      />
      <circle cx="20" cy="5.2" r="0.6" fill="#b4a5fd" opacity="0.8" />
      <circle cx="20.8" cy="6.8" r="0.4" fill="#b4a5fd" opacity="0.55" />
    </>
  );
}

/**
 * Public mascot component.
 *
 * - `variant="full"` → standard Kiro (KiroBase) decorated with the
 *   note-taking variation (pencil + notebook).
 * - `variant="compact"` → the official lobehub Kiro icon, for small renders.
 */
export function KiroMascot({ className = "", size = 160, variant = "full" }: KiroMascotProps) {
  if (variant === "compact") {
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: "inline-flex" }}
        role="img"
        aria-label="Kiro, asistente de IA"
      >
        <Kiro.Color size={size} />
      </div>
    );
  }

  return (
    <KiroBase
      className={className}
      size={size}
      label="Kiro, asistente de IA anotando tareas en un cuaderno"
      behind={<NotebookLayer />}
      silhouetteShiftX={-3.3}
    >
      <NotebookWritingLayers />
    </KiroBase>
  );
}
