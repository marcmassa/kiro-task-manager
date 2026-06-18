interface PageHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Cabecera de página sticky con paleta AWS/Kiro.
 *
 * Clases del design system (definidas en styles.css @layer components):
 *   ds-page-header       — fondo Squid Ink + blur + borde naranja AWS inferior
 *   ds-page-header-inner — padding + layout flex
 *   ds-page-header-bar   — barra vertical accent de 3×36 px
 *
 * Contratos de test (R9.3 / R9.4):
 *   - Elemento raíz <header> con clases sticky y backdrop-blur-xl (incluidas en ds-page-header).
 *   - Título en <h1>, subtítulo en <p>.
 */
export function PageHeader({ title, subtitle }: PageHeaderProps): JSX.Element {
  return (
    <header className="ds-page-header sticky top-0 z-10 backdrop-blur-xl">
      <div className="ds-page-header-inner">
        <span className="ds-page-header-bar" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
          <p className="text-xs text-muted-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
