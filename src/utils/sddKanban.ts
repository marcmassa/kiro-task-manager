import type { Task, AgentExecution } from "../types";

export type KanbanColumnId = "todo" | "requirements" | "design" | "tasks" | "in_progress" | "done";

/**
 * Pure function: maps a task + its execution to the Kanban column it should
 * appear in. SDD phases take precedence over task.status.
 */
export function effectiveColumn(
  task: Pick<Task, "status">,
  execution: Pick<AgentExecution, "state" | "sdd_phase"> | null,
): KanbanColumnId {
  if (execution && execution.state !== "done" && execution.sdd_phase) {
    switch (execution.sdd_phase) {
      case "requirements":
        return "requirements";
      case "design":
        return "design";
      case "tasks":
        return "tasks";
      case "execution":
        return "in_progress";
    }
  }
  // Legacy / no SDD
  if (task.status === "done") return "done";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
}

export const VALID_COLUMN_IDS: readonly KanbanColumnId[] = [
  "todo",
  "requirements",
  "design",
  "tasks",
  "in_progress",
  "done",
] as const;
