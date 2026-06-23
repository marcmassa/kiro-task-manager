import { useState } from "react";
import { createWorkspace } from "../api";
import type { Workspace } from "../types";

interface CreateWorkspaceModalProps {
  onCreated: (ws: Workspace) => void;
  onClose: () => void;
}

export function CreateWorkspaceModal({ onCreated, onClose }: CreateWorkspaceModalProps): JSX.Element {
  const [name, setName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const ws = await createWorkspace({
        name: name.trim(),
        remoteUrl: remoteUrl.trim() || undefined,
        branch: branch.trim() || undefined,
      });
      onCreated(ws);
    } catch (e: any) {
      setError(e.message || "Error al crear workspace");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-xl bg-surface-500 border border-white/10 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Nuevo workspace</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-1">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white placeholder-muted-500 focus:outline-none focus:border-accent text-sm"
              placeholder="mi-proyecto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              aria-label="Nombre del workspace"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-1">
              URL remota (opcional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white placeholder-muted-500 focus:outline-none focus:border-accent text-sm"
              placeholder="https://github.com/user/repo.git"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              aria-label="URL remota del repositorio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-1">
              Rama por defecto
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white placeholder-muted-500 focus:outline-none focus:border-accent text-sm"
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              aria-label="Rama por defecto"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-surface-400 text-muted-300 hover:bg-surface-300 transition-colors text-sm"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors text-sm disabled:opacity-50"
              disabled={saving || !name.trim()}
            >
              {saving ? "Creando..." : "Crear workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
