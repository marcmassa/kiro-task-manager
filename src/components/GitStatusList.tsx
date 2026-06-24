import { useState } from "react";
import type { GitStatusFile } from "../types";
import { useT } from "../i18n/useT";

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
  const t = useT();
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
            <span className="text-xs font-medium text-muted-400 uppercase tracking-wide">
              {t("git.stagedSection", { count: stagedFiles.length })}
            </span>
            {selectedPaths.size > 0 && (
              <button
                onClick={handleUnstageSelected}
                className="text-xs text-warning-400 hover:text-warning-300 transition-colors"
                aria-label={t("git.unstageLabel")}
              >
                Unstage
              </button>
            )}
          </div>
          <ul className="space-y-0.5" role="list" aria-label={t("git.stagedList")}>
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
            <span className="text-xs font-medium text-muted-400 uppercase tracking-wide">
              {t("git.unstagedSection", { count: unstagedFiles.length })}
            </span>
            {selectedPaths.size > 0 && (
              <button
                onClick={handleStageSelected}
                className="text-xs text-success-400 hover:text-success-300 transition-colors"
                aria-label={t("git.stageLabel")}
              >
                Stage
              </button>
            )}
          </div>
          <ul className="space-y-0.5" role="list" aria-label={t("git.unstagedList")}>
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
        <p className="text-sm text-muted-500 text-center py-4">
          {t("git.noChangesDir")}
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
  const t = useT();
  const statusColors: Record<GitStatusFile["status"], string> = {
    modified: "text-warning-400",
    added: "text-success-400",
    deleted: "text-danger-400",
    renamed: "text-accent-400",
    untracked: "text-muted-400",
  };

  const statusLabels: Record<GitStatusFile["status"], string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "?",
  };

  return (
    <li className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-400/50 group">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 rounded border-white/10 bg-surface-400 text-accent focus:ring-accent focus:ring-offset-0"
        aria-label={t("git.selectFilePath", { path: file.path })}
      />
      <span
        className={`text-xs font-mono font-bold w-4 text-center ${statusColors[file.status]}`}
        aria-label={t("git.fileStatus", { status: file.status })}
      >
        {statusLabels[file.status]}
      </span>
      <button
        onClick={onClick}
        className="flex-1 text-left text-sm text-muted-300 truncate hover:text-white transition-colors font-mono"
        aria-label={t("git.openFilePath", { path: file.path })}
      >
        {file.path}
      </button>
    </li>
  );
}
