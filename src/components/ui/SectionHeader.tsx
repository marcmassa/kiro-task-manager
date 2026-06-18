interface SectionHeaderProps {
  label: string;
  /**
   * Tailwind background-color class for the leading dot. Default: "bg-accent".
   * Use the design-system dot modifier classes for semantic colour + glow:
   *   "ds-dot-accent" | "ds-dot-warning" | "ds-dot-success" | "ds-dot-danger"
   * Plain Tailwind classes (e.g. "bg-accent") are also accepted for
   * backward-compatibility with existing tests (R9.5).
   */
  dotColor?: string;
}

/**
 * Encabezado de sección con paleta AWS/Kiro.
 *
 * Clases del design system (definidas en styles.css @layer components):
 *   ds-section-header — flex container con gap y mb
 *   ds-section-dot    — círculo base 8×8 px
 *   ds-section-label  — uppercase, tracking, font-bold
 *   ds-section-line   — línea degradada aws-orange → transparent
 *
 * Contratos de test (R9.2 / R9.5):
 *   - <h2> con clase `uppercase` (incluida en ds-section-label).
 *   - Primer <span> contiene la clase dotColor (default: "bg-accent").
 */
export function SectionHeader({ label, dotColor = "bg-accent" }: SectionHeaderProps) {
  return (
    <div className="ds-section-header">
      <span className={`ds-section-dot ${dotColor}`} aria-hidden="true" />
      <h2 className="ds-section-label uppercase">{label}</h2>
      <span className="ds-section-line" aria-hidden="true" />
    </div>
  );
}
