import { useState } from "react";
import { Task, TaskStatus, AgentExecution } from "../types";
import {
  PencilIcon,
  TrashIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CalendarIcon,
  FireIcon,
  TargetIcon,
  RobotIcon,
} from "../Icons";
import { agentStateDisplay } from "../utils/agentStateDisplay";

interface TaskCardProps {
  task: Task;
  execution?: AgentExecution | null;
  fileChangesCount?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
}

function getNextStatus(current: TaskStatus): TaskStatus | null {
  if (current === "todo") return "in_progress";
  if (current === "in_progress") return "done";
  return null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isSameDay(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getPriorityIcon(level: number) {
  if (level >= 4) return <FireIcon size={12} className="text-danger-400" />;
  if (level >= 3) return <TargetIcon size={12} className="text-warning-400" />;
  return null;
}

export function TaskCard({
  task,
  execution,
  fileChangesCount = 0,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const nextStatus = getNextStatus(task.status);
  const overdue = task.status !== "done" && isOverdue(task.due_date);
  const isToday = task.due_date && !overdue && isSameDay(task.due_date);

  function handleDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.setData("application/json", JSON.stringify({ taskId: task.id }));
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }

  function handleDragEnd(e: React.DragEvent) {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).style.opacity = "1";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onView();
    }
  }

  return (
    <article
      className="task-card group"
      style={{ borderLeft: `4px solid ${task.priority_color}` }}
      onClick={onView}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalles de tarea: ${task.title}`}
      onKeyDown={handleKeyDown}
      draggable
      aria-grabbed={isDragging}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Priority & Category badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="badge text-[10px] font-semibold flex items-center gap-1"
          style={{ backgroundColor: task.priority_color + "20", color: task.priority_color }}
        >
          {getPriorityIcon(task.priority_level)}
          {task.priority_name}
        </span>
        <span
          className="badge text-[10px]"
          style={{ backgroundColor: task.category_color + "15", color: task.category_color }}
        >
          {task.category_name}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-medium text-gray-100 text-sm mb-2 line-clamp-2 leading-relaxed">
        {task.title}
      </h3>

      {/* Agent execution state (R21) */}
      {execution && (
        <div className="mb-3">
          <span
            className={`badge text-[10px] inline-flex items-center gap-1.5 ${agentStateDisplay(execution.state).badge}`}
          >
            <RobotIcon size={11} />
            {agentStateDisplay(execution.state).label}
          </span>
        </div>
      )}

      {/* File changes badge (R7.4) */}
      {fileChangesCount > 0 && (
        <div className="mb-3">
          <span
            className="badge text-[10px] inline-flex items-center gap-1 bg-accent/10 border border-accent/20 text-accent-300"
            aria-label={`${fileChangesCount} ficheros modificados`}
          >
            <span aria-hidden="true">📄</span>
            {fileChangesCount}
          </span>
        </div>
      )}

      {/* Due date */}
      {task.due_date && (
        <div
          className={`flex items-center gap-1.5 text-xs mb-3 ${
            overdue ? "text-danger-400" : isToday ? "text-warning-400" : "text-muted-400"
          }`}
        >
          <CalendarIcon size={13} />
          <span>{formatDate(task.due_date)}</span>
          {overdue && <span className="font-medium">(vencida)</span>}
          {isToday && <span className="font-medium">(hoy)</span>}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-1 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-400 hover:text-accent-300 transition-colors"
          aria-label="Editar tarea"
          title="Editar"
        >
          <PencilIcon size={15} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-400 hover:text-danger-400 transition-colors"
          aria-label="Eliminar tarea"
          title="Eliminar"
        >
          <TrashIcon size={15} />
        </button>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(nextStatus)}
            className="ml-auto p-1.5 rounded-lg hover:bg-success/10 text-muted-400 hover:text-success-400 transition-colors flex items-center gap-1"
            aria-label={
              nextStatus === "in_progress" ? "Mover a En Progreso" : "Marcar como Completada"
            }
            title={nextStatus === "in_progress" ? "Mover a En Progreso" : "Marcar como Completada"}
          >
            {nextStatus === "done" ? <CheckCircleIcon size={15} /> : <ArrowRightIcon size={15} />}
          </button>
        )}
      </div>
    </article>
  );
}
