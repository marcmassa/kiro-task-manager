import { resolveStatColor, type StatColor } from "../../utils/uiVariants";
import { ProgressBar } from "./ProgressBar";

interface StatCardProps {
  /** Valor principal (ej. 42 o "57.1%"). */
  value: string | number;
  /** Etiqueta descriptiva en español (ej. "Total tareas"). */
  label: string;
  /** Ícono de la métrica (SVG de Icons.tsx). */
  icon: React.ReactNode;
  /** Color semántico aplicado al contenedor del ícono y al ícono. */
  color: StatColor;
  /** Si se provee, renderiza un ProgressBar (0–100); 0 produce una barra vacía. */
  progressPercent?: number;
  /** aria-label legible de la métrica (ej. "Total de tareas: 42"). */
  "aria-label": string;
}

/**
 * Tarjeta de métrica reutilizable de presentación pura.
 *
 * Muestra valor, etiqueta e ícono sobre la superficie `home-stat-card` (R5.1,
 * R5.6). El color del contenedor del ícono y del ícono se resuelve vía
 * `resolveStatColor` a clases de token (R5.3). Expone el `aria-label` recibido
 * en el elemento raíz para describir la métrica de forma legible (R5.4, R10.4).
 * Cuando se provee `progressPercent`, compone un `ProgressBar` con el mismo
 * color semántico; un valor de 0 produce una barra vacía (R5.5, el clamping lo
 * maneja `ProgressBar`).
 */
export function StatCard({
  value,
  label,
  icon,
  color,
  progressPercent,
  "aria-label": ariaLabel,
}: StatCardProps) {
  const colorClasses = resolveStatColor(color);

  return (
    <div className="home-stat-card" aria-label={ariaLabel}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses.container} ${colorClasses.icon}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-muted-400">{label}</p>
        </div>
      </div>
      {progressPercent !== undefined && (
        <div className="mt-4">
          <ProgressBar value={progressPercent} color={color} />
        </div>
      )}
    </div>
  );
}
