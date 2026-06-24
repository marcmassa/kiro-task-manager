import { useState, useEffect, useCallback } from "react";
import type { Workspace } from "../types";
import { fetchWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace } from "../api";
import { RepoStatusBadge } from "./RepoStatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";
import { useT } from "../i18n/useT";
import { LoadingState } from "./ui/StateView";
import { PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, XIcon } from "../Icons";

interface WorkspaceSettingsSectionProps {
  activeWorkspaceId: number;
  onWorkspaceChange: (id: number) => void;
}

/**
 * WorkspaceSettingsSection — gestión completa de workspaces desde Settings.
 *
 * Incluye:
 *   - Tabla con nombre, slug, estado del repo, fecha de creación, acciones
 *   - Botón "Crear workspace" con formulario inline
 *   - Edición inline por fila
 *   - Eliminación con confirmación (mueve tareas a workspace=1)
 *   - Botón "Activar" para cambiar el workspace activo
 */
export function WorkspaceSettingsSection({
  activeWorkspaceId,
  onWorkspaceChange,
}: WorkspaceSettingsSectionProps): JSX.Element {
  const t = useT();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Create form state ─────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [newBranch, setNewBranch] = useState("main");

  // ── Edit form state ───────────────────────────────────────────────
  const [editName, setEditName] = useState("");
  const [editRemoteUrl, setEditRemoteUrl] = useState("");
  const [editBranch, setEditBranch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch {
      setError("No se pudieron cargar los workspaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Create ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkspace({
        name: newName.trim(),
        remoteUrl: newRemoteUrl.trim() || undefined,
        branch: newBranch.trim() || undefined,
      });
      setShowCreateForm(false);
      setNewName("");
      setNewRemoteUrl("");
      setNewBranch("main");
      await load();
    } catch (e: any) {
      setError(e.message || "Error al crear workspace");
    } finally {
      setSaving(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────
  function startEdit(ws: Workspace) {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditRemoteUrl(ws.repoRemoteUrl ?? "");
    setEditBranch(ws.repoDefaultBranch);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(ws: Workspace) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateWorkspace(ws.id, {
        name: editName.trim(),
        remoteUrl: editRemoteUrl.trim() || undefined,
        branch: editBranch.trim() || undefined,
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e.message || "Error al actualizar workspace");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteWorkspace(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      if (activeWorkspaceId === deleteTarget.id) {
        // If we deleted the active workspace, switch to default
        onWorkspaceChange(1);
      }
    } catch (e: any) {
      setError(e.message || "Error al eliminar workspace");
    } finally {
      setSaving(false);
    }
  }

  // ── Activate ──────────────────────────────────────────────────────
  function handleActivate(ws: Workspace) {
    onWorkspaceChange(ws.id);
  }

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingState message="Cargando workspaces..." />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger-400">
          {error}
          <button className="ml-2 underline hover:no-underline" onClick={() => setError(null)}>
            Cerrar
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-400">
          {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} configurado
          {workspaces.length !== 1 ? "s" : ""}
        </p>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center gap-1.5 text-xs"
            aria-label={t("workspace.createWorkspace")}
          >
            <PlusIcon size={14} />
            <span>{t("workspace.createWorkspace")}</span>
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl bg-surface-400/30 border border-white/10 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">{t("workspace.newWorkspace")}</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1 rounded hover:bg-surface-400 text-muted-400 hover:text-white"
              aria-label="Cancelar creación"
            >
              <XIcon size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-300 mb-1">
                Nombre <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-field text-sm"
                placeholder="mi-proyecto"
                aria-label="Nombre del workspace"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-muted-300 mb-1">URL remota</label>
              <input
                type="text"
                value={newRemoteUrl}
                onChange={(e) => setNewRemoteUrl(e.target.value)}
                className="input-field text-sm"
                placeholder="https://github.com/user/repo.git"
                aria-label="URL remota"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-300 mb-1">
                {t("workspace.defaultBranch")}
              </label>
              <input
                type="text"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                className="input-field text-sm"
                placeholder="main"
                aria-label={t("workspace.defaultBranchLabel")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 rounded-lg bg-surface-400 text-muted-300 hover:bg-surface-300 transition-colors text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors text-xs disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>
      )}

      {/* Workspace table */}
      <div className="space-y-2">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
              ws.id === activeWorkspaceId
                ? "bg-accent/10 border-accent/25"
                : "bg-surface-400/30 border-white/5 hover:border-white/10"
            }`}
          >
            {/* Badge */}
            <RepoStatusBadge status={ws.repoStatus} />

            {/* Content */}
            {editingId === ws.id ? (
              /* Edit mode */
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field text-sm"
                  aria-label="Nombre"
                />
                <input
                  type="text"
                  value={editRemoteUrl}
                  onChange={(e) => setEditRemoteUrl(e.target.value)}
                  className="input-field text-sm"
                  aria-label="URL remota"
                  placeholder="URL remota"
                />
                <input
                  type="text"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  className="input-field text-sm"
                  aria-label={t("workspace.defaultBranchLabel")}
                />
              </div>
            ) : (
              /* Display mode */
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                    {ws.name}
                    {ws.id === activeWorkspaceId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-300">
                        Activo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-500">/{ws.slug}</p>
                </div>
                <p className="text-xs text-muted-400 hidden md:block truncate">
                  {ws.repoPath ?? ws.repoRemoteUrl ?? "Sin repositorio"}
                </p>
                <p className="text-xs text-muted-500 hidden md:block">
                  {new Date(ws.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Actions */}
            {editingId === ws.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleSaveEdit(ws)}
                  disabled={saving || !editName.trim()}
                  className="p-1.5 rounded hover:bg-surface-400 text-success-400 hover:text-success-300 transition-colors"
                  aria-label="Guardar cambios"
                  title="Guardar"
                >
                  <CheckCircleIcon size={16} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded hover:bg-surface-400 text-muted-400 hover:text-white transition-colors"
                  aria-label="Cancelar edición"
                  title="Cancelar"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {/* Activate button (hidden for active workspace) */}
                {ws.id !== activeWorkspaceId && ws.id !== 0 && (
                  <button
                    onClick={() => handleActivate(ws)}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-accent/15 text-accent-300 hover:bg-accent/25 transition-colors"
                    aria-label={`Activar workspace ${ws.name}`}
                    title="Activar"
                  >
                    Activar
                  </button>
                )}
                <button
                  onClick={() => startEdit(ws)}
                  className="p-1.5 rounded hover:bg-surface-400 text-muted-400 hover:text-white transition-colors"
                  aria-label={`Editar workspace ${ws.name}`}
                  title="Editar"
                >
                  <PencilIcon size={14} />
                </button>
                {ws.id !== 1 && (
                  <button
                    onClick={() => setDeleteTarget(ws)}
                    className="p-1.5 rounded hover:bg-surface-400 text-muted-400 hover:text-danger transition-colors"
                    aria-label={`Eliminar workspace ${ws.name}`}
                    title="Eliminar"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {workspaces.length === 0 && !loading && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-400">No hay workspaces. Crea uno para empezar.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar workspace"
          message={`¿Eliminar "${deleteTarget.name}"? Las tareas de este workspace se moverán al workspace por defecto. Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
