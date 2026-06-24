import { useState } from "react";
import { Task, TaskStatus, AgentExecution } from "../types";
import { TaskCard } from "./TaskCard";
import { KiroIllustration } from "./KiroIllustration";
import { columnColorTokens } from "../utils/columnColors";
import { useT } from "../i18n/useT";

interface KanbanColumnProps {
  title: string;
  status?: TaskStatus;
  /** Column identifier for custom/SDD columns that don't map to a TaskStatus. */
  columnId?: string;
  tasks: Task[];
  /** Design-system token ("accent"|"warning"|"success") or a color key from columnColors. */
  color: string;
  executions?: Map<number, AgentExecution>;
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDrop?: (taskId: number, targetColumn: string) => void;
}

const systemColorMap: Record<string, { dot: string; text: string; badge: string }> = {
  accent: { dot: "bg-accent", text: "text-accent-300", badge: "bg-accent/10 text-accent-300" },
  warning: { dot: "bg-warning", text: "text-warning-300", badge: "bg-warning/10 text-warning-300" },
  success: { dot: "bg-success", text: "text-success-300", badge: "bg-success/10 text-success-300" },
};

function resolveColor(color: string) {
  return systemColorMap[color] ?? columnColorTokens(color);
}

export function KanbanColumn({
  title,
  status,
  columnId,
  tasks,
  color,
  executions,
  onViewTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onDrop,
}: KanbanColumnProps) {
  const t = useT();
  const colors = resolveColor(color);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropTarget = columnId ?? status;
  const canDrop = !!dropTarget && !!onDrop;

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    e.preventDefault();
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const taskId = data.taskId as number;
      onDrop!(taskId, dropTarget!);
    } catch (error) {
      console.error("Failed to parse drop data:", error);
    }
  }

  return (
    <div
      className={`kanban-column ${isDragOver ? "kanban-column--drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-dropeffect={canDrop ? "move" : "none"}
    >
      {/* Column Header */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className={`w-2 h-2 rounded-full ${colors.dot}`}></div>
        <h2 className={`font-semibold text-sm ${colors.text}`}>{title}</h2>
        <span className={`ml-auto badge text-xs ${colors.badge}`}>{tasks.length}</span>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center border border-dashed border-white/10 rounded-xl">
            <KiroIllustration mood="vacio" size={48} className="opacity-70" />
            <p className="text-sm text-muted-400">{t("kanban.emptyColumn")}</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              execution={executions?.get(task.id) ?? null}
              onView={() => onViewTask(task)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task)}
              onStatusChange={(newStatus) => onStatusChange(task, newStatus)}
            />
          ))
        )}
      </div>
    </div>
  );
}
