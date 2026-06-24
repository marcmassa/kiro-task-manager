import { useState, useEffect, useRef } from "react";
import { fetchWorkspaceChanges } from "../api";
import type { FileChange } from "../types";
import { useT } from "../i18n/useT";
import i18n from "../i18n";

const LOCALE_MAP: Record<string, string> = { es: "es-ES", en: "en-GB" };

interface ChangesLogPanelProps {
  workspaceId: number;
  onFileClick: (path: string) => void;
}

function formatTimestamp(dateStr: string): string {
  const locale = LOCALE_MAP[i18n.language] ?? "es-ES";
  const d = new Date(dateStr);
  return d.toLocaleString(locale, {
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
      return i18n.t("change.created");
    case "modified":
      return i18n.t("change.modified");
    case "deleted":
      return i18n.t("change.deleted");
    default:
      return changeType;
  }
}

export function ChangesLogPanel({ workspaceId, onFileClick }: ChangesLogPanelProps): JSX.Element {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  async function loadChanges() {
    try {
      const data = await fetchWorkspaceChanges(50, workspaceId);
      if (!mountedRef.current) return;
      // React's prepareForCommit reads window.getSelection().anchorNode.nodeType,
      // but CodeMirror's contenteditable leaves anchorNode null → crash.
      // CodeMirror stores selection in EditorState and restores it after React
      // commits, so removing browser ranges here is safe and imperceptible.
      if (document.activeElement?.closest(".cm-editor")) {
        window.getSelection()?.removeAllRanges();
      }
      setChanges(data);
    } catch {
      // Silently fail — non-critical panel
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    setChanges([]);
    setLoading(true);
    void loadChanges();
    intervalRef.current = setInterval(() => {
      void loadChanges();
    }, 5000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workspaceId]);

  return (
    <section
      className="border-t border-white/5 bg-surface-400/20"
      aria-label={t("workspace.changesPanel")}
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
        <span>{t("workspace.changesLog")}</span>
        <span className="ml-auto text-muted-500">({changes.length})</span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div id="changes-log-content" className="max-h-[180px] overflow-y-auto px-4 pb-3 space-y-1">
          {loading ? (
            <p className="text-xs text-muted-500">{t("workspace.loadingChanges")}</p>
          ) : changes.length === 0 ? (
            <p className="text-xs text-muted-500">{t("workspace.noChanges")}</p>
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
                aria-label={t("workspace.openChange", {
                  path: change.filePath,
                  type: changeTypeLabel(change.changeType),
                })}
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
                  {change.agentExecutionId ? t("change.agent") : t("change.manual")}
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
