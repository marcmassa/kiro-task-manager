import { Task } from "../types";

export interface ChartDataPoint {
  label: string;
  value: number;
  percent: number;
  color: string;
}

/**
 * Parses a date string safely. Returns null for null/undefined/invalid strings.
 */
export function safeParsedDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates a percentage with one decimal place.
 * Returns 0 when total is 0 to avoid division by zero.
 */
export function calcPercent(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Returns the Monday (ISO week start) of the ISO week containing the given date.
 * ISO weeks start on Monday (day 1). Sunday is day 0 in JS, which maps to day 7 in ISO.
 */
export function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  // getDay() returns 0 (Sun) through 6 (Sat); ISO: Mon=1..Sun=7
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // days to subtract to reach Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Counts the tasks in the array that satisfy the given predicate.
 */
export function countTasks(tasks: Task[], predicate: (t: Task) => boolean): number {
  return tasks.filter(predicate).length;
}

export interface WeeklyDataPoint {
  weekLabel: string; // "DD/MM" format
  count: number;
}

/**
 * Builds an array of exactly 8 ISO-week buckets covering the last 8 weeks
 * (from 7 weeks ago Monday through the current week Monday), counting tasks
 * created in each bucket by their `created_at` date.
 */
export function buildWeeklyActivity(tasks: Task[], now?: Date): WeeklyDataPoint[] {
  const reference = now ?? new Date();
  const currentWeekStart = getISOWeekStart(reference);

  // Build the 8 week bucket start dates: weeks[i] = currentWeekStart - (7 - i) * 7 days
  const weeks: Date[] = [];
  for (let i = 0; i < 8; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (7 - i) * 7);
    weeks.push(weekStart);
  }

  // Initialize buckets with zero counts
  const buckets: WeeklyDataPoint[] = weeks.map((weekStart) => ({
    weekLabel: weekStart
      .toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .slice(0, 5),
    count: 0,
  }));

  // Map each task to its matching bucket
  for (const task of tasks) {
    const parsed = safeParsedDate(task.created_at);
    if (parsed === null) continue;
    const taskWeekStart = getISOWeekStart(parsed);
    const taskWeekTime = taskWeekStart.getTime();

    for (let i = 0; i < 8; i++) {
      if (weeks[i].getTime() === taskWeekTime) {
        buckets[i].count++;
        break;
      }
    }
  }

  return buckets;
}

/**
 * Builds the status distribution with three fixed entries in order:
 * todo → "Por Hacer", in_progress → "En Progreso", done → "Completadas".
 */
export function buildStatusDistribution(tasks: Task[]): ChartDataPoint[] {
  const entries: Array<{ status: Task["status"]; label: string; color: string }> = [
    { status: "todo", label: "Por Hacer", color: "hsl(264 100% 64%)" },
    { status: "in_progress", label: "En Progreso", color: "#FF9900" },
    { status: "done", label: "Completadas", color: "#037F0C" },
  ];

  return entries.map(({ status, label, color }) => {
    const count = tasks.filter((t) => t.status === status).length;
    return {
      label,
      value: count,
      percent: calcPercent(count, tasks.length),
      color,
    };
  });
}

/**
 * Builds the priority distribution with four fixed entries in order:
 * level 1 → Baja, 2 → Media, 3 → Alta, 4 → Urgente.
 */
export function buildPriorityDistribution(tasks: Task[]): ChartDataPoint[] {
  const entries: Array<{ level: number; label: string; color: string }> = [
    { level: 1, label: "Baja", color: "#037F0C" },
    { level: 2, label: "Media", color: "#FF9900" },
    { level: 3, label: "Alta", color: "#D91515" },
    { level: 4, label: "Urgente", color: "#920B0B" },
  ];

  return entries.map(({ level, label, color }) => {
    const count = tasks.filter((t) => t.priority_level === level).length;
    return {
      label,
      value: count,
      percent: calcPercent(count, tasks.length),
      color,
    };
  });
}

