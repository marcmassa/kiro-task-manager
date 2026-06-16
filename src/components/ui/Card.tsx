type CardPadding = "estandar" | "compacto";

interface CardProps {
  /** Padding interno. Default: "estandar". Valor inválido → "estandar". */
  padding?: CardPadding;
  /** Elemento HTML a renderizar (ej. "section", "article"). Default: "div". */
  as?: keyof JSX.IntrinsicElements;
  /** Si true, conserva el hover de borde de home-card (siempre activo aquí). */
  interactive?: boolean;
  /** Clases adicionales aportadas por el consumidor. */
  className?: string;
  children?: React.ReactNode;
}

const paddingClasses: Record<CardPadding, string> = {
  estandar: "p-6",
  compacto: "p-4",
};

const surfaceClasses =
  "bg-surface-400/50 backdrop-blur-sm rounded-2xl border border-white/5 " +
  "transition-all duration-200 hover:border-white/10";

/**
 * Contenedor de superficie elevada reutilizable.
 *
 * Replica los atributos de superficie de la clase `home-card` (fondo de
 * superficie semitransparente, desenfoque, borde sutil `white/5`, esquinas
 * redondeadas, elevación y resalte de borde en hover) SIN aplicar la clase
 * `home-card` directamente, ya que ésta fija `p-6`. El padding se delega al
 * mapeo de la prop `padding`, permitiendo variantes `estandar` (p-6) y
 * `compacto` (p-4).
 */
export function Card({ padding = "estandar", as, className = "", children }: CardProps) {
  const Tag = (as ?? "div") as React.ElementType;
  const paddingClass = paddingClasses[padding] ?? "p-6";
  const classes = [surfaceClasses, paddingClass, className].filter(Boolean).join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
