interface PageHeaderProps {
  title: string;
  subtitle: string;
  /** Slot for content rendered before the accent bar (e.g. workspace selector). */
  beforeTitle?: React.ReactNode;
  /** Slot for action buttons rendered at the right end of the header. */
  actions?: React.ReactNode;
}

/**
 * Cabecera de página unificada — paleta AWS/Kiro.
 *
 * Usada por Home, Kanban, Estadísticas y Configuración.
 * `beforeTitle` permite añadir un selector/indicador a la izquierda del título.
 * `actions` permite añadir botones a la derecha (ej. "Nueva Tarea").
 *
 * Clases del design system:
 *   ds-page-header       — Squid Ink + blur + borde naranja AWS
 *   ds-page-header-inner — padding + flex row
 *   ds-page-header-bar   — barra vertical accent 3×36 px
 *
 * Contratos de test (R9.3 / R9.4): sticky, backdrop-blur-xl, <h1>, <p>.
 */
export function PageHeader({
  title,
  subtitle,
  beforeTitle,
  actions,
}: PageHeaderProps): JSX.Element {
  return (
    <header className="ds-page-header sticky top-0 z-10 backdrop-blur-xl">
      <div className="ds-page-header-inner justify-between">
        <div className="flex items-center gap-3">
          {beforeTitle && <div className="shrink-0">{beforeTitle}</div>}
          <span className="ds-page-header-bar" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
            <p className="text-xs text-muted-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
