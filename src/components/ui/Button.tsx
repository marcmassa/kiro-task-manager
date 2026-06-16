import { resolveButtonClass, type ButtonVariant } from "../../utils/uiVariants";

interface ButtonProps {
  /** Variante visual. Default: "primary". Valores fuera del enum caen a "primary". */
  variant?: ButtonVariant;
  /** Ícono opcional renderizado antes del texto, separado 8px (gap-2). */
  icon?: React.ReactNode;
  /** Deshabilita el botón: opacidad 50%, cursor not-allowed, onClick inhibido. */
  disabled?: boolean;
  /** Handler de click. No se invoca cuando disabled === true. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** type del <button>. Default: "button". */
  type?: "button" | "submit" | "reset";
  /** Obligatorio cuando el botón no tiene texto visible (solo ícono). */
  "aria-label"?: string;
  children?: React.ReactNode;
}

const focusClasses =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface-600";

/**
 * Botón de acción reutilizable con variantes visuales (`primary`, `secondary`,
 * `danger`, `ghost`) y soporte de ícono.
 *
 * - La clase visual se resuelve con `resolveButtonClass`, que aplica `btn-*`
 *   por variante y cae a `btn-primary` ante valores ausentes o no reconocidos
 *   (R2.1–R2.7).
 * - El ícono se renderiza antes del texto con `gap-2` (8px) (R2.8).
 * - `disabled` reduce la opacidad y muestra el cursor `not-allowed` (clases ya
 *   incluidas en `btn-*`) e inhibe la invocación de `onClick` (R2.9).
 * - El foco por teclado muestra un anillo visible ≥2px con el token `accent`
 *   (R2.10, R10.2).
 * - Se usa el elemento semántico `<button>` (R10.3) y, en desarrollo, se valida
 *   que un botón solo-ícono incluya un `aria-label` no vacío (R2.11, R10.4).
 */
export function Button({
  variant = "primary",
  icon,
  disabled = false,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
  children,
}: ButtonProps): JSX.Element {
  const hasVisibleText = children != null && children !== false && children !== "";
  const hasAriaLabel = typeof ariaLabel === "string" && ariaLabel.trim().length > 0;

  if (process.env.NODE_ENV !== "production" && !hasVisibleText && !hasAriaLabel) {
    console.error(
      "Button: un botón sin texto visible (solo ícono) requiere la prop `aria-label` " +
        "con una cadena no vacía descriptiva en español.",
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(e);
  };

  const classes = [resolveButtonClass(variant), focusClasses].join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}
