interface PageHeaderProps {
  /** Título en español. */
  title: string;
  /** Subtítulo en español. */
  subtitle: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 bg-surface-600/80 backdrop-blur-xl border-b border-white/5">
      <div className="px-8 py-6">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-muted-400 mt-1">{subtitle}</p>
      </div>
    </header>
  );
}
