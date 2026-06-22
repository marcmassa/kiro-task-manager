import { useState } from "react";

interface FileContentViewerProps {
  filePath: string;
  content: string | null;
  loading?: boolean;
  error?: string | null;
  language?: string;
  diffMode?: boolean;
  originalContent?: string;
}

function getLineClass(line: string, diffMode: boolean): string {
  if (!diffMode) return "";
  if (line.startsWith("+")) return "bg-success/10 text-success-300";
  if (line.startsWith("-")) return "bg-danger/10 text-danger-300";
  return "";
}

function getFileExtension(filePath: string): string {
  const parts = filePath.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function FileContentViewer({
  filePath,
  content,
  loading = false,
  error = null,
  language,
  diffMode = false,
}: FileContentViewerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const detectedLanguage = language || getFileExtension(filePath);
  const MAX_SIZE = 1_000_000; // 1 MB

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-400/30 border border-white/5 p-6">
        <div className="flex items-center gap-2 text-muted-400 text-sm">
          <span className="animate-pulse">●</span>
          <span>Cargando contenido...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-danger/5 border border-danger/20 p-4">
        <p className="text-sm text-danger-400">{error}</p>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="rounded-xl bg-surface-400/30 border border-white/5 p-6">
        <p className="text-sm text-muted-400">Selecciona un fichero para ver su contenido.</p>
      </div>
    );
  }

  const isTruncated = content.length >= MAX_SIZE;
  const lines = content.split("\n");

  return (
    <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
      {/* File path header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-surface-400/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-500 text-xs shrink-0" aria-hidden="true">
            📄
          </span>
          <span className="text-sm text-muted-300 font-mono truncate">{filePath}</span>
          {detectedLanguage && (
            <span className="text-[10px] text-muted-500 bg-white/5 px-1.5 py-0.5 rounded">
              {detectedLanguage}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-muted-500 hover:text-muted-300 transition-colors px-2 py-1"
          aria-label={collapsed ? "Expandir contenido" : "Colapsar contenido"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Content area */}
      {!collapsed && (
        <div
          className="overflow-x-auto max-h-[500px] overflow-y-auto"
          data-language={detectedLanguage}
        >
          <table className="w-full text-xs font-mono" role="presentation">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className={getLineClass(line, diffMode)}>
                  <td
                    className="select-none text-right text-muted-600 pr-3 pl-3 py-0 w-12 align-top border-r border-white/5"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </td>
                  <td className="pl-3 pr-4 py-0 whitespace-pre text-gray-300">{line || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Truncation warning */}
      {isTruncated && !collapsed && (
        <div className="px-4 py-2 border-t border-white/5 bg-warning/5">
          <p className="text-xs text-warning-300">
            Fichero demasiado grande — contenido truncado a 1 MB.
          </p>
        </div>
      )}
    </div>
  );
}
