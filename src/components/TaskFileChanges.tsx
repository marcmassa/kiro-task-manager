import { useState, useEffect } from "react";
import { fetchTaskChanges } from "../api";
import type { FileChange } from "../types";

interface TaskFileChangesProps {
  taskId: number;
  onFileClick: (path: string) => void;
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
      return "Creado";
    case "modified":
      return "Modificado";
    case "deleted":
      return "Eliminado";
    default:
      return changeType;
  }
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface GroupedChanges {
  executionId: number | null;
  createdAt: string;
  changes: FileChange[];
}

function groupByExecution(changes: FileChange[]): GroupedChanges[] {
  const groups: GroupedChanges[] = [];
  let currentGroup: GroupedChanges | null = null;

  for (const change of changes) {
    const execId = change.agentExecutionId;
    if (!currentGroup || currentGroup.executionId !== execId) {
      currentGroup = {
        executionId: execId,
        createdAt: change.createdAt,
        changes: [change],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.changes.push(change);
    }
  }

  return groups;
}

export function TaskFileChanges({ taskId, onFileClick }: TaskFileChangesProps): JSX.Element {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchTaskChanges(taskId);
        setChanges(data);
      } catch {
        // Silent fail — non-critical section
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskId]);

  if (loading) {
    return (
      <div className="py-3">
        <p className="text-xs text-muted-500">Cargando cambios de archivos...</p>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="py-3">
        <p className="text-sm text-muted-400">No hay cambios registrados para esta tarea.</p>
      </div>
    );
  }

  const groups = groupByExecution(changes);
  const hasMultipleGroups =
    groups.length > 1 || (groups.length === 1 && groups[0].executionId !== null);

  return (
    <div className="space-y-3" aria-label="Cambios de archivos de la tarea">
      {groups.map((group, idx) => (
        <div key={`${group.executionId ?? "manual"}-${idx}`}>
          {/* Group separator */}
          {hasMultipleGroups && (
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] text-muted-500 shrink-0">
                {group.executionId
                  ? `Ejecución del agente · ${formatTimestamp(group.createdAt)}`
                  : `Manual · ${formatTimestamp(group.createdAt)}`}
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
          )}

          {/* Change entries */}
          <div className="space-y-1">
            {group.changes.map((change) => (
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
                aria-label={`Abrir ${change.filePath} (${changeTypeLabel(change.changeType).toLowerCase()})`}
              >
                {/* Colored dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${changeTypeDot(change.changeType)}`}
                  aria-hidden="true"
                />
                {/* Type label */}
                <span className="text-[10px] text-muted-500 w-16 shrink-0">
                  {changeTypeLabel(change.changeType)}
                </span>
                {/* File path */}
                <span className="text-xs font-mono text-gray-300 truncate flex-1 group-hover:text-white transition-colors">
                  {change.filePath}
                </span>
                {/* Timestamp */}
                <span className="text-[10px] text-muted-500 shrink-0">
                  {formatTimestamp(change.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
