import type { Task, AgentExecution } from "../types";

export type KanbanColumnId = "todo" | "requirements" | "design" | "tasks" | "in_progress" | "done";

/**
 * Pure function: maps a task + its execution to the Kanban column it should
 * appear in. Agent SDD phases take precedence, then manual task.sdd_phase,
 * then task.status (legacy).
 *
 * Returns string (not just KanbanColumnId) to support arbitrary custom column
 * IDs stored in sdd_phase for custom-type workspaces.
 */
export function effectiveColumn(
  task: Pick<Task, "status" | "sdd_phase">,
  execution: Pick<AgentExecution, "state" | "sdd_phase"> | null,
): string {
  // Agent-driven SDD (execution active)
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
  // Manual SDD or custom workspace column stored in sdd_phase
  if (task.sdd_phase) {
    switch (task.sdd_phase) {
      case "requirements":
        return "requirements";
      case "design":
        return "design";
      case "tasks":
        return "tasks";
      default:
        // Custom workspace column ID — return as-is
        return task.sdd_phase;
    }
  }
  // Standard status
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
