import { useState } from "react";
import type { GitStatusFile } from "../types";

interface GitStatusListProps {
  files: GitStatusFile[];
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onFileClick: (path: string) => void;
}

/**
 * GitStatusList — lista de ficheros con checkbox para stage/unstage.
 * Ícono coloreado por estado (M=naranja, A=verde, D=rojo, ?=gris).
 *
 * Requirements: R17.4, R18.5
 */
export function GitStatusList({
  files,
  onStage,
  onUnstage,
  onFileClick,
}: GitStatusListProps): JSX.Element {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  function toggleSelection(filePath: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  function handleStageSelected() {
    const paths = Array.from(selectedPaths);
    if (paths.length > 0) {
      onStage(paths);
      setSelectedPaths(new Set());
    }
  }

  function handleUnstageSelected() {
    const paths = Array.from(selectedPaths);
    if (paths.length > 0) {
      onUnstage(paths);
      setSelectedPaths(new Set());
    }
  }

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  return (
    <div className="flex flex-col gap-2">
      {/* Staged files */}
      {stagedFiles.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              En staging ({stagedFiles.length})
            </span>
            {selectedPaths.size > 0 && (
              <button
                onClick={handleUnstageSelected}
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                aria-label="Quitar del staging los ficheros seleccionados"
              >
                Unstage
              </button>
            )}
          </div>
          <ul className="space-y-0.5" role="list" aria-label="Ficheros en staging">
            {stagedFiles.map((file) => (
              <FileItem
                key={`staged-${file.path}`}
                file={file}
                selected={selectedPaths.has(file.path)}
                onToggle={() => toggleSelection(file.path)}
                onClick={() => onFileClick(file.path)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Unstaged files */}
      {unstagedFiles.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Cambios ({unstagedFiles.length})
            </span>
            {selectedPaths.size > 0 && (
              <button
                onClick={handleStageSelected}
                className="text-xs text-green-400 hover:text-green-300 transition-colors"
                aria-label="Añadir al staging los ficheros seleccionados"
              >
                Stage
              </button>
            )}
          </div>
          <ul className="space-y-0.5" role="list" aria-label="Ficheros con cambios">
            {unstagedFiles.map((file) => (
              <FileItem
                key={`unstaged-${file.path}`}
                file={file}
                selected={selectedPaths.has(file.path)}
                onToggle={() => toggleSelection(file.path)}
                onClick={() => onFileClick(file.path)}
              />
            ))}
          </ul>
        </div>
      )}

      {files.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay cambios en el directorio de trabajo
        </p>
      )}
    </div>
  );
}

// ── Internal component ──────────────────────────────────────────────────────

interface FileItemProps {
  file: GitStatusFile;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}

function FileItem({ file, selected, onToggle, onClick }: FileItemProps): JSX.Element {
  const statusColors: Record<GitStatusFile["status"], string> = {
    modified: "text-orange-400",
    added: "text-green-400",
    deleted: "text-red-400",
    renamed: "text-blue-400",
    untracked: "text-gray-400",
  };

  const statusLabels: Record<GitStatusFile["status"], string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "?",
  };

  return (
    <li className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700/50 group">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
        aria-label={`Seleccionar ${file.path}`}
      />
      <span
        className={`text-xs font-mono font-bold w-4 text-center ${statusColors[file.status]}`}
        aria-label={`Estado: ${file.status}`}
      >
        {statusLabels[file.status]}
      </span>
      <button
        onClick={onClick}
        className="flex-1 text-left text-sm text-gray-300 truncate hover:text-white transition-colors font-mono"
        aria-label={`Abrir ${file.path}`}
      >
        {file.path}
      </button>
    </li>
  );
}
