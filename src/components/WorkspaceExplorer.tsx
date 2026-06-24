import { useState, useCallback, useEffect } from "react";
import { fetchWorkspaceTree } from "../api";
import type { DirectoryEntry } from "../types";
import { FolderCodeIcon, CodeIcon } from "../Icons";
import { useT } from "../i18n/useT";

interface WorkspaceExplorerProps {
  workspaceId: number;
  onOpenFile?: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  children?: TreeNode[];
  loaded: boolean;
  expanded: boolean;
  loading: boolean;
}

function getFileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "🟦",
    tsx: "🟦",
    js: "🟨",
    jsx: "🟨",
    json: "📋",
    md: "📝",
    css: "🎨",
    html: "🌐",
    py: "🐍",
    sh: "⚙️",
    rs: "🦀",
    go: "🔵",
  };
  return map[ext] ?? "📄";
}

function TreeItem({
  node,
  onToggle,
  onFileClick,
}: {
  node: TreeNode;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
}) {
  const isDir = node.type === "directory";

  function handleClick() {
    if (isDir) onToggle(node.path);
    else onFileClick(node.path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <li role="treeitem" aria-expanded={isDir ? node.expanded : undefined}>
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer text-sm group transition-colors"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={
          isDir ? `${node.expanded ? "Colapsar" : "Expandir"} ${node.name}` : `Abrir ${node.name}`
        }
      >
        <span className="text-muted-500 text-[10px] w-3 text-center shrink-0" aria-hidden="true">
          {node.loading ? "⏳" : isDir ? (node.expanded ? "▼" : "▶") : ""}
        </span>

        {isDir ? (
          <svg
            className="text-accent-400 shrink-0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ) : (
          <span className="text-xs shrink-0">{getFileEmoji(node.name)}</span>
        )}

        <span className="font-mono text-xs text-gray-300 truncate flex-1 min-w-0">{node.name}</span>

        {!isDir && (
          <span className="text-[10px] text-muted-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}KB`}
          </span>
        )}
      </div>

      {isDir && node.expanded && node.children && (
        <ul role="group" className="pl-3 border-l border-white/5 ml-2">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} onToggle={onToggle} onFileClick={onFileClick} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function WorkspaceExplorer({ workspaceId, onOpenFile }: WorkspaceExplorerProps) {
  const t = useT();
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rootLoading, setRootLoading] = useState(false);

  const loadRootDirectory = useCallback(async () => {
    if (!workspaceId || workspaceId === 0) return;
    setRootLoading(true);
    setLoadError(null);
    try {
      const result = await fetchWorkspaceTree(workspaceId);
      const nodes: TreeNode[] = result.entries
        .sort((a: DirectoryEntry, b: DirectoryEntry) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "directory" ? -1 : 1;
        })
        .map((entry: DirectoryEntry) => ({
          name: entry.name,
          path: entry.name,
          type: entry.type,
          size: entry.size,
          children: undefined,
          loaded: false,
          expanded: false,
          loading: false,
        }));
      setRoots(nodes);
      setLoaded(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar el directorio");
    } finally {
      setRootLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId && workspaceId > 0) {
      loadRootDirectory();
    }
  }, [workspaceId, loadRootDirectory]);

  async function handleToggle(path: string) {
    const node = findNode(roots, path);
    if (node && node.type === "directory" && !node.loaded) {
      setRoots((prev) => markNodeLoading(prev, path));
      await loadChildren(path);
    } else {
      setRoots((prev) => toggleExpanded(prev, path));
    }
  }

  function handleFileClick(path: string) {
    onOpenFile?.(path);
  }

  function findNode(nodes: TreeNode[], targetPath: string): TreeNode | null {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  function markNodeLoading(nodes: TreeNode[], targetPath: string): TreeNode[] {
    return nodes.map((node) => {
      if (node.path === targetPath) return { ...node, loading: true };
      if (node.children) return { ...node, children: markNodeLoading(node.children, targetPath) };
      return node;
    });
  }

  function toggleExpanded(nodes: TreeNode[], targetPath: string): TreeNode[] {
    return nodes.map((node) => {
      if (node.path === targetPath) return { ...node, expanded: !node.expanded };
      if (node.children) return { ...node, children: toggleExpanded(node.children, targetPath) };
      return node;
    });
  }

  async function loadChildren(parentPath: string) {
    try {
      const result = await fetchWorkspaceTree(workspaceId, parentPath);
      const children: TreeNode[] = result.entries
        .sort((a: DirectoryEntry, b: DirectoryEntry) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "directory" ? -1 : 1;
        })
        .map((entry: DirectoryEntry) => ({
          name: entry.name,
          path: `${parentPath}/${entry.name}`,
          type: entry.type,
          size: entry.size,
          children: undefined,
          loaded: false,
          expanded: false,
          loading: false,
        }));
      setRoots((prev) => updateNodeChildren(prev, parentPath, children));
    } catch {
      setRoots((prev) => updateNodeChildren(prev, parentPath, []));
    }
  }

  function updateNodeChildren(
    nodes: TreeNode[],
    targetPath: string,
    children: TreeNode[],
  ): TreeNode[] {
    return nodes.map((node) => {
      if (node.path === targetPath) {
        return { ...node, children, loaded: true, expanded: true, loading: false };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, targetPath, children) };
      }
      return node;
    });
  }

  return (
    <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 bg-surface-400/20 flex items-center gap-2">
        <FolderCodeIcon className="text-accent-400" size={14} />
        <span className="text-xs font-medium text-muted-400">{t("workspace.explorerFiles")}</span>
      </div>
      <div className="overflow-y-auto p-2">
        {rootLoading && (
          <div className="flex items-center gap-2 text-muted-400 text-xs px-2 py-3">
            <span className="animate-pulse">●</span>
            <span>Cargando...</span>
          </div>
        )}

        {loadError && <p className="text-xs text-danger-400 px-2 py-3">{loadError}</p>}

        {!rootLoading && !loadError && (
          <ul role="tree" aria-label="Estructura del proyecto">
            {roots.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                onToggle={handleToggle}
                onFileClick={handleFileClick}
              />
            ))}
            {roots.length === 0 && loaded && (
              <li className="text-xs text-muted-500 px-2 py-3 text-center">
                {t("workspace.empty")}
              </li>
            )}
            {!loaded && !rootLoading && (
              <li className="text-xs text-muted-500 px-2 py-3 text-center">
                {t("workspace.notConfiguredExplorer")}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
