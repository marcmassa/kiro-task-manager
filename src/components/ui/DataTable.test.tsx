import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable } from "./DataTable";
import { DEFAULT_EMPTY_TABLE_MESSAGE, type DataTableColumn } from "../../utils/uiVariants";

// ---------------------------------------------------------------------------
// Helpers
//
// Este repositorio no tiene una librería de testing de DOM, por lo que se
// reutiliza el patrón de `Badge.test.tsx` / `ProgressBar.test.tsx`: renderizar
// a un string de HTML con `renderToStaticMarkup` y verificar el markup con
// regex/checks de string.
// ---------------------------------------------------------------------------

/** Definición de columnas de ejemplo: dos de texto y una numérica. */
const COLUMNS: DataTableColumn[] = [
  { key: "estado", header: "Estado" },
  { key: "categoria", header: "Categoría" },
  { key: "total", header: "Total", numeric: true },
];

/** Cuenta las ocurrencias no solapadas de una subcadena en el markup. */
function countOccurrences(markup: string, needle: string): number {
  let count = 0;
  let index = markup.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = markup.indexOf(needle, index + needle.length);
  }
  return count;
}

/** Extrae el bloque `<th ...>...</th>` correspondiente a un encabezado dado. */
function thBlockFor(markup: string, header: string): string | null {
  const regex = new RegExp(`<th[^>]*>${header}</th>`);
  const match = regex.exec(markup);
  return match ? match[0] : null;
}

/** Extrae todos los bloques `<td ...>...</td>` del markup. */
function tdBlocks(markup: string): string[] {
  return markup.match(/<td[^>]*>.*?<\/td>/g) ?? [];
}

/** Cuenta los elementos `<th>` (con espacio, para no confundir con `<thead>`). */
function thCount(markup: string): number {
  return countOccurrences(markup, "<th ");
}

/** Comprueba un `colspan` dado, de forma insensible a mayúsculas/minúsculas. */
function hasColSpan(cell: string, value: number): boolean {
  return new RegExp(`colspan="${value}"`, "i").test(cell);
}

// ---------------------------------------------------------------------------
// R7.1 — Estructura semántica table/thead/tbody/th/td presente
// ---------------------------------------------------------------------------

describe("DataTable — estructura HTML semántica (R7.1)", () => {
  test("renderiza un único `<table>`, `<thead>` y `<tbody>`", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);

    expect(countOccurrences(markup, "<table")).toBe(1);
    expect(countOccurrences(markup, "<thead")).toBe(1);
    expect(countOccurrences(markup, "<tbody")).toBe(1);
  });

  test("renderiza un `<th>` por columna y un `<td>` por celda de datos", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);

    // 3 columnas → 3 `<th>`; 1 fila × 3 columnas → 3 `<td>`.
    expect(thCount(markup)).toBe(COLUMNS.length);
    expect(tdBlocks(markup).length).toBe(COLUMNS.length);
  });

  test("propaga el `aria-label` recibido a la tabla", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(
      <DataTable columns={COLUMNS} rows={rows} aria-label="Distribución por estado" />,
    );
    expect(markup).toContain('aria-label="Distribución por estado"');
  });
});

// ---------------------------------------------------------------------------
// R7.3 — `scope="col"` en cada celda de cabecera
// ---------------------------------------------------------------------------

describe("DataTable — `scope=col` en las cabeceras (R7.3)", () => {
  test("cada `<th>` expone `scope=col`", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);

    // Tantos `scope="col"` como columnas, uno por cada `<th>`.
    expect(countOccurrences(markup, 'scope="col"')).toBe(COLUMNS.length);
  });
});

// ---------------------------------------------------------------------------
// R7.4 — Columna numérica → alineación a la derecha en sus celdas
// ---------------------------------------------------------------------------

describe("DataTable — alineación derecha de columnas numéricas (R7.4)", () => {
  test("la cabecera de la columna numérica aplica `text-right`", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);

    const totalTh = thBlockFor(markup, "Total");
    expect(totalTh).not.toBeNull();
    expect(totalTh as string).toContain("text-right");
  });

  test("las celdas de la columna numérica aplican `text-right` y las de texto no", () => {
    const rows = [{ estado: "Por Hacer", categoria: "Desarrollo", total: 5 }];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);
    const cells = tdBlocks(markup);

    // Orden de columnas: estado, categoria, total (numérica).
    const [estadoTd, categoriaTd, totalTd] = cells;
    expect(estadoTd).toContain("text-left");
    expect(estadoTd).not.toContain("text-right");
    expect(categoriaTd).toContain("text-left");
    expect(categoriaTd).not.toContain("text-right");
    expect(totalTd).toContain("text-right");
  });
});

// ---------------------------------------------------------------------------
// R7.5 — `rows=[]` → fila única con mensaje en español y `colspan`
// ---------------------------------------------------------------------------

describe("DataTable — estado vacío (R7.5)", () => {
  test("sin filas, renderiza una única `<td>` con `colspan` igual al nº de columnas", () => {
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={[]} />);
    const cells = tdBlocks(markup);

    expect(cells.length).toBe(1);
    expect(hasColSpan(cells[0], COLUMNS.length)).toBe(true);
  });

  test("sin filas, muestra el mensaje en español por defecto", () => {
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={[]} />);
    expect(markup).toContain(DEFAULT_EMPTY_TABLE_MESSAGE);
  });

  test("sin filas, usa el `emptyMessage` personalizado cuando se provee", () => {
    const markup = renderToStaticMarkup(
      <DataTable columns={COLUMNS} rows={[]} emptyMessage="No hay tareas registradas" />,
    );
    expect(markup).toContain("No hay tareas registradas");
  });
});

// ---------------------------------------------------------------------------
// R7.6 — Fila con aridad inválida omitida sin romper la tabla
// ---------------------------------------------------------------------------

describe("DataTable — omisión de filas con aridad inválida (R7.6)", () => {
  test("omite la fila a la que le falta una clave de columna y conserva las válidas", () => {
    const rows = [
      { estado: "Por Hacer", categoria: "Desarrollo", total: 5 },
      // Fila inválida: le falta la clave `total`.
      { estado: "En Progreso", categoria: "Diseño" } as Record<string, React.ReactNode>,
      { estado: "Completada", categoria: "Marketing", total: 8 },
    ];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);

    // Solo 2 filas válidas × 3 columnas → 6 `<td>` de datos.
    expect(tdBlocks(markup).length).toBe(2 * COLUMNS.length);

    // El contenido de las filas válidas se conserva.
    expect(markup).toContain("Por Hacer");
    expect(markup).toContain("Completada");
    // El contenido de la fila inválida se descarta.
    expect(markup).not.toContain("En Progreso");
  });

  test("si todas las filas son inválidas, cae al estado vacío sin romper la tabla", () => {
    const rows = [
      { estado: "Por Hacer" } as Record<string, React.ReactNode>,
      { categoria: "Diseño", total: 3 } as Record<string, React.ReactNode>,
    ];
    const markup = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={rows} />);
    const cells = tdBlocks(markup);

    expect(countOccurrences(markup, "<table")).toBe(1);
    expect(cells.length).toBe(1);
    expect(hasColSpan(cells[0], COLUMNS.length)).toBe(true);
    expect(markup).toContain(DEFAULT_EMPTY_TABLE_MESSAGE);
  });
});
