import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import {
  resolveButtonClass,
  resolveBadgeClass,
  resolveStatColor,
  resolveProgressColor,
  formatStatAriaLabel,
  clampPercent,
  buildTableModel,
  type ButtonVariant,
  type BadgeVariant,
  type StatColor,
  type ProgressColor,
  type DataTableColumn,
} from "./uiVariants";

// ---------------------------------------------------------------------------
// Property-Based Tests del Sistema de Diseño UI (uiVariants)
//
// Cada propiedad de corrección del diseño vive en su propio bloque `describe`.
// Las tareas 2.2–2.7 APENDIZARÁN más propiedades a este mismo archivo, una por
// bloque, conservando esta estructura.
// ---------------------------------------------------------------------------

// Las cuatro variantes válidas del Button (R2.1).
const BUTTON_VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "danger", "ghost"];

// Mapeo esperado variante → clase btn-* (R2.3, R2.4 y equivalentes danger/ghost).
const EXPECTED_BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

// Conjunto de clases btn-* conocidas para la verificación de totalidad.
const KNOWN_BUTTON_CLASSES = new Set(Object.values(EXPECTED_BUTTON_CLASS));

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 1: Resolución total de variantes de Button
// Validates: Requirements 2.1, 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------

describe("Property 1 — Resolución total de variantes de Button", () => {
  test("P1 — toda variante válida resuelve total y exhaustivamente a su clase btn-* conocida", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BUTTON_VARIANTS), (variant) => {
        const result = resolveButtonClass(variant);

        // Totalidad: siempre devuelve una cadena no vacía.
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);

        // Exhaustividad: el resultado es una de las clases btn-* conocidas.
        expect(KNOWN_BUTTON_CLASSES.has(result)).toBe(true);

        // Mapeo exacto: primary→btn-primary, secondary→btn-secondary,
        // danger→btn-danger, ghost→btn-ghost.
        expect(result).toBe(EXPECTED_BUTTON_CLASS[variant]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 2: Resolución de variantes de Badge a tokens
// Validates: Requirements 3.2, 3.3
// ---------------------------------------------------------------------------

// Las cinco variantes de color semántico válidas del Badge (R3.2).
const BADGE_VARIANTS: readonly BadgeVariant[] = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
];

// Mapeo esperado variante → clases token de fondo + texto (tabla
// BADGE_VARIANT_CLASSES de uiVariants.ts, R3.3).
const EXPECTED_BADGE_CLASS: Record<BadgeVariant, string> = {
  neutral: "bg-white/5 text-muted-300",
  accent: "bg-accent/15 text-accent-300",
  success: "bg-success/15 text-success-300",
  warning: "bg-warning/15 text-warning-300",
  danger: "bg-danger/15 text-danger-300",
};

describe("Property 2 — Resolución de variantes de Badge a tokens", () => {
  test("P2 — toda variante reconocida resuelve a sus clases token de fondo y texto", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BADGE_VARIANTS), (variant) => {
        const result = resolveBadgeClass(variant);

        // Devuelve una cadena no vacía para toda variante reconocida (R3.2).
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);

        // Mapeo exacto a las clases de fondo y texto basadas en token (R3.3).
        expect(result).toBe(EXPECTED_BADGE_CLASS[variant]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 3: Reserva de Badge ante variante no reconocida
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------

// Conjunto de las cinco variantes reconocidas del Badge, para excluirlas del
// espacio de cadenas arbitrarias generadas.
const RECOGNIZED_BADGE_VARIANTS = new Set<string>([
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
]);

describe("Property 3 — Reserva de Badge ante variante no reconocida", () => {
  test("P3 — toda cadena fuera del conjunto reconocido resuelve a la reserva base (cadena vacía)", () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => !RECOGNIZED_BADGE_VARIANTS.has(value)),
        (unrecognized) => {
          // Una variante no reconocida cae a la reserva base-only: cadena vacía,
          // de modo que el Badge conserva solo su estilo base sin colores de
          // variante (R3.6).
          const result = resolveBadgeClass(unrecognized as BadgeVariant);

          expect(typeof result).toBe("string");
          expect(result).toBe("");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 4: Resolución de color semántico (StatCard y ProgressBar)
// Validates: Requirements 5.2, 5.3, 6.3
// ---------------------------------------------------------------------------

// Los cuatro colores semánticos válidos compartidos por StatCard y ProgressBar
// (R5.2, R6.5).
const STAT_COLORS: readonly StatColor[] = ["accent", "success", "warning", "danger"];

// Mapeo esperado color → clases del contenedor del ícono y del ícono
// (tabla STAT_COLOR_CLASSES de uiVariants.ts, R5.3).
const EXPECTED_STAT_COLOR: Record<StatColor, { container: string; icon: string }> = {
  accent: { container: "bg-accent/15", icon: "text-accent-400" },
  success: { container: "bg-success/15", icon: "text-success-400" },
  warning: { container: "bg-warning/15", icon: "text-warning-400" },
  danger: { container: "bg-danger/15", icon: "text-danger-400" },
};

// Mapeo esperado color → clase de fondo del relleno del ProgressBar
// (tabla PROGRESS_COLOR_CLASSES de uiVariants.ts, R6.3).
const EXPECTED_PROGRESS_COLOR: Record<ProgressColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

describe("Property 4 — Resolución de color semántico (StatCard y ProgressBar)", () => {
  test("P4 — todo color semántico resuelve a las clases token esperadas de StatCard y ProgressBar", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STAT_COLORS), (color) => {
        // StatCard: contenedor del ícono e ícono según la tabla de tokens (R5.2, R5.3).
        const statClasses = resolveStatColor(color);
        expect(statClasses.container).toBe(EXPECTED_STAT_COLOR[color].container);
        expect(statClasses.icon).toBe(EXPECTED_STAT_COLOR[color].icon);

        // ProgressBar: clase de fondo del relleno según la tabla de tokens (R6.3).
        const progressClass = resolveProgressColor(color as ProgressColor);
        expect(progressClass).toBe(EXPECTED_PROGRESS_COLOR[color as ProgressColor]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 5: Formato del aria-label de métrica
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe("Property 5 — Formato del aria-label de métrica", () => {
  test("P5 — formatStatAriaLabel produce siempre `${label}: ${value}`", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.oneof(fc.string(), fc.integer(), fc.double({ noNaN: true })),
        (label, value) => {
          const result = formatStatAriaLabel(label, value);

          // Formato legible "Etiqueta: valor" para cualquier etiqueta y valor (R5.4).
          expect(result).toBe(`${label}: ${value}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 6: Invariantes de clamping del ProgressBar
// Validates: Requirements 6.1, 6.2, 6.4
// ---------------------------------------------------------------------------

describe("Property 6 — Invariantes de clamping del ProgressBar", () => {
  test("P6 — clampPercent produce siempre un entero en [0, 100] y es idempotente", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.double(),
          fc.double({ min: -1000, max: 1000 }),
          fc.constant(Number.NaN),
        ),
        (value) => {
          const result = clampPercent(value);

          // Siempre un entero dentro del rango [0, 100] (R6.6).
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);

          // Límites direccionales: <0 → 0 (R6.2), >100 → 100 (R6.3), NaN → 0 (R6.4).
          if (typeof value === "number" && Number.isNaN(value)) {
            expect(result).toBe(0);
          } else if (typeof value === "number" && value < 0) {
            expect(result).toBe(0);
          } else if (typeof value === "number" && value > 100) {
            expect(result).toBe(100);
          }

          // Idempotencia: clampPercent(clampPercent(v)) === clampPercent(v).
          expect(clampPercent(result)).toBe(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P6 — entradas no numéricas (null/undefined) se limitan a 0", () => {
    expect(clampPercent(null)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 8: Invariantes de fila y colspan de DataTable
// Validates: Requirements 7.3, 7.5
// ---------------------------------------------------------------------------

// Generador de columnas con claves únicas y consistentes (1–12 columnas).
const columnsArb = fc.integer({ min: 1, max: 12 }).map<DataTableColumn[]>((count) =>
  Array.from({ length: count }, (_unused, index) => ({
    key: `col${index}`,
    header: `Columna ${index + 1}`,
    numeric: index % 2 === 0,
  })),
);

// A partir de un conjunto de columnas, genera filas: válidas (todas las claves
// presentes) o inválidas (al menos una clave faltante), de forma arbitraria.
function rowsArbFor(columns: DataTableColumn[]) {
  const validRowArb = fc.constant(
    Object.fromEntries(columns.map((column) => [column.key, `${column.key}-valor`])),
  );

  // Fila inválida: omite la primera clave (aridad distinta al nº de columnas).
  const invalidRowArb = fc.constant(
    Object.fromEntries(columns.slice(1).map((column) => [column.key, `${column.key}-valor`])),
  );

  return fc.array(fc.oneof(validRowArb, invalidRowArb), { minLength: 0, maxLength: 50 });
}

describe("Property 8 — Invariantes de fila y colspan de DataTable", () => {
  test("P8 — el modelo respeta colSpan, conserva solo filas con aridad completa y marca el vacío", () => {
    fc.assert(
      fc.property(
        columnsArb.chain((columns) => rowsArbFor(columns).map((rows) => ({ columns, rows }))),
        ({ columns, rows }) => {
          const model = buildTableModel(columns, rows);

          // colSpan siempre igual al nº de columnas definidas (R7.5).
          expect(model.colSpan).toBe(columns.length);

          // Toda fila conservada tiene aridad coincidente: cada column.key presente (R7.3 estructura).
          for (const row of model.rows) {
            for (const column of columns) {
              expect(Object.prototype.hasOwnProperty.call(row, column.key)).toBe(true);
            }
          }

          // Coherencia del estado vacío: sin filas válidas → isEmpty con mensaje en español no vacío (R7.5).
          if (model.rows.length === 0) {
            expect(model.isEmpty).toBe(true);
            expect(typeof model.emptyMessage).toBe("string");
            expect(model.emptyMessage.trim().length).toBeGreaterThan(0);
          } else {
            expect(model.isEmpty).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
