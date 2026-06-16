/**
 * Lógica pura del Sistema de Diseño UI: resolutores de variante a clases de
 * token y modelos de datos sin JSX. Esta capa no depende de React ni del
 * dominio de tareas; solo traduce intenciones semánticas a clases de Tailwind
 * derivadas de los Design Token existentes (surface/accent/success/warning/
 * danger/muted), conforme a R1.3.
 *
 * Convenciones: TypeScript estricto, named exports vía `function`, sin `any`.
 */

// ---------------------------------------------------------------------------
// Tipos de unión de variante (fuente única por componente)
// ---------------------------------------------------------------------------

/** Variantes visuales del Button (R2.1). */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/** Variantes de color semántico del Badge (R3.2). */
export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

/** Color semántico de StatCard aplicado al ícono y su contenedor (R5.2). */
export type StatColor = "accent" | "success" | "warning" | "danger";

/** Color del relleno del ProgressBar (R6.5). */
export type ProgressColor = "accent" | "success" | "warning" | "danger";

/** Padding interno de Card (R4.2). */
export type CardPadding = "estandar" | "compacto";

/** Par de clases de token para el contenedor del ícono y el ícono (R5.3). */
export interface StatColorClasses {
  /** Clase de fondo del contenedor del ícono. */
  container: string;
  /** Clase de color del ícono. */
  icon: string;
}

/** Definición de columna de DataTable (R7.1, R7.4). */
export interface DataTableColumn {
  /** Clave para acceder al valor en cada fila. */
  key: string;
  /** Encabezado en español (1–60 caracteres). */
  header: string;
  /** Si es verdadero, alinea a la derecha las celdas de esa columna. */
  numeric?: boolean;
}

/** Modelo de tabla derivado por `buildTableModel` (R7.5, R7.6). */
export interface TableModel<TRow extends Record<string, unknown>> {
  /** Columnas definidas, sin modificar. */
  columns: DataTableColumn[];
  /** Filas válidas (aridad coincidente con el nº de columnas). */
  rows: TRow[];
  /** Verdadero cuando no hay filas válidas que mostrar. */
  isEmpty: boolean;
  /** Mensaje en español para el estado vacío. */
  emptyMessage: string;
  /** `colSpan` de la celda del estado vacío: nº de columnas definidas. */
  colSpan: number;
}

// ---------------------------------------------------------------------------
// Mapeos de variante a clase de token
// ---------------------------------------------------------------------------

/** Mensaje por defecto del estado vacío de DataTable (R7.5). */
export const DEFAULT_EMPTY_TABLE_MESSAGE = "No hay datos para mostrar";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

const BADGE_VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-white/5 text-muted-300",
  accent: "bg-accent/15 text-accent-300",
  success: "bg-success/15 text-success-300",
  warning: "bg-warning/15 text-warning-300",
  danger: "bg-danger/15 text-danger-300",
};

const STAT_COLOR_CLASSES: Record<StatColor, StatColorClasses> = {
  accent: { container: "bg-accent/15", icon: "text-accent-400" },
  success: { container: "bg-success/15", icon: "text-success-400" },
  warning: { container: "bg-warning/15", icon: "text-warning-400" },
  danger: { container: "bg-danger/15", icon: "text-danger-400" },
};

const PROGRESS_COLOR_CLASSES: Record<ProgressColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

// ---------------------------------------------------------------------------
// Resolutores de variante
// ---------------------------------------------------------------------------

/**
 * Resuelve la clase CSS del Button para una variante (R2.1–R2.4, R2.7).
 *
 * Mapeo exhaustivo `primary|secondary|danger|ghost` → `btn-*`. Cualquier valor
 * ausente o no reconocido cae a `btn-primary` como variante de reserva (R2.2,
 * R2.7).
 */
export function resolveButtonClass(variant?: ButtonVariant | null): string {
  if (variant == null) return BUTTON_VARIANT_CLASSES.primary;
  if (!Object.prototype.hasOwnProperty.call(BUTTON_VARIANT_CLASSES, variant)) {
    return BUTTON_VARIANT_CLASSES.primary;
  }
  return BUTTON_VARIANT_CLASSES[variant as ButtonVariant];
}

/**
 * Resuelve las clases de fondo y texto del Badge para una variante (R3.2, R3.3,
 * R3.6, R3.7).
 *
 * - Variante ausente (`undefined`/`null`): `neutral` por defecto (R3.2).
 * - Variante reconocida: sus clases de token de fondo y texto (R3.3).
 * - Variante no reconocida: cadena vacía, de modo que el componente conserva
 *   solo su estilo base sin colores de variante (reserva R3.6).
 */
