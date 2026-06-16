import { resolveBadgeClass, type BadgeVariant } from "../../utils/uiVariants";

interface BadgeProps {
  /** Variante de color semántico. Default: "neutral". Valor inválido → "neutral". */
  variant?: BadgeVariant;
  children: React.ReactNode;
}

/**
 * Etiqueta compacta reutilizable con color semántico.
 *
 * La clase base `badge` (padding compacto, texto pequeño, peso medio, esquinas
 * redondeadas) se aplica SIEMPRE y primero, de modo que el contenido textual
 * permanece visible aunque las clases de color de variante no resolvieran
 * (reserva R3.6). Los colores de fondo y texto por variante provienen de
 * `resolveBadgeClass`, que usa `neutral` por defecto y como reserva ante un
 * valor no reconocido (R3.2, R3.3, R3.7).
 *
 * El contenido no se trunca ni recibe puntos suspensivos: `whitespace-normal`
 * permite el ajuste en múltiples líneas (R3.4).
 */
export function Badge({ variant = "neutral", children }: BadgeProps) {
  const variantClass = resolveBadgeClass(variant);
  const classes = ["badge", "whitespace-normal", variantClass].filter(Boolean).join(" ");

  return <span className={classes}>{children}</span>;
}
