import { useState, useEffect } from "react";
import { Task, TaskStatus, Comment } from "../types";
import { fetchComments, addComment } from "../api";
import {
  XIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
} from "../Icons";

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Sin fecha";
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "Por Hacer",
  in_progress: "En Progreso",
  done: "Completada",
};

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-accent/15 text-accent-300",
  in_progress: "bg-warning/15 text-warning-300",
  done: "bg-success/15 text-success-300",
};

export function TaskDetailModal({
  task,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("Usuario");
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    loadComments();
  }, [task.id]);

  async function loadComments() {
    try {
      const data = await fetchComments(task.id);
      setComments(data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const comment = await addComment(task.id, newComment, commentAuthor);
    setComments([comment, ...comments]);
    setNewComment("");
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`badge ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
              <span
                className="badge text-xs"
                style={{ backgroundColor: task.priority_color + "20", color: task.priority_color }}
              >
                {task.priority_name}
              </span>
              <span
                className="badge text-xs"
                style={{ backgroundColor: task.category_color + "15", color: task.category_color }}
              >
                {task.category_name}
              </span>
            </div>
            <h2 id="task-detail-title" className="text-xl font-semibold text-white">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-400 mb-2">Descripción</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-300">
              <CalendarIcon size={16} className="text-muted-500" />
              <span>Vence: {formatDate(task.due_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-300">
              <ClockIcon size={16} className="text-muted-500" />
              <span>Creada: {formatDate(task.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {task.status !== "done" && (
              <button
                onClick={() => onStatusChange(task, "done")}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <CheckCircleIcon size={16} />
                Marcar como Completada
              </button>
            )}
            <button
              onClick={() => onEdit(task)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <PencilIcon size={16} />
              Editar
            </button>
            <button
              onClick={() => onDelete(task)}
              className="btn-danger flex items-center gap-2 text-sm"
            >
              <TrashIcon size={16} />
              Eliminar
            </button>
          </div>

          {/* Comments Section */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <ChatIcon size={18} className="text-muted-400" />
              <h3 className="text-sm font-semibold text-gray-300">
                Comentarios ({comments.length})
              </h3>
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="mb-4">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="input-field text-sm flex-1"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                />
                <input
                  type="text"
                  className="input-field text-sm w-28"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <button type="submit" className="btn-primary text-sm" disabled={!newComment.trim()}>
                Comentar
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {loadingComments ? (
                <p className="text-sm text-muted-400">Cargando comentarios...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-400">No hay comentarios aún.</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-surface-400/50 rounded-xl p-3 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-300">{comment.author}</span>
                      <span className="text-xs text-muted-500">
                        {formatDateTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-300">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
