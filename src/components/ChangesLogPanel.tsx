import { useState, useEffect, useRef } from "react";
import { fetchWorkspaceChanges } from "../api";
import type { FileChange } from "../types";

interface ChangesLogPanelProps {
  workspaceId: number;
  onFileClick: (path: string) => void;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function changeTypeDot(changeType: string): string {
  switch (changeType) {
    case "created":
      return "bg-success";
    case "modified":
      return "bg-warning";
    case "deleted":
      return "bg-danger";
    default:
      return "bg-muted-400";
  }
}

function changeTypeLabel(changeType: string): string {
  switch (changeType) {
    case "created":
      return "creado";
    case "modified":
      return "modificado";
    case "deleted":
      return "eliminado";
    default:
      return changeType;
  }
}

export function ChangesLogPanel({ workspaceId, onFileClick }: ChangesLogPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadChanges() {
    try {
      const data = await fetchWorkspaceChanges(50, workspaceId);
      setChanges(data);
    } catch {
      // Silently fail — non-critical panel
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setChanges([]);
    setLoading(true);
    loadChanges();
    intervalRef.current = setInterval(loadChanges, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workspaceId]);

  return (
    <section
      className="border-t border-white/5 bg-surface-400/20"
      aria-label="Registro de cambios del workspace"
    >
      {/* Header toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-400 hover:text-muted-300 transition-colors"
        aria-expanded={!collapsed}
        aria-controls="changes-log-content"
      >
        <span className="text-[10px]" aria-hidden="true">
          {collapsed ? "▶" : "▼"}
        </span>
        <span>Registro de cambios</span>
        <span className="ml-auto text-muted-500">({changes.length})</span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div id="changes-log-content" className="max-h-[180px] overflow-y-auto px-4 pb-3 space-y-1">
          {loading ? (
            <p className="text-xs text-muted-500">Cargando cambios...</p>
          ) : changes.length === 0 ? (
            <p className="text-xs text-muted-500">No hay cambios registrados.</p>
          ) : (
            changes.map((change) => (
              <div
                key={change.id}
                className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                onClick={() => onFileClick(change.filePath)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFileClick(change.filePath);
                  }
                }}
                aria-label={`Abrir ${change.filePath} (${changeTypeLabel(change.changeType)})`}
              >
                {/* Colored dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${changeTypeDot(change.changeType)}`}
                  aria-hidden="true"
                />
                {/* File path */}
                <span className="text-xs font-mono text-gray-300 truncate flex-1 group-hover:text-white transition-colors">
                  {change.filePath}
                </span>
                {/* Origin */}
                <span className="text-[10px] text-muted-500 shrink-0">
                  {change.agentExecutionId ? "agente" : "manual"}
                </span>
                {/* Timestamp */}
                <span className="text-[10px] text-muted-500 shrink-0">
                  {formatTimestamp(change.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
