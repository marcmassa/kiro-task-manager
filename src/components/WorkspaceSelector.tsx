import { useState, useEffect, useRef } from "react";
import type { Workspace } from "../types";
import { fetchWorkspaces, createWorkspace } from "../api";
import { PlusIcon, LayersIcon } from "../Icons";

interface WorkspaceSelectorProps {
  activeWorkspaceId: number;
  onWorkspaceChange: (id: number) => void;
}

/**
 * WorkspaceSelector — botón inline que muestra el workspace activo
 * con dropdown para cambiar/crear workspaces. Diseñado para usarse
 * dentro del PageHeader (prop beforeTitle).
 */
export function WorkspaceSelector({
  activeWorkspaceId,
  onWorkspaceChange,
}: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadWorkspaces() {
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch {
      // Silently fail
    }
  }

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  function statusDotColor(status: string): string {
    switch (status) {
      case "connected":
        return "bg-success";
      case "cloning":
        return "bg-warning animate-pulse";
      case "error":
        return "bg-danger";
      case "disconnected":
        return "bg-warning";
      default:
        return "bg-muted-500";
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const ws = await createWorkspace({ name: newName.trim() });
      setWorkspaces((prev) => [...prev, ws]);
      onWorkspaceChange(ws.id);
      setNewName("");
      setCreating(false);
      setOpen(false);
    } catch (e: any) {
      alert(e.message || "Error al crear workspace");
    }
  }

  if (!active && workspaces.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Botón inline */}
      <button
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
        onClick={() => setOpen(!open)}
        aria-label="Selector de workspace"
        aria-expanded={open}
      >
        <LayersIcon className="text-accent-400" size={16} />
        {active && (
          <>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(active.repoStatus)}`} />
            <span className="text-xs font-medium text-muted-200 group-hover:text-white transition-colors">
              {active.name}
            </span>
            {active.repoCurrentBranch && (
              <span className="text-[10px] text-muted-500 hidden sm:inline">
                {active.repoCurrentBranch}
              </span>
            )}
          </>
        )}
        <svg
          className={`w-3 h-3 text-muted-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-surface-400 border border-white/10 shadow-xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-300/50 transition-colors ${
                  ws.id === activeWorkspaceId ? "bg-accent/10" : ""
                }`}
                onClick={() => {
                  onWorkspaceChange(ws.id);
                  setOpen(false);
                }}
                aria-label={`Seleccionar workspace ${ws.name}`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor(ws.repoStatus)}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{ws.name}</p>
                  {ws.repoCurrentBranch && (
                    <p className="text-[10px] text-muted-400 truncate">{ws.repoCurrentBranch}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Create new workspace */}
          {creating ? (
            <div className="border-t border-white/10 p-2">
              <input
                type="text"
                className="w-full px-2 py-1.5 rounded bg-surface-600 border border-white/10 text-xs text-white placeholder-muted-500 focus:outline-none focus:border-accent"
                placeholder="Nombre del workspace"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                autoFocus
                aria-label="Nombre del nuevo workspace"
              />
              <div className="flex gap-1 mt-1.5">
                <button
                  className="flex-1 text-[10px] px-2 py-1 rounded bg-accent text-white hover:bg-accent/80 transition-colors"
                  onClick={handleCreate}
                >
                  Crear
                </button>
                <button
                  className="flex-1 text-[10px] px-2 py-1 rounded bg-surface-400 text-muted-300 hover:bg-surface-300 transition-colors"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-white/10 text-left hover:bg-surface-300/50 transition-colors text-accent-400"
              onClick={() => setCreating(true)}
              aria-label="Crear nuevo workspace"
            >
              <PlusIcon size={14} />
              <span className="text-xs">Nuevo workspace</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
