import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { StatsDashboard } from "./StatsDashboard";
import { calculateStats } from "../utils/statsCalculator";
import type { Task } from "../types";

// ---------------------------------------------------------------------------
// Arbitrary generator (consistente con src/utils/statsCalculator.test.ts)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 1, name: "Desarrollo", color: "#7C5CFC" },
  { id: 2, name: "Diseño", color: "#FF9900" },
  { id: 3, name: "Marketing", color: "#037F0C" },
  { id: 4, name: "Investigación", color: "#D91515" },
  { id: 5, name: "Personal", color: "#252F3E" },
];

// Límites de timestamp fijos para evitar problemas de shrinking de fc.date() en fast-check 4.x
const TS_MIN = new Date("2023-01-01T00:00:00.000Z").getTime();
const TS_MAX = new Date("2026-12-31T23:59:59.999Z").getTime();

function arbitraryISODate(): fc.Arbitrary<string> {
  return fc.integer({ min: TS_MIN, max: TS_MAX }).map((ms) => new Date(ms).toISOString());
}

function arbitraryTask(): fc.Arbitrary<Task> {
  return fc.record({
    id: fc.integer({ min: 1 }),
    title: fc.string({ minLength: 1 }),
    description: fc.string(),
    status: fc.constantFrom<Task["status"]>("todo", "in_progress", "done"),
    priority_id: fc.integer({ min: 1, max: 4 }),
    priority_level: fc.integer({ min: 1, max: 4 }),
    priority_name: fc.string({ minLength: 1 }),
    priority_color: fc.constantFrom("#037F0C", "#FF9900", "#D91515", "#920B0B"),
    category_id: fc.integer({ min: 1, max: 5 }),
    category_name: fc.constantFrom(...CATEGORIES.map((c) => c.name)),
    category_color: fc.constantFrom(...CATEGORIES.map((c) => c.color)),
    due_date: fc.option(arbitraryISODate(), { nil: null }),
    created_at: arbitraryISODate(),
    updated_at: arbitraryISODate(),
  });
}

/** Renderiza el dashboard refactorizado a markup estático para un conjunto de tareas. */
function renderDashboard(tasks: Task[]): string {
  return renderToStaticMarkup(
    <StatsDashboard tasks={tasks} loading={false} error={null} onRetry={() => {}} />,
  );
}

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Property 9: Equivalencia de métricas tras el refactor
// Validates: Requirements 12.7
// ---------------------------------------------------------------------------

