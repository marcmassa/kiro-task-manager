import { useT } from "../../i18n/useT";

interface StatsTableRow {
  /**
   * Tailwind bg-* class for the accent strip, dot and progress bar.
   * Use tokens from the design system: "bg-accent" | "bg-warning" |
   * "bg-success" | "bg-danger".
   */
  color: string;
  /**
   * Tailwind text-* class for the percent label.
   * Should match the semantic colour of `color`.
   * E.g. "bg-accent" → "text-accent", "bg-warning" → "text-warning".
   */
  textColor: string;
  /** Row label in Spanish. */
  label: string;
  /** Primary numeric value. */
  value: number;
  /** Percentage 0–100 for the inline progress bar width. */
  percent: number;
}

interface StatsTableProps {
  rows: StatsTableRow[];
  /** Unit label shown next to the value. Default: "tareas". Pass "" to hide. */
  unit?: string;
  /** Show the inline progress bar column. Default: true. */
  showBar?: boolean;
}

/**
 * Tabla de distribución estilizada — design system AWS/Kiro.
 *
 * Todas las clases estructurales están definidas en styles.css @layer components.
 * La única propiedad inline es `width` en la barra de progreso (valor dinámico).
 *
 * Filas: strip de color 4px | dot + label | barra proporcional | valor | %
 * Cabecera: visible, uppercase muted, con separador naranja AWS debajo.
 */
export function StatsTable({ rows, unit: unitProp, showBar = true }: StatsTableProps) {
  const t = useT();
  const unit = unitProp ?? t("statsTable.unit");
  if (rows.length === 0) {
    return <p className="text-xs text-muted-500 text-center py-6">{t("statsTable.noData")}</p>;
  }

  const colSpan = showBar ? 5 : 4;

  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead className="stats-table-head">
          <tr>
            <th scope="col" className="stats-table-th w-1 px-0" aria-hidden="true" />
            <th scope="col" className="stats-table-th px-4 text-left">
              {t("statsTable.category")}
            </th>
            {showBar && (
              <th scope="col" className="stats-table-th px-3 text-left">
                {t("statsTable.distribution")}
              </th>
            )}
            <th scope="col" className="stats-table-th px-3 text-right">
              {t("statsTable.total")}
            </th>
            <th scope="col" className="stats-table-th px-4 text-right w-16">
              {t("statsTable.percent")}
            </th>
          </tr>
          <tr aria-hidden="true">
            <td colSpan={colSpan} className="stats-table-head-divider" />
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1;
            return (
              <tr
                key={row.label}
                className={`stats-table-row${isLast ? "" : " stats-table-row-border"}`}
              >
                {/* 4 px left accent strip */}
                <td className={`stats-table-accent-strip ${row.color}`} aria-hidden="true" />

                {/* Label + dot */}
                <td className="stats-table-td-label">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${row.color}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-gray-200 truncate">{row.label}</span>
                  </div>
                </td>

                {/* Progress bar */}
                {showBar && (
                  <td className="stats-table-td-bar" aria-hidden="true">
                    <div className="stats-table-bar-track">
                      <div
                        className={`stats-table-bar-fill ${row.color}`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </td>
                )}

                {/* Value */}
                <td className="stats-table-td-value">
                  <span className="text-sm font-bold text-white">{row.value}</span>
                  {unit && <span className="text-[10px] text-muted-500 ml-1">{unit}</span>}
                </td>

                {/* Percent */}
                <td className="stats-table-td-percent">
                  <span className={`text-xs font-semibold ${row.textColor}`}>
                    {row.percent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
