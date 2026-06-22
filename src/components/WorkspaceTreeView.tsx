import { useState, useCallback } from "react";
import { fetchDirectoryTree } from "../api";
import type { DirectoryEntry } from "../types";

interface WorkspaceTreeViewProps {
  taskId: number;
  onFileSelect: (path: string) => void;
  onAddReference: (path: string) => void;
  repoConfigured: boolean;
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

function getFileIcon(name: string, type: "file" | "directory"): string {
  if (type === "directory") return "📁";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "🟦";
    case "js":
    case "jsx":
      return "🟨";
    case "json":
      return "📋";
    case "md":
      return "📝";
    case "css":
      return "🎨";
    case "html":
      return "🌐";
    case "py":
      return "🐍";
    case "sh":
      return "⚙️";
    default:
      return "📄";
  }
}

function TreeItem({
  node,
  onToggle,
  onFileClick,
  onAddRef,
}: {
  node: TreeNode;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  onAddRef: (path: string) => void;
}) {
  const isDir = node.type === "directory";

  function handleClick() {
    if (isDir) {
      onToggle(node.path);
    } else {
      onFileClick(node.path);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onAddRef(node.path);
  }

  return (
    <li role="treeitem" aria-expanded={isDir ? node.expanded : undefined}>
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer text-sm group transition-colors"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        tabIndex={0}
        role="button"
        aria-label={
          isDir
            ? `${node.expanded ? "Colapsar" : "Expandir"} directorio: ${node.name}`
            : `Abrir fichero: ${node.name}`
        }
      >
        {/* Expand/collapse arrow for directories */}
        {isDir ? (
          <span className="text-muted-500 text-[10px] w-3 text-center shrink-0" aria-hidden="true">
            {node.loading ? "⏳" : node.expanded ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className="text-xs shrink-0" aria-hidden="true">
          {getFileIcon(node.name, node.type)}
        </span>
        <span className="font-mono text-xs text-gray-300 truncate">{node.name}</span>

        {/* Add reference button */}
        <button
          className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-accent-300 hover:text-accent-200 transition-opacity px-1"
          onClick={(e) => {
            e.stopPropagation();
            onAddRef(node.path);
          }}
          aria-label={`Añadir ${node.name} como referencia`}
          title="Añadir como referencia"
        >
          +ref
        </button>
      </div>

      {/* Children */}
      {isDir && node.expanded && node.children && (
        <ul role="group" className="pl-3 border-l border-white/5 ml-2">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onAddRef={onAddRef}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function WorkspaceTreeView({
  onFileSelect,
  onAddReference,
  repoConfigured,
}: WorkspaceTreeViewProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rootLoading, setRootLoading] = useState(false);

  const loadRootDirectory = useCallback(async () => {
    setRootLoading(true);
    setLoadError(null);
    try {
      const result = await fetchDirectoryTree();
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
  }, []);

  // Load on first render if repo is configured
  if (!loaded && !rootLoading && repoConfigured) {
    loadRootDirectory();
  }

  async function handleToggle(path: string) {
    // Check if the node needs loading
    const node = findNode(roots, path);
    if (node && node.type === "directory" && !node.loaded) {
      // Mark as loading
      setRoots((prev) => markNodeLoading(prev, path));
      // Load children
      await loadChildren(path);
    } else {
      // Just toggle expanded
      setRoots((prev) => toggleExpanded(prev, path));
    }
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
      if (node.path === targetPath) {
        return { ...node, loading: true };
      }
      if (node.children) {
        return { ...node, children: markNodeLoading(node.children, targetPath) };
      }
      return node;
    });
  }

  function toggleExpanded(nodes: TreeNode[], targetPath: string): TreeNode[] {
    return nodes.map((node) => {
      if (node.path === targetPath) {
        return { ...node, expanded: !node.expanded };
      }
      if (node.children) {
        return { ...node, children: toggleExpanded(node.children, targetPath) };
      }
      return node;
    });
  }

  async function loadChildren(parentPath: string) {
    try {
      const result = await fetchDirectoryTree(parentPath);
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

  if (!repoConfigured) {
    return (
      <div className="rounded-xl bg-surface-400/30 border border-white/5 p-4">
        <p className="text-sm text-muted-400">
          No hay repositorio configurado. Configura uno en{" "}
          <span className="text-accent-300">Configuración → Repositorio</span> para explorar
          ficheros.
        </p>
      </div>
    );
  }

  if (rootLoading) {
    return (
      <div className="rounded-xl bg-surface-400/30 border border-white/5 p-4">
        <div className="flex items-center gap-2 text-muted-400 text-sm">
          <span className="animate-pulse">●</span>
          <span>Cargando árbol de ficheros...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-danger/5 border border-danger/20 p-4">
        <p className="text-sm text-danger-400">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 bg-surface-400/20">
        <span className="text-xs font-medium text-muted-400">Explorador de archivos</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2">
        <ul role="tree" aria-label="Estructura del proyecto">
          {roots.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              onToggle={handleToggle}
              onFileClick={onFileSelect}
              onAddRef={onAddReference}
            />
          ))}
          {roots.length === 0 && (
            <li className="text-xs text-muted-500 px-2 py-1">Directorio vacío</li>
          )}
        </ul>
      </div>
    </div>
  );
}
