import { clampPercent, resolveProgressColor, type ProgressColor } from "../../utils/uiVariants";

interface ProgressBarProps {
  /** Valor 0–100. Se limita al rango; NaN/null/undefined → 0. */
  value: number;
  /** Color del relleno. Default: "accent". */
  color?: ProgressColor;
}

/**
 * Barra de progreso accesible de presentación pura.
 *
 * Limita el valor al rango entero [0, 100] mediante `clampPercent` (helper puro
 * canónico de `uiVariants`) y lo usa tanto para el ancho del relleno como para
 * `aria-valuenow` (R6.1–R6.4). Expone siempre los atributos ARIA de progressbar
 * (R6.6) y resuelve el color del relleno vía `resolveProgressColor`, con
 * `bg-accent` por defecto (R6.5). La transición de ancho de 300ms se desactiva
 * bajo `prefers-reduced-motion` con `motion-reduce:transition-none` (R6.7, R6.8).
 */
export function ProgressBar({ value, color = "accent" }: ProgressBarProps) {
  const percent = clampPercent(value);
  const fillColor = resolveProgressColor(color);

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-white/5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${fillColor}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
