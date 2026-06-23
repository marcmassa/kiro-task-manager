import { describe, test, expect } from "bun:test";
import { calculateStats, calcPercent, safeParsedDate } from "./statsCalculator";
import type { Task } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Test task",
    description: "",
    status: "todo",
    sdd_phase: null,
    workspace_id: 1,
    priority_id: 1,
    priority_level: 1,
    priority_name: "Baja",
    priority_color: "#037F0C",
    category_id: 1,
    category_name: "Desarrollo",
    category_color: "#7C5CFC",
    due_date: null,
    created_at: "2024-01-15T10:00:00.000Z",
    updated_at: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

// A fixed reference "now" so tests are deterministic.
const NOW = new Date("2024-06-01T12:00:00.000Z");

// ---------------------------------------------------------------------------
// calcPercent
// ---------------------------------------------------------------------------

describe("calcPercent", () => {
  test("returns 0 when total is 0 (Req 8.4)", () => {
    expect(calcPercent(0, 0)).toBe(0);
  });

  test("returns 50.0 for calcPercent(1, 2)", () => {
    expect(calcPercent(1, 2)).toBe(50.0);
  });

  test("returns 100 when part equals total", () => {
    expect(calcPercent(5, 5)).toBe(100);
  });

  test("rounds to one decimal", () => {
    // 1/3 ≈ 33.3%
    expect(calcPercent(1, 3)).toBe(33.3);
  });
});

// ---------------------------------------------------------------------------
// safeParsedDate
// ---------------------------------------------------------------------------