export function resolveBadgeClass(variant?: BadgeVariant | null): string {
  if (variant == null) return BADGE_VARIANT_CLASSES.neutral;
  if (!Object.prototype.hasOwnProperty.call(BADGE_VARIANT_CLASSES, variant)) {
    return "";
  }
  return BADGE_VARIANT_CLASSES[variant as BadgeVariant];
}

/**
 * Resuelve las clases de color del contenedor del ícono y del ícono de una
 * StatCard (R5.2, R5.3). Un color ausente o no reconocido cae a `accent`.
 */
export function resolveStatColor(color?: StatColor | null): StatColorClasses {
  if (color == null) return STAT_COLOR_CLASSES.accent;
  if (!Object.prototype.hasOwnProperty.call(STAT_COLOR_CLASSES, color)) {
    return STAT_COLOR_CLASSES.accent;
  }
  return STAT_COLOR_CLASSES[color as StatColor];
}

/**
 * Resuelve la clase de fondo del relleno del ProgressBar (R6.3, R6.5). Un color
 * ausente o no reconocido cae a `bg-accent`.
 */
export function resolveProgressColor(color?: ProgressColor | null): string {
  if (color == null) return PROGRESS_COLOR_CLASSES.accent;
  if (!Object.prototype.hasOwnProperty.call(PROGRESS_COLOR_CLASSES, color)) {
    return PROGRESS_COLOR_CLASSES.accent;
  }
  return PROGRESS_COLOR_CLASSES[color as ProgressColor];
}

/**
 * Resuelve la clase de padding de una Card (R4.3, R4.4). El valor por defecto y
 * el de reserva ante un valor no reconocido es `p-6` (estándar).
 */
export function resolveCardPadding(padding?: CardPadding | null): string {
  return padding === "compacto" ? "p-4" : "p-6";
}

// ---------------------------------------------------------------------------
// Helpers de presentación pura
// ---------------------------------------------------------------------------

/**
 * Construye el `aria-label` legible de una métrica con el formato
 * `"Etiqueta: valor"` (R5.4).
 */
export function formatStatAriaLabel(label: string, value: string | number): string {
  return `${label}: ${value}`;
}

/**
 * Limita un valor de porcentaje al rango entero [0, 100] (R6.1, R6.2, R6.4,
 * R6.6).
 *
 * - No número (incluye `null`/`undefined`/`NaN`): 0 (R6.4).
 * - Menor que 0: 0 (R6.2).
 * - Mayor que 100: 100 (R6.3).
 * - En rango: entero redondeado con `Math.round` (R6.6).
 *
 * Es idempotente: `clampPercent(clampPercent(v)) === clampPercent(v)` porque la
 * salida siempre es un entero ya contenido en [0, 100].
 */
export function clampPercent(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

/**
 * Filtra las filas cuya aridad difiere del nº de columnas definidas (R7.6).
 *
 * Una fila es válida cuando contiene una clave por cada `column.key` definido;
 * las filas con claves faltantes se descartan y las válidas se conservan en su
 * orden original.
 */
export function filterValidRows<TRow extends Record<string, unknown>>(
  columns: DataTableColumn[],
  rows: TRow[],
): TRow[] {
  return rows.filter((row) =>
    columns.every((column) => Object.prototype.hasOwnProperty.call(row, column.key)),
  );
}

/**
 * Construye el modelo de render de una DataTable (R7.5, R7.6).
 *
 * Descarta las filas con aridad inválida (R7.6) y expone el estado vacío con el
 * `colSpan` igual al nº de columnas y un mensaje en español por defecto cuando
 * no quedan filas válidas (R7.5).
 */
export function buildTableModel<TRow extends Record<string, unknown>>(
  columns: DataTableColumn[],
  rows: TRow[],
  emptyMessage: string = DEFAULT_EMPTY_TABLE_MESSAGE,
): TableModel<TRow> {
  const validRows = filterValidRows(columns, rows);
  const message = emptyMessage.trim().length > 0 ? emptyMessage : DEFAULT_EMPTY_TABLE_MESSAGE;
  return {
    columns,
    rows: validRows,
    isEmpty: validRows.length === 0,
    emptyMessage: message,
    colSpan: columns.length,
  };
}