export interface StatsData {
  // KPIs generales
  totalTasks: number;
  completionRate: number;
  overdueTasks: number;
  inProgressTasks: number;
  urgentPendingTasks: number;
  // Distribuciones
  statusDistribution: ChartDataPoint[];
  priorityDistribution: ChartDataPoint[];
  categoryDistribution: ChartDataPoint[];
  // Cumplimiento de fechas
  completedOnTime: number;
  completedLate: number;
  overdueAndPending: number;
  /** null cuando completedOnTime + completedLate === 0 */
  punctualityRate: number | null;
  /** true cuando ninguna tarea tiene due_date asignado */
  noDueDateTasks: boolean;
  // Actividad semanal
  weeklyActivity: WeeklyDataPoint[];
  insufficientWeeklyData: boolean;
}

/**
 * Derives a complete StatsData snapshot from the given tasks array.
 * Pass an explicit `now` date in tests to get deterministic results.
 */
export function calculateStats(tasks: Task[], now?: Date): StatsData {
  const reference = now ?? new Date();

  // --- KPIs ---
  const totalTasks = tasks.length;
  const completionRate = calcPercent(
    countTasks(tasks, (t) => t.status === "done"),
    totalTasks,
  );

  const isOverdue = (t: Task): boolean =>
    t.due_date !== null &&
    safeParsedDate(t.due_date) !== null &&
    safeParsedDate(t.due_date)! < reference &&
    t.status !== "done";

  const overdueTasks = countTasks(tasks, isOverdue);
  const inProgressTasks = countTasks(tasks, (t) => t.status === "in_progress");
  const urgentPendingTasks = countTasks(
    tasks,
    (t) => t.priority_level === 4 && t.status !== "done",
  );

  // --- Date compliance ---
  const completedOnTime = countTasks(
    tasks,
    (t) =>
      t.status === "done" &&
      safeParsedDate(t.due_date) !== null &&
      safeParsedDate(t.updated_at) !== null &&
      safeParsedDate(t.updated_at)! <= safeParsedDate(t.due_date)!,
  );

  const completedLate = countTasks(
    tasks,
    (t) =>
      t.status === "done" &&
      safeParsedDate(t.due_date) !== null &&
      safeParsedDate(t.updated_at) !== null &&
      safeParsedDate(t.updated_at)! > safeParsedDate(t.due_date)!,
  );

  const overdueAndPending = countTasks(tasks, isOverdue);

  const punctualityDenom = completedOnTime + completedLate;
  const punctualityRate =
    punctualityDenom === 0 ? null : Math.round((completedOnTime / punctualityDenom) * 1000) / 10;

  const noDueDateTasks = tasks.every((t) => t.due_date === null);

  // --- Weekly activity ---
  const weeklyResult = buildWeeklyActivity(tasks, reference);
  const insufficientWeeklyData = weeklyResult.filter((w) => w.count > 0).length < 2;

  return {
    totalTasks,
    completionRate,
    overdueTasks,
    inProgressTasks,
    urgentPendingTasks,
    statusDistribution: buildStatusDistribution(tasks),
    priorityDistribution: buildPriorityDistribution(tasks),
    categoryDistribution: buildCategoryDistribution(tasks),
    completedOnTime,
    completedLate,
    overdueAndPending,
    punctualityRate,
    noDueDateTasks,
    weeklyActivity: weeklyResult,
    insufficientWeeklyData,
  };
}

/**
 * Builds the category distribution by grouping tasks by category_name.
 * Uses the first category_color seen for each name.
 * Only includes categories with at least one task.
 */
export function buildCategoryDistribution(tasks: Task[]): ChartDataPoint[] {
  const colorMap = new Map<string, string>();
  const countMap = new Map<string, number>();

  for (const task of tasks) {
    const name = task.category_name;
    if (!colorMap.has(name)) {
      colorMap.set(name, task.category_color);
    }
    countMap.set(name, (countMap.get(name) ?? 0) + 1);
  }

  const result: ChartDataPoint[] = [];
  for (const [name, count] of countMap.entries()) {
    if (count > 0) {
      result.push({
        label: name,
        value: count,
        percent: calcPercent(count, tasks.length),
        color: colorMap.get(name)!,
      });
    }
  }

  return result;
}
