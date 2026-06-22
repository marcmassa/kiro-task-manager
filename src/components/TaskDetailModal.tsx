import { useState, useEffect, useRef } from "react";
import { Task, TaskStatus, Comment, Agent, AgentExecution, TaskAttachment } from "../types";
import {
  fetchComments,
  addComment,
  fetchAgents,
  assignAgent,
  getExecution,
  approveExecution,
  requestChanges,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  attachmentDownloadUrl,
  fetchRepoConfig,
} from "../api";
import {
  XIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  RobotIcon,
  PaperclipIcon,
  DownloadIcon,
} from "../Icons";
import { agentStateDisplay } from "../utils/agentStateDisplay";
import { CommentItem } from "./CommentItem";
import { ActivityIndicator } from "./ActivityIndicator";
import { isAgentComment, shouldShowActivityIndicator } from "../utils/commentUtils";
import { FilesTab } from "./FilesTab";

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  /** Notifies the parent that an execution changed so the board can refresh. */
  onExecutionChanged?: () => void;
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
  onExecutionChanged,
}: TaskDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("Usuario");
  const [loadingComments, setLoadingComments] = useState(true);
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Agent orchestration state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [execution, setExecution] = useState<AgentExecution | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"comentarios" | "archivos">("comentarios");
  const [repoConfigured, setRepoConfigured] = useState(false);

  useEffect(() => {
    loadComments();
    loadAgentData();
    loadAttachments();
    loadRepoStatus();
  }, [task.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

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

  async function loadAgentData() {
    try {
      const [ags, exec] = await Promise.all([fetchAgents(), getExecution(task.id)]);
      setAgents(ags);
      setAgentNames(ags.map((a) => a.name));
      setExecution(exec);
      if (ags.length > 0) setSelectedAgent(ags[0].id);
    } catch (err) {
      console.error("Error loading agent data:", err);
      setAgentNames([]); // graceful degradation
    }
  }

  async function loadAttachments() {
    try {
      setAttachments(await listAttachments(task.id));
    } catch (err) {
      console.error("Error loading attachments:", err);
    }
  }

  async function loadRepoStatus() {
    try {
      const config = await fetchRepoConfig();
      setRepoConfigured(config.repoStatus === "connected");
    } catch {
      setRepoConfigured(false);
    }
  }

  async function handleAssign() {
    if (!selectedAgent) return;
    setAgentBusy(true);
    setAgentError(null);
    try {
      const exec = await assignAgent(task.id, selectedAgent);
      setExecution(exec);
      onExecutionChanged?.();
    } catch {
      setAgentError("No se pudo asignar el agente.");
    } finally {
      setAgentBusy(false);
    }
  }

  async function handleApprove() {
    setAgentBusy(true);
    setAgentError(null);
    try {
      const exec = await approveExecution(task.id);
      setExecution(exec);
      onExecutionChanged?.();
    } catch {
      setAgentError("No se pudo aprobar.");
    } finally {
      setAgentBusy(false);
    }
  }

  async function handleRequestChanges() {
    if (!feedbackText.trim()) return;
    setAgentBusy(true);
    setAgentError(null);
    try {
      const exec = await requestChanges(task.id, feedbackText.trim());
      setExecution(exec);
      setFeedbackText("");
      setShowFeedback(false);
      onExecutionChanged?.();
    } catch {
      setAgentError("No se pudieron solicitar cambios.");
    } finally {
      setAgentBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setAttachError(null);
    try {
      await uploadAttachment(task.id, file);
      await loadAttachments();
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteAttachment(id: number) {
    try {
      await deleteAttachment(id);
      await loadAttachments();
    } catch {
      setAttachError("No se pudo eliminar el adjunto.");
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const comment = await addComment(task.id, newComment, commentAuthor);
    setComments([...comments, comment]);
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

          {/* Tab switcher */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex gap-1 p-1 rounded-lg bg-surface-400/30 border border-white/5 w-fit">
              <button
                onClick={() => setActiveTab("comentarios")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "comentarios"
                    ? "bg-accent/15 text-accent-300"
                    : "text-muted-400 hover:text-muted-300"
                }`}
                aria-label="Ver pestaña Comentarios"
              >
                Comentarios
              </button>
              <button
                onClick={() => setActiveTab("archivos")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "archivos"
                    ? "bg-accent/15 text-accent-300"
                    : "text-muted-400 hover:text-muted-300"
                }`}
                aria-label="Ver pestaña Archivos"
              >
                Archivos
              </button>
            </div>
          </div>

          {/* Tab content: Archivos */}
          {activeTab === "archivos" && (
            <FilesTab
              taskId={task.id}
              executionState={execution?.state}
              repoConfigured={repoConfigured}
            />
          )}

          {/* Tab content: Comentarios (existing sections) */}
          {activeTab === "comentarios" && (
            <>
              {/* ── Agent panel (R22) ─────────────────────────────────── */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <RobotIcon size={18} className="text-accent-400" />
                  <h3 className="text-sm font-semibold text-gray-300">Agente IA</h3>
                  {execution && (
                    <span
                      className={`badge text-[10px] inline-flex items-center gap-1.5 ml-auto ${agentStateDisplay(execution.state).badge}`}
                    >
                      {agentStateDisplay(execution.state).label}
                    </span>
                  )}
                </div>

                {!execution ? (
                  // Unassigned: pick an agent + assign
                  <div className="flex items-end gap-2 flex-wrap">
                    <label className="flex-1 min-w-[160px]">
                      <span className="text-xs font-medium text-muted-300 mb-1.5 block">
                        Asignar a un agente
                      </span>
                      <select
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        className="input-field"
                        aria-label="Seleccionar agente"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={handleAssign}
                      disabled={agentBusy || !selectedAgent}
                      className="btn-primary text-sm"
                      aria-label="Asignar agente a la tarea"
                    >
                      Asignar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-surface-400/40 border border-white/5 p-3">
                      <p className="text-xs text-muted-400">
                        Agente:{" "}
                        <span className="text-gray-200 font-medium">{execution.agent_id}</span>
                      </p>
                      {execution.agent_summary && (
                        <p className="text-xs text-muted-300 mt-2">
                          <span className="text-muted-500">Resumen del agente:</span>{" "}
                          {execution.agent_summary}
                        </p>
                      )}
                      {execution.review_feedback && (
                        <p className="text-xs text-danger-300 mt-2">
                          <span className="text-muted-500">Cambios solicitados:</span>{" "}
                          {execution.review_feedback}
                        </p>
                      )}
                    </div>

                    {/* Human approval gate — only in pending_review (R22) */}
                    {execution.state === "pending_review" && !showFeedback && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={handleApprove}
                          disabled={agentBusy}
                          className="btn-primary flex items-center gap-2 text-sm"
                          aria-label="Aprobar el trabajo del agente"
                        >
                          <CheckCircleIcon size={16} />
                          Aprobar
                        </button>
                        <button
                          onClick={() => setShowFeedback(true)}
                          disabled={agentBusy}
                          className="btn-secondary text-sm"
                          aria-label="Solicitar cambios al agente"
                        >
                          Solicitar cambios
                        </button>
                      </div>
                    )}

                    {/* Feedback form for request-changes */}
                    {execution.state === "pending_review" && showFeedback && (
                      <div className="space-y-2">
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="input-field text-sm resize-none"
                          rows={3}
                          placeholder="Describe los cambios necesarios..."
                          aria-label="Feedback de cambios"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleRequestChanges}
                            disabled={agentBusy || !feedbackText.trim()}
                            className="btn-danger text-sm"
                          >
                            Enviar feedback
                          </button>
                          <button
                            onClick={() => {
                              setShowFeedback(false);
                              setFeedbackText("");
                            }}
                            className="btn-ghost text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {agentError && (
                  <p role="alert" className="text-xs text-danger-400 mt-2">
                    {agentError}
                  </p>
                )}
              </div>

              {/* ── Attachments (R23) ─────────────────────────────────── */}
              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <PaperclipIcon size={18} className="text-muted-400" />
                  <h3 className="text-sm font-semibold text-gray-300">
                    Archivos adjuntos ({attachments.length})
                  </h3>
                  <label className="ml-auto btn-secondary text-sm cursor-pointer flex items-center gap-2">
                    <PaperclipIcon size={14} />
                    <span>{uploading ? "Subiendo..." : "Adjuntar"}</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={handleUpload}
                      disabled={uploading}
                      aria-label="Subir un archivo adjunto"
                    />
                  </label>
                </div>

                {attachError && (
                  <p role="alert" className="text-xs text-danger-400 mb-2">
                    {attachError}
                  </p>
                )}

                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-400">No hay archivos adjuntos.</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-400/30 border border-white/5"
                      >
                        <PaperclipIcon size={14} className="text-muted-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">{att.filename}</p>
                          <p className="text-xs text-muted-500">{formatBytes(att.size_bytes)}</p>
                        </div>
                        <a
                          href={attachmentDownloadUrl(att.id)}
                          download={att.filename}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-400 hover:text-accent-300 transition-colors"
                          aria-label={`Descargar ${att.filename}`}
                          title="Descargar"
                        >
                          <DownloadIcon size={15} />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-400 hover:text-danger-400 transition-colors"
                          aria-label={`Eliminar ${att.filename}`}
                          title="Eliminar"
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  <button
                    type="submit"
                    className="btn-primary text-sm"
                    disabled={!newComment.trim()}
                  >
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
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        isAgent={isAgentComment(comment.author, agentNames)}
                        agentState={execution?.state ?? null}
                      />
                    ))
                  )}
                  {shouldShowActivityIndicator(comments, agentNames, execution?.state ?? null) && (
                    <ActivityIndicator agentName={agentNames[0] ?? "Agente"} />
                  )}
                  <div ref={commentsEndRef} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
