import { useState, useEffect } from "react";
import {
  fetchTaskFiles,
  addTaskFile,
  removeTaskFile,
  fetchTaskChanges,
  fetchFileContent,
} from "../api";
import type { FileReference, FileChange, FileChangeType } from "../types";
import { FileContentViewer } from "./FileContentViewer";
import { WorkspaceTreeView } from "./WorkspaceTreeView";
import { LiveChangesFeed } from "./LiveChangesFeed";
import { TrashIcon } from "../Icons";

interface FilesTabProps {
  taskId: number;
  executionState?: string;
  repoConfigured: boolean;
}

const CHANGE_DOT: Record<FileChangeType, string> = {
  created: "bg-success",
  modified: "bg-warning",
  deleted: "bg-danger",
};

const CHANGE_LABEL: Record<FileChangeType, string> = {
  created: "creado",
  modified: "modificado",
  deleted: "eliminado",
};

export function FilesTab({ taskId, executionState, repoConfigured }: FilesTabProps) {
  const [references, setReferences] = useState<FileReference[]>([]);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [newFilePath, setNewFilePath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // File viewer state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    loadReferences();
    loadChanges();
  }, [taskId]);

  async function loadReferences() {
    try {
      const data = await fetchTaskFiles(taskId);
      setReferences(data);
    } catch {
      // Gracefully handle — references section will be empty
    }
  }

  async function loadChanges() {
    try {
      const data = await fetchTaskChanges(taskId);
      setChanges(data);
    } catch {
      // Gracefully handle
    }
  }

  async function handleAddReference(filePath?: string) {
    const path = filePath || newFilePath.trim();
    if (!path) return;
    setAddError(null);
    try {
      await addTaskFile(taskId, path, "context");
      setNewFilePath("");
      await loadReferences();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Error al añadir referencia");
    }
  }

  async function handleRemoveReference(fileId: number) {
    try {
      await removeTaskFile(taskId, fileId);
      await loadReferences();
    } catch {
      // Ignore — user can retry
    }
  }

  async function handleFileSelect(path: string) {
    setSelectedFile(path);
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    try {
      const result = await fetchFileContent(path);
      setFileContent(result.content);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Error al leer el fichero");
    } finally {
      setFileLoading(false);
    }
  }

  // If repo not configured, show full-width message
  if (!repoConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <p className="text-muted-400 text-sm text-center mb-3">
          No hay repositorio configurado para este workspace.
        </p>
        <p className="text-muted-500 text-xs text-center">
          Configura uno en{" "}
          <span className="text-accent-300 font-medium">Configuración → Repositorio</span> para
          explorar ficheros y gestionar referencias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: Tree view */}
        <div className="min-w-0">
          <WorkspaceTreeView
            taskId={taskId}
            onFileSelect={handleFileSelect}
            onAddReference={(path) => handleAddReference(path)}
            repoConfigured={repoConfigured}
          />
        </div>

        {/* Right: Content area */}
        <div className="min-w-0">
          <FileContentViewer
            filePath={selectedFile || ""}
            content={fileContent}
            loading={fileLoading}
            error={fileError}
          />
        </div>
      </div>

      {/* References section */}
      <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
        <div className="px-4 py-2 border-b border-white/5 bg-surface-400/20">
          <span className="text-xs font-medium text-muted-400">
            Referencias ({references.length})
          </span>
        </div>
        <div className="p-3 space-y-2">
          {references.length === 0 && (
            <p className="text-xs text-muted-500">No hay ficheros referenciados en esta tarea.</p>
          )}
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3 hover:bg-white/5 transition-colors"
            >
              <span className="text-xs" aria-hidden="true">
                📄
              </span>
              <button
                className="text-xs font-mono text-gray-300 hover:text-accent-300 truncate text-left flex-1 transition-colors"
                onClick={() => handleFileSelect(ref.filePath)}
                aria-label={`Ver fichero: ${ref.filePath}`}
              >
                {ref.filePath}
              </button>
              <span className="text-[10px] text-muted-600 shrink-0">{ref.referenceType}</span>
              <button
                onClick={() => handleRemoveReference(ref.id)}
                className="p-1 rounded hover:bg-danger/10 text-muted-500 hover:text-danger-400 transition-colors shrink-0"
                aria-label={`Eliminar referencia: ${ref.filePath}`}
              >
                <TrashIcon size={12} />
              </button>
            </div>
          ))}

          {/* Add reference field */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddReference();
              }}
              placeholder="Ruta del fichero (ej: src/App.tsx)"
              className="input-field text-xs flex-1 font-mono"
              aria-label="Ruta del fichero a añadir como referencia"
            />
            <button
              onClick={() => handleAddReference()}
              disabled={!newFilePath.trim()}
              className="btn-primary text-xs px-3"
              aria-label="Añadir referencia"
            >
              Añadir
            </button>
          </div>
          {addError && (
            <p role="alert" className="text-xs text-danger-400 mt-1">
              {addError}
            </p>
          )}
        </div>
      </div>

      {/* Changes section */}
      {changes.length > 0 && (
        <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 bg-surface-400/20">
            <span className="text-xs font-medium text-muted-400">Cambios ({changes.length})</span>
          </div>
          <div className="p-3 space-y-1 max-h-[200px] overflow-y-auto">
            {changes.map((change) => (
              <div
                key={change.id}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${CHANGE_DOT[change.changeType]}`}
                  aria-label={CHANGE_LABEL[change.changeType]}
                />
                <button
                  className="text-xs font-mono text-gray-300 hover:text-accent-300 truncate text-left flex-1 transition-colors"
                  onClick={() => handleFileSelect(change.filePath)}
                  aria-label={`Ver fichero: ${change.filePath}`}
                >
                  {change.filePath}
                </button>
                <span className="text-[10px] text-muted-600 shrink-0">
                  {CHANGE_LABEL[change.changeType]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live changes feed when agent is working */}
      {executionState === "agent_working" && (
        <LiveChangesFeed
          taskId={taskId}
          executionState={executionState}
          onFileClick={handleFileSelect}
        />
      )}
    </div>
  );
}
