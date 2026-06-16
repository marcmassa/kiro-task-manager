interface SectionHeaderProps {
  label: string;
  /** Tailwind background-color class for the leading dot. Defaults to `bg-accent`. */
  dotColor?: string;
}

/**
 * Section divider heading with colored dot, label, and horizontal rule.
 *
 * The dot and label are shrink-0; a 1px line fills the remaining space to
 * visually separate sections on dark backgrounds. Shared by both
 * `StatsDashboard` and `SettingsPage`.
 */
export function SectionHeader({ label, dotColor = "bg-accent" }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase shrink-0 text-nowrap">
        {label}
      </h2>
      <span className="h-px flex-1 bg-white/5 rounded-full ml-2" />
    </div>
  );
}
