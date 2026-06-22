import { useState, useEffect, useRef } from "react";
import { fetchTaskChanges } from "../api";
import type { FileChange, FileChangeType } from "../types";

interface LiveChangesFeedProps {
  taskId: number;
  executionState: string;
  onFileClick: (path: string) => void;
}

const CHANGE_STYLES: Record<FileChangeType, { dot: string; label: string }> = {
  created: { dot: "bg-success", label: "creado" },
  modified: { dot: "bg-warning", label: "modificado" },
  deleted: { dot: "bg-danger", label: "eliminado" },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveChangesFeed({ taskId, executionState, onFileClick }: LiveChangesFeedProps) {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [polling, setPolling] = useState(executionState === "agent_working");
  const feedEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop polling based on executionState
  useEffect(() => {
    const isWorking = executionState === "agent_working";
    setPolling(isWorking);

    if (isWorking) {
      // Poll immediately
      loadChanges();
      // Then every 3 seconds
      intervalRef.current = setInterval(loadChanges, 3000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [executionState, taskId]);

  // Auto-scroll to bottom
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [changes]);

  async function loadChanges() {
    try {
      const data = await fetchTaskChanges(taskId);
      setChanges(data);
    } catch {
      // Silently fail polling — will retry next interval
    }
  }

  // Compute summary
  const summary = {
    created: changes.filter((c) => c.changeType === "created").length,
    modified: changes.filter((c) => c.changeType === "modified").length,
    deleted: changes.filter((c) => c.changeType === "deleted").length,
  };

  if (changes.length === 0 && !polling) {
    return null;
  }

  return (
    <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 bg-surface-400/20 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-400">Cambios en vivo</span>
        {polling && (
          <span className="flex items-center gap-1.5 text-[10px] text-success-300">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Monitoreando
          </span>
        )}
      </div>

      {/* Feed entries */}
      <div className="max-h-[250px] overflow-y-auto p-2 space-y-1" aria-live="polite">
        {changes.length === 0 && polling && (
          <p className="text-xs text-muted-500 px-2 py-1">Esperando cambios del agente...</p>
        )}

        {changes.map((change) => {
          const style = CHANGE_STYLES[change.changeType];
          return (
            <div
              key={change.id}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px] text-muted-600 font-mono shrink-0 w-14">
                {formatTime(change.createdAt)}
              </span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                aria-label={style.label}
              />
              <button
                className="text-xs font-mono text-gray-300 hover:text-accent-300 truncate text-left transition-colors"
                onClick={() => onFileClick(change.filePath)}
                aria-label={`Ver fichero: ${change.filePath}`}
              >
                {change.filePath}
              </button>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>

      {/* Summary footer when done */}
      {!polling && changes.length > 0 && (
        <div className="px-3 py-2 border-t border-white/5 bg-surface-400/20">
          <p className="text-xs text-muted-400">
            Resumen:{" "}
            {summary.created > 0 && (
              <span className="text-success-300">{summary.created} creados</span>
            )}
            {summary.created > 0 && (summary.modified > 0 || summary.deleted > 0) && ", "}
            {summary.modified > 0 && (
              <span className="text-warning-300">{summary.modified} modificados</span>
            )}
            {summary.modified > 0 && summary.deleted > 0 && ", "}
            {summary.deleted > 0 && (
              <span className="text-danger-300">{summary.deleted} eliminados</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