describe("StatsDashboard — Property 9: equivalencia de métricas tras el refactor", () => {
  test("para cualquier conjunto no vacío de tareas, el markup contiene los mismos valores de métrica que calculateStats", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTask(), { minLength: 1 }), (tasks) => {
        const stats = calculateStats(tasks);
        const markup = renderDashboard(tasks);

        // Los KPIs calculados por calculateStats aparecen en el markup renderizado (R12.7).
        const metricValues = [
          stats.totalTasks,
          stats.overdueTasks,
          stats.inProgressTasks,
          stats.urgentPendingTasks,
          stats.completionRate,
        ];

        for (const value of metricValues) {
          expect(markup).toContain(String(value));
        }
      }),
      { numRuns: 100 },
    );
  });

  test("para cualquier conjunto no vacío de tareas, el markup conserva los textos de métrica canónicos en español", () => {
    const SPANISH_LABELS = [
      "Total tareas",
      "Tareas vencidas",
      "En progreso",
      "Urgentes pendientes",
      "Tasa de Cumplimiento",
    ];

    fc.assert(
      fc.property(fc.array(arbitraryTask(), { minLength: 1 }), (tasks) => {
        const markup = renderDashboard(tasks);

        for (const label of SPANISH_LABELS) {
          expect(markup).toContain(label);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("el conjunto vacío de tareas renderiza el EmptyState en lugar de las métricas (guarda de caso vacío)", () => {
    const markup = renderDashboard([]);
    expect(markup).toContain("Sin datos todavía");
    expect(markup).not.toContain("Tasa de Cumplimiento");
  });
});

// ---------------------------------------------------------------------------
// Feature: ui-design-system, Tests de ejemplo: adopción de la Component_Library
// Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.8
// ---------------------------------------------------------------------------

/** Fixture determinista no vacío que cubre los tres estados y prioridades variadas. */
const FIXTURE_TASKS: Task[] = [
  {
    id: 1,
    title: "Diseñar API",
    description: "Definir contratos REST",
    status: "todo",
    priority_id: 4,
    category_id: 1,
    due_date: "2024-01-10T00:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
    priority_name: "Urgente",
    priority_color: "#D91515",
    priority_level: 4,
    category_name: "Desarrollo",
    category_color: "#7C5CFC",
  },
  {
    id: 2,
    title: "Maquetar dashboard",
    description: "Layout de estadísticas",
    status: "in_progress",
    priority_id: 2,
    category_id: 2,
    due_date: "2024-02-15T00:00:00.000Z",
    created_at: "2024-01-05T00:00:00.000Z",
    updated_at: "2024-01-06T00:00:00.000Z",
    priority_name: "Media",
    priority_color: "#FF9900",
    priority_level: 2,
    category_name: "Diseño",
    category_color: "#FF9900",
  },
  {
    id: 3,
    title: "Escribir tests",
    description: "Cobertura de utilidades",
    status: "done",
    priority_id: 3,
    category_id: 1,
    due_date: "2024-01-20T00:00:00.000Z",
    created_at: "2024-01-08T00:00:00.000Z",
    updated_at: "2024-01-19T00:00:00.000Z",
    priority_name: "Alta",
    priority_color: "#D91515",
    priority_level: 3,
    category_name: "Desarrollo",
    category_color: "#7C5CFC",
  },
  {
    id: 4,
    title: "Investigar mercado",
    description: "Análisis de competidores",
    status: "done",
    priority_id: 1,
    category_id: 4,
    due_date: null,
    created_at: "2024-01-03T00:00:00.000Z",
    updated_at: "2024-01-12T00:00:00.000Z",
    priority_name: "Baja",
    priority_color: "#037F0C",
    priority_level: 1,
    category_name: "Investigación",
    category_color: "#D91515",
  },
];

describe("StatsDashboard — adopción de la Component_Library (ejemplos)", () => {
  test("usa PageHeader: renderiza un <header> con el título 'Estadísticas' (R12.3)", () => {
    const markup = renderDashboard(FIXTURE_TASKS);
    expect(markup).toContain("<header");
    expect(markup).toContain("Estadísticas");
  });

  test("usa cuatro StatCard: muestra las cuatro etiquetas de KPI sobre la superficie 'home-stat-card' (R12.1)", () => {
    const markup = renderDashboard(FIXTURE_TASKS);
    const kpiLabels = ["Total tareas", "Tareas vencidas", "En progreso", "Urgentes pendientes"];
    for (const label of kpiLabels) {
      expect(markup).toContain(label);
    }
    // La superficie StatCard aparece una vez por cada uno de los cuatro KPIs.
    const surfaceMatches = markup.match(/home-stat-card/g) ?? [];
    expect(surfaceMatches.length).toBe(4);
  });

  test("usa Card + SectionHeader: renderiza las etiquetas de sección de los gráficos (R12.2)", () => {
    const markup = renderDashboard(FIXTURE_TASKS);
    const sectionLabels = ["Por estado", "Por prioridad", "Por categoría", "Actividad semanal"];
    for (const label of sectionLabels) {
      expect(markup).toContain(label);
    }
  });

  test("usa DataTable para la distribución por estado: <table> con cabecera scope='col' 'Estado' (R12.5)", () => {
    const markup = renderDashboard(FIXTURE_TASKS);
    expect(markup).toContain("<table");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("Estado");
    // El gráfico de barras coexiste con la tabla, no se elimina.
    expect(markup).toContain('role="img"');
  });

  test("preserva la estructura accesible: <main>, <section aria-label> y gráficos role='img' (R12.8)", () => {
    const markup = renderDashboard(FIXTURE_TASKS);
    expect(markup).toContain("<main");
    expect(markup).toContain("<section");
    expect(markup).toContain("aria-label=");
    expect(markup).toContain('role="img"');
  });
});

describe("StatsDashboard — estados de vista StateView (ejemplos)", () => {
  test("loading=true renderiza el LoadingState con role='status' (R12.4)", () => {
    const markup = renderToStaticMarkup(
      <StatsDashboard tasks={FIXTURE_TASKS} loading={true} error={null} onRetry={() => {}} />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Cargando estadísticas...");
  });

  test("error + onRetry renderiza el ErrorState con mensaje y botón 'Reintentar' (R12.4)", () => {
    const markup = renderToStaticMarkup(
      <StatsDashboard
        tasks={FIXTURE_TASKS}
        loading={false}
        error="No se pudieron cargar las estadísticas"
        onRetry={() => {}}
      />,
    );
    expect(markup).toContain("No se pudieron cargar las estadísticas");
    expect(markup).toContain("Reintentar");
  });

  test("tasks=[] renderiza el EmptyState 'Sin datos todavía' (R12.4)", () => {
    const markup = renderDashboard([]);
    expect(markup).toContain("Sin datos todavía");
  });
});
