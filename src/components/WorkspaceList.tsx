import { useState, useEffect, useCallback } from "react";
import type { Workspace } from "../types";
import { fetchWorkspaces, updateWorkspace, deleteWorkspace } from "../api";
import { RepoStatusBadge } from "./RepoStatusBadge";
import { PlusIcon, TrashIcon, PencilIcon } from "../Icons";

interface WorkspaceListProps {
  onEdit: (ws: Workspace) => void;
  onRefresh: () => void;
}

export function WorkspaceList({ onEdit, onRefresh }: WorkspaceListProps): JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(ws: Workspace) {
    if (ws.id === 1) return; // Cannot delete default
    if (
      !confirm(`¿Eliminar workspace "${ws.name}"? Las tareas se moverán al workspace por defecto.`)
    )
      return;
    setDeletingId(ws.id);
    try {
      await deleteWorkspace(ws.id);
      await load();
      onRefresh();
    } catch (e: any) {
      alert(e.message || "Error al eliminar workspace");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-400/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-500 border border-white/5 hover:border-white/10 transition-colors"
        >
          <RepoStatusBadge status={ws.repoStatus} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{ws.name}</p>
            {ws.repoCurrentBranch && (
              <p className="text-xs text-muted-400 truncate">
                {ws.repoPath ?? ws.repoRemoteUrl ?? "Sin repositorio"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {ws.repoCurrentBranch && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-400">
                {ws.repoCurrentBranch}
              </span>
            )}
            <button
              className="p-1.5 rounded hover:bg-surface-400 text-muted-400 hover:text-white transition-colors"
              onClick={() => onEdit(ws)}
              aria-label={`Editar workspace ${ws.name}`}
              title="Editar"
            >
              <PencilIcon size={14} />
            </button>
            {ws.id !== 1 && (
              <button
                className="p-1.5 rounded hover:bg-surface-400 text-muted-400 hover:text-danger transition-colors disabled:opacity-50"
                onClick={() => handleDelete(ws)}
                disabled={deletingId === ws.id}
                aria-label={`Eliminar workspace ${ws.name}`}
                title="Eliminar"
              >
                <TrashIcon size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {workspaces.length === 0 && (
        <p className="text-sm text-muted-400 text-center py-6">
          No hay workspaces. Crea uno nuevo para empezar.
        </p>
      )}
    </div>
  );
}