describe("safeParsedDate", () => {
  test("returns null for null", () => {
    expect(safeParsedDate(null)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(safeParsedDate(undefined)).toBeNull();
  });

  test("returns null for an invalid date string", () => {
    expect(safeParsedDate("fecha-invalida")).toBeNull();
  });

  test("returns a valid Date for a well-formed ISO string", () => {
    const result = safeParsedDate("2024-01-15");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result!.getTime())).toBe(false);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0); // January (0-indexed)
  });

  test("returns null for empty string", () => {
    expect(safeParsedDate("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateStats — empty array (Req 8.4)
// ---------------------------------------------------------------------------

describe("calculateStats — empty array", () => {
  const stats = calculateStats([], NOW);

  test("totalTasks is 0", () => {
    expect(stats.totalTasks).toBe(0);
  });

  test("completionRate is 0", () => {
    expect(stats.completionRate).toBe(0);
  });

  test("overdueTasks is 0", () => {
    expect(stats.overdueTasks).toBe(0);
  });

  test("inProgressTasks is 0", () => {
    expect(stats.inProgressTasks).toBe(0);
  });

  test("urgentPendingTasks is 0", () => {
    expect(stats.urgentPendingTasks).toBe(0);
  });

  test("completedOnTime is 0", () => {
    expect(stats.completedOnTime).toBe(0);
  });

  test("completedLate is 0", () => {
    expect(stats.completedLate).toBe(0);
  });

  test("overdueAndPending is 0", () => {
    expect(stats.overdueAndPending).toBe(0);
  });

  test("all status distribution percentages are 0", () => {
    for (const d of stats.statusDistribution) {
      expect(d.percent).toBe(0);
    }
  });

  test("all priority distribution percentages are 0", () => {
    for (const d of stats.priorityDistribution) {
      expect(d.percent).toBe(0);
    }
  });

  test("category distribution is empty", () => {
    expect(stats.categoryDistribution).toHaveLength(0);
  });

  test("punctualityRate is null (Req 6.6)", () => {
    expect(stats.punctualityRate).toBeNull();
  });

  test("noDueDateTasks is true", () => {
    expect(stats.noDueDateTasks).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateStats — single task (Req 8.5)
// ---------------------------------------------------------------------------

describe("calculateStats — single task", () => {
  test("status percentage is 100 for the task's status", () => {
    const task = makeTask({ status: "in_progress" });
    const stats = calculateStats([task], NOW);

    const inProgressEntry = stats.statusDistribution.find((d) => d.label === "En Progreso");
    expect(inProgressEntry).toBeDefined();
    expect(inProgressEntry!.percent).toBe(100);

    // Other statuses should have 0%
    const todoEntry = stats.statusDistribution.find((d) => d.label === "Por Hacer");
    const doneEntry = stats.statusDistribution.find((d) => d.label === "Completadas");
    expect(todoEntry!.percent).toBe(0);
    expect(doneEntry!.percent).toBe(0);
  });

  test("priority percentage is 100 for the task's priority level", () => {
    const task = makeTask({ priority_level: 3 }); // Alta
    const stats = calculateStats([task], NOW);

    const altaEntry = stats.priorityDistribution.find((d) => d.label === "Alta");
    expect(altaEntry).toBeDefined();
    expect(altaEntry!.percent).toBe(100);

    // Others should be 0
    const others = stats.priorityDistribution.filter((d) => d.label !== "Alta");
    for (const d of others) {
      expect(d.percent).toBe(0);
    }
  });

  test("category percentage is 100 for the task's category (Req 8.5)", () => {
    const task = makeTask({ category_name: "Diseño", category_color: "#FF9900" });
    const stats = calculateStats([task], NOW);

    expect(stats.categoryDistribution).toHaveLength(1);
    expect(stats.categoryDistribution[0].label).toBe("Diseño");
    expect(stats.categoryDistribution[0].percent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// punctualityRate — null when no tasks have due_date (Req 6.6)
// ---------------------------------------------------------------------------

describe("punctualityRate", () => {
  test("is null when no tasks have a due_date", () => {
    const tasks = [
      makeTask({ status: "done", due_date: null }),
      makeTask({ status: "todo", due_date: null }),
    ];
    const stats = calculateStats(tasks, NOW);
    expect(stats.punctualityRate).toBeNull();
  });

  test("is null when done tasks exist but none have a due_date", () => {
    const tasks = [
      makeTask({ id: 1, status: "done", due_date: null }),
      makeTask({ id: 2, status: "done", due_date: null }),
    ];
    const stats = calculateStats(tasks, NOW);
    expect(stats.punctualityRate).toBeNull();
  });

  test("is non-null when at least one done task has a due_date", () => {
    const task = makeTask({
      status: "done",
      due_date: "2024-05-01T00:00:00.000Z",
      updated_at: "2024-04-30T00:00:00.000Z", // completed on time
    });
    const stats = calculateStats([task], NOW);
    expect(stats.punctualityRate).not.toBeNull();
    expect(stats.punctualityRate).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// insufficientWeeklyData (Req 7.5)
// ---------------------------------------------------------------------------

describe("insufficientWeeklyData", () => {
  test("is true for empty task array (0 weeks with data)", () => {
    const stats = calculateStats([], NOW);
    expect(stats.insufficientWeeklyData).toBe(true);
  });

  test("is true when all tasks fall in the same ISO week (1 week with data)", () => {
    // NOW = 2024-06-01 (Saturday). The current ISO week starts 2024-05-27 (Monday).
    const tasks = [
      makeTask({ id: 1, created_at: "2024-05-27T08:00:00.000Z" }),
      makeTask({ id: 2, created_at: "2024-05-28T10:00:00.000Z" }),
      makeTask({ id: 3, created_at: "2024-05-29T14:00:00.000Z" }),
    ];
    const stats = calculateStats(tasks, NOW);
    expect(stats.insufficientWeeklyData).toBe(true);
  });

  test("is false when tasks span at least 2 different ISO weeks", () => {
    // Two tasks in different weeks within the 8-week window.
    const tasks = [
      makeTask({ id: 1, created_at: "2024-05-27T08:00:00.000Z" }), // current week
      makeTask({ id: 2, created_at: "2024-05-20T08:00:00.000Z" }), // previous week
    ];
    const stats = calculateStats(tasks, NOW);
    expect(stats.insufficientWeeklyData).toBe(false);
  });

  test("weeklyActivity always has exactly 8 buckets", () => {
    const stats = calculateStats([], NOW);
    expect(stats.weeklyActivity).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

import * as fc from "fast-check";
import { getISOWeekStart } from "./statsCalculator";

// ---------------------------------------------------------------------------
// Arbitrary generator
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 1, name: "Desarrollo", color: "#7C5CFC" },
  { id: 2, name: "Diseño", color: "#FF9900" },
  { id: 3, name: "Marketing", color: "#037F0C" },
  { id: 4, name: "Investigación", color: "#D91515" },
  { id: 5, name: "Personal", color: "#252F3E" },
];

// Fixed timestamp bounds to avoid fc.date() shrinking issues in fast-check 4.x
const TS_MIN = new Date("2023-01-01T00:00:00.000Z").getTime(); // 1672531200000
const TS_MAX = new Date("2026-12-31T23:59:59.999Z").getTime(); // 1798761599999

function arbitraryISODate(): fc.Arbitrary<string> {
  return fc.integer({ min: TS_MIN, max: TS_MAX }).map((ms) => new Date(ms).toISOString());
}

function arbitraryTask(): fc.Arbitrary<Task> {
  return fc.record({
    id: fc.integer({ min: 1 }),
    title: fc.string({ minLength: 1 }),
    description: fc.string(),
    status: fc.constantFrom<Task["status"]>("todo", "in_progress", "done"),
    sdd_phase: fc.constantFrom<Task["sdd_phase"]>(null),
    workspace_id: fc.integer({ min: 1 }),
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

// ---------------------------------------------------------------------------
// Feature: statistics-dashboard, Property 1: Distribution Partition Invariant
// Validates: Requirements 8.1, 8.2, 8.3, 8.4
// ---------------------------------------------------------------------------

describe("Property-Based Tests", () => {
  test("P1 – distribuciones suman al total de tareas", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTask()), (tasks) => {
        const stats = calculateStats(tasks);
        const statusSum = stats.statusDistribution.reduce((s, d) => s + d.value, 0);
        const prioritySum = stats.priorityDistribution.reduce((s, d) => s + d.value, 0);
        const categorySum = stats.categoryDistribution.reduce((s, d) => s + d.value, 0);
        return (
          stats.totalTasks === tasks.length &&
          statusSum === tasks.length &&
          prioritySum === tasks.length &&
          categorySum === tasks.length
        );
      }),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: statistics-dashboard, Property 2: KPI Filter Correctness
  // Validates: Requirements 2.2, 2.3, 2.4, 2.5
  // ---------------------------------------------------------------------------
  test("P2 – KPIs coinciden con filtros aplicados directamente sobre las tareas", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTask()),
        fc.integer({ min: TS_MIN, max: TS_MAX }).map((ms) => new Date(ms)),
        (tasks, now) => {
          const stats = calculateStats(tasks, now);

          // inProgressTasks === count of tasks with status "in_progress"
          const expectedInProgress = tasks.filter((t) => t.status === "in_progress").length;
          if (stats.inProgressTasks !== expectedInProgress) return false;

          // urgentPendingTasks === count of tasks with priority_level 4 and status !== "done"
          const expectedUrgentPending = tasks.filter(
            (t) => t.priority_level === 4 && t.status !== "done",
          ).length;
          if (stats.urgentPendingTasks !== expectedUrgentPending) return false;

          // overdueTasks === count of tasks with a valid due_date before now and status !== "done"
          const expectedOverdue = tasks.filter(
            (t) =>
              safeParsedDate(t.due_date) !== null &&
              safeParsedDate(t.due_date)! < now &&
              t.status !== "done",
          ).length;
          if (stats.overdueTasks !== expectedOverdue) return false;

          // completionRate formula holds within 0.1 tolerance
          if (tasks.length === 0) {
            if (stats.completionRate !== 0) return false;
          } else {
            const expectedRate =
              (tasks.filter((t) => t.status === "done").length / tasks.length) * 100;
            if (Math.abs(stats.completionRate - expectedRate) >= 0.1) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: statistics-dashboard, Property 3: Date Compliance Filter Correctness
  // Validates: Requirements 6.1, 6.2
  // ---------------------------------------------------------------------------
  test("P3 – completedOnTime y completedLate coinciden con sus predicados y suman tareas done con fecha", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTask()), (tasks) => {
        const stats = calculateStats(tasks);

        // Base set: done tasks with a valid due_date AND a valid updated_at
        const doneWithDate = tasks.filter(
          (t) =>
            t.status === "done" &&
            safeParsedDate(t.due_date) !== null &&
            safeParsedDate(t.updated_at) !== null,
        );

        // Req 6.1: completedOnTime — updated_at <= due_date
        const expectedOnTime = doneWithDate.filter(
          (t) => safeParsedDate(t.updated_at)! <= safeParsedDate(t.due_date)!,
        ).length;
        if (stats.completedOnTime !== expectedOnTime) return false;

        // Req 6.2: completedLate — updated_at > due_date
        const expectedLate = doneWithDate.filter(
          (t) => safeParsedDate(t.updated_at)! > safeParsedDate(t.due_date)!,
        ).length;
        if (stats.completedLate !== expectedLate) return false;

        // Exhaustiveness: on-time + late === all done-with-date tasks
        if (stats.completedOnTime + stats.completedLate !== doneWithDate.length) return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: statistics-dashboard, Property 4: Punctuality Rate Formula
  // Validates: Requirements 6.6
  // ---------------------------------------------------------------------------
  test("P4 – tasa de puntualidad es null cuando el denominador es cero, y coincide con la fórmula dentro de tolerancia 0.05", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTask()), (tasks) => {
        const stats = calculateStats(tasks);

        const onTime = stats.completedOnTime;
        const late = stats.completedLate;
        const denom = onTime + late;

        if (denom === 0) {
          // When there are no completed tasks with a due_date, punctualityRate must be null
          if (stats.punctualityRate !== null) return false;
        } else {
          // When denominator > 0, punctualityRate must be close to the formula result
          if (stats.punctualityRate === null) return false;
          const expected = (onTime / denom) * 100;
          if (Math.abs(stats.punctualityRate - expected) >= 0.05) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: statistics-dashboard, Property 5: Weekly Activity Grouping
  // Validates: Requirements 7.1
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Feature: statistics-dashboard, Property 6: Status Percentage Rounding Tolerance
  // Validates: Requirements 8.6
  // ---------------------------------------------------------------------------
  test("P6 – la suma de porcentajes redondeados está entre 99 y 101", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTask(), { minLength: 1 }), (tasks) => {
        const stats = calculateStats(tasks);
        const roundedSum = stats.statusDistribution.reduce((s, d) => s + Math.round(d.percent), 0);
        return roundedSum >= 99 && roundedSum <= 101;
      }),
      { numRuns: 100 },
    );
  });

  test("P5 – weeklyActivity siempre tiene exactamente 8 buckets y la suma de conteos coincide con las tareas dentro de la ventana de 8 semanas", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTask()),
        fc.integer({ min: TS_MIN, max: TS_MAX }).map((ms) => new Date(ms)),
        (tasks, now) => {
          const stats = calculateStats(tasks, now);

          // Assert exactly 8 buckets
          if (stats.weeklyActivity.length !== 8) return false;

          // Compute the window start: getISOWeekStart(now) minus 7 * 7 days
          const currentWeekStart = getISOWeekStart(now);
          const windowStart = new Date(currentWeekStart);
          windowStart.setDate(currentWeekStart.getDate() - 7 * 7);

          // Count tasks whose created_at falls within the 8-week window
          const tasksInWindow = tasks.filter((t) => {
            const parsed = safeParsedDate(t.created_at);
            if (parsed === null) return false;
            const taskWeekStart = getISOWeekStart(parsed);
            const taskWeekTime = taskWeekStart.getTime();
            // Must be within [windowStart, currentWeekStart] inclusive
            return (
              taskWeekTime >= windowStart.getTime() && taskWeekTime <= currentWeekStart.getTime()
            );
          });

          // Sum of all bucket counts must equal tasks within the window
          const bucketSum = stats.weeklyActivity.reduce((s, w) => s + w.count, 0);
          if (bucketSum !== tasksInWindow.length) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
