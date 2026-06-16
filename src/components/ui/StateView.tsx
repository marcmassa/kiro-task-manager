import { WarningIcon } from "../../Icons";
import { Button } from "./Button";
import { Card } from "./Card";

interface LoadingStateProps {
  /** Mensaje en español. Vacío/ausente → mensaje por defecto "Cargando...". */
  message?: string;
}

/**
 * Indicador de carga accesible.
 *
 * - Expone `role="status"` y `aria-live="polite"` para anunciar el estado a
 *   lectores de pantalla (R8.1).
 * - Renderiza el mensaje recibido por prop o, si está ausente o vacío, el
 *   mensaje por defecto en español "Cargando..." (R8.2).
 * - La animación de pulso usa `animate-pulse motion-reduce:animate-none`, de
 *   modo que se desactiva bajo `prefers-reduced-motion` manteniendo visible el
 *   indicador (R8.8, R10.6).
 */
export function LoadingState({ message }: LoadingStateProps): JSX.Element {
  const text = message != null && message.trim().length > 0 ? message : "Cargando...";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-pulse motion-reduce:animate-none flex flex-col items-center gap-4 py-12"
    >
      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-accent/40" />
      </div>
      <p className="text-muted-400 text-sm">{text}</p>
    </div>
  );
}

interface ErrorStateProps {
  /** Mensaje de error en español. */
  message: string;
  /** Callback de reintento. OBLIGATORIO: sin él, el componente no se renderiza. */
  onRetry: () => void;
}

/**
 * Estado de error con acción de reintento.
 *
 * - Muestra un ícono de advertencia (`WarningIcon`) y el mensaje de error en
 *   español recibido por prop (R8.3).
 * - Incluye un `Button` de reintento habilitado y enfocable por teclado con un
 *   `aria-label` en español que invoca `onRetry` exactamente una vez por
 *   activación (R8.3, R8.4).
 * - `onRetry` es OBLIGATORIO: si no se proporciona, el componente retorna
 *   `null` y no se renderiza (R8.5).
 * - El contenedor usa la superficie de `Card` (R8.7).
 */
export function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element | null {
  if (typeof onRetry !== "function") return null;

  return (
    <Card className="text-center max-w-md mx-auto">
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-12 h-12 rounded-xl bg-danger/15 text-danger-400 flex items-center justify-center">
          <WarningIcon size={24} />
        </div>
        <p className="text-gray-200 text-sm">{message}</p>
        <Button variant="primary" aria-label="Reintentar la carga" onClick={() => onRetry()}>
          Reintentar
        </Button>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  /** Ícono ilustrativo. */
  icon: React.ReactNode;
  /** Título en español. */
  title: string;
  /** Mensaje descriptivo en español. */
  message: string;
}

/**
 * Estado vacío.
 *
 * Muestra un ícono ilustrativo, un título en español y un mensaje descriptivo
 * en español, todos recibidos por props, dentro de la superficie de `Card`
 * (R8.6, R8.7).
 */
export function EmptyState({ icon, title, message }: EmptyStateProps): JSX.Element {
  return (
    <Card className="text-center max-w-md mx-auto">
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="text-accent-400">{icon}</div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-muted-400 text-sm">{message}</p>
      </div>
    </Card>
  );
}
