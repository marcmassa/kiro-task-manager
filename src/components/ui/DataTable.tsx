import { buildTableModel, type DataTableColumn } from "../../utils/uiVariants";

interface DataTableProps {
  /** Definición de columnas (1–12). */
  columns: DataTableColumn[];
  /** Filas: cada fila es un objeto cuyas claves coinciden con column.key. */
  rows: Array<Record<string, React.ReactNode>>;
  /** Mensaje en español cuando no hay filas válidas. Default provisto. */
  emptyMessage?: string;
  /** aria-label de la tabla. */
  "aria-label"?: string;
}

/**
 * Tabla de datos semántica y accesible.
 *
 * Deriva su modelo de render con `buildTableModel`, que descarta las filas con
 * aridad distinta al nº de columnas (R7.6) y expone el estado vacío con el
 * `colSpan` y un mensaje en español (R7.5). La estructura es exactamente un
 * `<table>` → un `<thead>` con una sola fila de cabecera → un `<th scope="col">`
 * por columna → un `<tbody>` (R7.1, R7.3). Cada fila válida produce una `<tr>`
 * con un `<td>` por columna en el orden recibido (R7.2).
 *
 * Las columnas numéricas alinean a la derecha tanto el `<th>` como sus `<td>`
 * con `text-right` (R7.4). El contraste de texto cumple ≥4.5:1 usando
 * `text-muted-300` en cabeceras y `text-gray-200` en celdas (R7.7).
 */
export function DataTable({
  columns,
  rows,
  emptyMessage,
  "aria-label": ariaLabel,
}: DataTableProps) {
  const model = buildTableModel(columns, rows, emptyMessage);

  return (
    <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
      <thead>
        <tr>
          {model.columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={[
                "px-3 py-2 font-medium text-muted-300",
                column.numeric ? "text-right" : "text-left",
              ].join(" ")}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.isEmpty ? (
          <tr>
            <td colSpan={model.colSpan} className="px-3 py-4 text-center text-gray-200">
              {model.emptyMessage}
            </td>
          </tr>
        ) : (
          model.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {model.columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    "px-3 py-2 text-gray-200",
                    column.numeric ? "text-right" : "text-left",
                  ].join(" ")}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
