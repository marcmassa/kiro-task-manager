import { useState } from "react";
import { Task, TaskStatus, AgentExecution } from "../types";
import { TaskCard } from "./TaskCard";
import { KiroIllustration } from "./KiroIllustration";

interface KanbanColumnProps {
  title: string;
  status?: TaskStatus;
  tasks: Task[];
  color: "accent" | "warning" | "success" | "purple" | "indigo" | "yellow";
  executions?: Map<number, AgentExecution>;
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDrop?: (taskId: number, targetStatus: TaskStatus) => void;
  /** When true, drag-and-drop is disabled (SDD phase columns). */
  isSdd?: boolean;
}

const colorMap = {
  accent: {
    dot: "bg-accent",
    text: "text-accent-300",
    badge: "bg-accent/10 text-accent-300",
  },
  warning: {
    dot: "bg-warning",
    text: "text-warning-300",
    badge: "bg-warning/10 text-warning-300",
  },
  success: {
    dot: "bg-success",
    text: "text-success-300",
    badge: "bg-success/10 text-success-300",
  },
  purple: {
    dot: "bg-purple-500",
    text: "text-purple-300",
    badge: "bg-purple-500/10 text-purple-300",
  },
  indigo: {
    dot: "bg-indigo-500",
    text: "text-indigo-300",
    badge: "bg-indigo-500/10 text-indigo-300",
  },
  yellow: {
    dot: "bg-yellow-500",
    text: "text-yellow-300",
    badge: "bg-yellow-500/10 text-yellow-300",
  },
};

export function KanbanColumn({
  title,
  status,
  tasks,
  color,
  executions,
  onViewTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onDrop,
  isSdd = false,
}: KanbanColumnProps) {
  const colors = colorMap[color];
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (isSdd) return;
    e.preventDefault();
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (isSdd) return;
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (isSdd) return;
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (isSdd || !status || !onDrop) return;
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const taskId = data.taskId as number;
      onDrop(taskId, status);
    } catch (error) {
      console.error("Failed to parse drop data:", error);
    }
  }

  return (
    <div
      className={`kanban-column ${isDragOver && !isSdd ? "kanban-column--drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-dropeffect={isSdd ? "none" : "move"}
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
            <p className="text-sm text-muted-400">No hay tareas aquí</p>
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
