import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Workspace } from "../types";
import { PlusIcon, LayersIcon } from "../Icons";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: number;
  onWorkspaceChange: (id: number) => void;
  /** Called after a new workspace is successfully created. */
  onWorkspaceCreated: (ws: Workspace) => void;
}

/**
 * WorkspaceSelector — botón inline que muestra el workspace activo
 * con dropdown para cambiar/crear workspaces. Diseñado para usarse
 * dentro del PageHeader (prop beforeTitle).
 */
export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreated,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Botón inline */}
      <button
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
        onClick={() => setOpen((o) => !o)}
        aria-label="Selector de workspace"
        aria-expanded={open}
      >
        <LayersIcon className="text-accent-400" size={16} />
        <span className={`w-1.5 h-1.5 rounded-full ${active ? statusDotColor(active.repoStatus) : "bg-muted-600"}`} />
        <span className="text-xs font-medium text-muted-200 group-hover:text-white transition-colors">
          {active?.name ?? "Workspaces"}
        </span>
        {active?.repoCurrentBranch && (
          <span className="text-[10px] text-muted-500 hidden sm:inline">
            {active.repoCurrentBranch}
          </span>
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

          {/* Open full CreateWorkspaceModal */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 border-t border-white/10 text-left hover:bg-surface-300/50 transition-colors text-accent-400"
            onClick={() => { setOpen(false); setShowModal(true); }}
            aria-label="Crear nuevo workspace"
          >
            <PlusIcon size={14} />
            <span className="text-xs">Nuevo workspace</span>
          </button>
        </div>
      )}

      {showModal && createPortal(
        <CreateWorkspaceModal
          onCreated={(ws) => {
            onWorkspaceCreated(ws);
            onWorkspaceChange(ws.id);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />,
        document.body,
      )}
    </div>
  );
}
