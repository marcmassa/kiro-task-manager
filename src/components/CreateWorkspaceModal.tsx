import { useState } from "react";
import { createWorkspace } from "../api";
import type { Workspace, WorkspaceColumn, WorkspaceProjectType } from "../types";
import { COLUMN_COLOR_KEYS, columnColorTokens } from "../utils/columnColors";

interface CreateWorkspaceModalProps {
  onCreated: (ws: Workspace) => void;
  onClose: () => void;
}


type ProjectTypeOption = {
  type: WorkspaceProjectType;
  label: string;
  subtitle: string;
  preview: string[];
  accent: string;
};

const PROJECT_TYPES: ProjectTypeOption[] = [
  {
    type: "normal",
    label: "Normal",
    subtitle: "Flujo estándar de 3 columnas",
    preview: ["Por Hacer", "En Progreso", "Completadas"],
    accent: "border-accent bg-accent/5",
  },
  {
    type: "sdd",
    label: "SDD",
    subtitle: "Pipeline con fases de diseño",
    preview: ["Por Hacer", "Requirements", "Diseño", "Tasks", "En Progreso", "Completadas"],
    accent: "border-purple-500 bg-purple-500/5",
  },
  {
    type: "custom",
    label: "Custom",
    subtitle: "Define tus propias columnas",
    preview: [],
    accent: "border-warning bg-warning/5",
  },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32) || `col-${Date.now()}`;
}

export function CreateWorkspaceModal({ onCreated, onClose }: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [projectType, setProjectType] = useState<WorkspaceProjectType>("normal");
  const [customColumns, setCustomColumns] = useState<WorkspaceColumn[]>([
    { id: "review", label: "Revisión", color: "purple" },
  ]);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColColor, setNewColColor] = useState<string>("emerald");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addColumn() {
    const label = newColLabel.trim();
    if (!label) return;
    const id = slugify(label);
    setCustomColumns((prev) => [...prev, { id, label, color: newColColor }]);
    setNewColLabel("");
  }

  function removeColumn(id: string) {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id));
  }

  function updateColumnColor(id: string, color: string) {
    setCustomColumns((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
  }

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
        projectType,
        customColumns: projectType === "custom" ? customColumns : undefined,
      });
      onCreated(ws);
    } catch (e: any) {
      setError(e.message || "Error al crear workspace");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-xl bg-surface-500 border border-white/10 shadow-xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10 sticky top-0 bg-surface-500 z-10">
          <h2 className="text-lg font-semibold text-white">Nuevo workspace</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Nombre */}
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

          {/* Tipo de proyecto */}
          <div>
            <label className="block text-sm font-medium text-muted-300 mb-2">
              Tipo de proyecto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROJECT_TYPES.map((opt) => {
                const selected = projectType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setProjectType(opt.type)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selected ? opt.accent : "border-white/10 bg-surface-600 hover:border-white/20"
                    }`}
                  >
                    <p className={`text-sm font-semibold mb-0.5 ${selected ? "text-white" : "text-muted-300"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-muted-500 leading-tight mb-2">{opt.subtitle}</p>
                    {opt.preview.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {opt.preview.slice(0, 3).map((col) => (
                          <span key={col} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-400">
                            {col}
                          </span>
                        ))}
                        {opt.preview.length > 3 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-400">
                            +{opt.preview.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom column editor */}
          {projectType === "custom" && (
            <div className="rounded-xl border border-white/10 bg-surface-600 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-300 mb-1">Columnas del pipeline</p>
                <p className="text-[10px] text-muted-500">
                  Las columnas Por Hacer, En Progreso y Completadas son fijas. Añade las intermedias que necesites.
                </p>
              </div>

              {/* Fixed start */}
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs text-muted-400">Por Hacer</span>
              </div>

              {/* Custom columns list */}
              {customColumns.map((col) => {
                const tokens = columnColorTokens(col.color);
                return (
                  <div key={col.id} className="flex items-center gap-2 pl-4">
                    <div className={`w-px h-4 bg-white/10`} />
                    <div className={`w-2 h-2 rounded-full ${tokens.dot}`} />
                    <span className="text-xs text-gray-200 flex-1">{col.label}</span>
                    {/* Color picker */}
                    <div className="flex gap-1">
                      {COLUMN_COLOR_KEYS.slice(0, 6).map((ck) => {
                        const t = columnColorTokens(ck);
                        return (
                          <button
                            key={ck}
                            type="button"
                            title={ck}
                            aria-label={`Color ${ck}`}
                            onClick={() => updateColumnColor(col.id, ck)}
                            className={`w-3.5 h-3.5 rounded-full ${t.dot} transition-transform ${col.color === ck ? "ring-1 ring-white scale-125" : "opacity-60 hover:opacity-100"}`}
                          />
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      aria-label={`Eliminar columna ${col.label}`}
                      onClick={() => removeColumn(col.id)}
                      className="text-muted-500 hover:text-danger transition-colors text-xs ml-1"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* Add column row */}
              <div className="flex items-center gap-2 pl-4">
                <div className="w-px h-4 bg-white/10" />
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColumn())}
                  placeholder="Nueva columna..."
                  aria-label="Nombre de nueva columna"
                  className="flex-1 px-2 py-1 text-xs rounded-lg bg-surface-500 border border-white/10 text-white placeholder-muted-600 focus:outline-none focus:border-accent"
                />
                <div className="flex gap-1">
                  {COLUMN_COLOR_KEYS.slice(0, 6).map((ck) => {
                    const t = columnColorTokens(ck);
                    return (
                      <button
                        key={ck}
                        type="button"
                        title={ck}
                        aria-label={`Seleccionar color ${ck}`}
                        onClick={() => setNewColColor(ck)}
                        className={`w-3.5 h-3.5 rounded-full ${t.dot} transition-transform ${newColColor === ck ? "ring-1 ring-white scale-125" : "opacity-60 hover:opacity-100"}`}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addColumn}
                  disabled={!newColLabel.trim()}
                  className="text-xs px-2 py-1 rounded-lg bg-accent/20 text-accent-300 hover:bg-accent/30 transition-colors disabled:opacity-30"
                >
                  Añadir
                </button>
              </div>

              {/* Fixed end */}
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs text-muted-400">En Progreso</span>
              </div>
              <div className="flex items-center gap-2 opacity-50">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs text-muted-400">Completadas</span>
              </div>
            </div>
          )}

          {/* Repo options */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-300 mb-1">
                URL remota <span className="text-muted-500">(opcional)</span>
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
          </div>

          <div className="flex gap-3 justify-end pt-1">
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
              disabled={saving || !name.trim() || (projectType === "custom" && customColumns.length === 0)}
            >
              {saving ? "Creando..." : "Crear workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
