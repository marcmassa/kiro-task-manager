import { useState, useCallback, useEffect, useRef } from "react";
import { fetchWorkspaceTree, saveWorkspaceFile, createWorkspaceDir } from "../api";
import type { DirectoryEntry } from "../types";

interface WorkspaceTreeViewProps {
  workspaceId: number;
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

type CreatingKind = "file" | "dir" | null;

// ── File-type icon components ────────────────────────────────────────────────

function IconFolder({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {open ? (
        <path
          d="M1 4.5A1.5 1.5 0 012.5 3H6l1.5 1.5H14a1.5 1.5 0 011.5 1.5v.5H1V4.5zM1 7h14l-1 7H2L1 7z"
          fill="#7c5cfc"
          opacity="0.9"
        />
      ) : (
        <path
          d="M2.5 3A1.5 1.5 0 001 4.5v7A1.5 1.5 0 002.5 13h11A1.5 1.5 0 0015 11.5v-6A1.5 1.5 0 0013.5 4H7L5.5 3H2.5z"
          fill="#7c5cfc"
          opacity="0.6"
        />
      )}
    </svg>
  );
}

function IconBadge({ label, color }: { label: string; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect width="14" height="14" rx="2.5" fill={color} opacity="0.18" />
      <text
        x="7"
        y="10"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fontFamily="monospace"
        fill={color}
      >
        {label}
      </text>
    </svg>
  );
}

function IconDocument({ color = "#6b7280" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 2h5.5L13 5.5V14H4V2z"
        fill={color}
        opacity="0.15"
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M9 2v4h4" stroke={color} strokeWidth="1" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function IconJson() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect width="14" height="14" rx="2.5" fill="#f59e0b" opacity="0.12" />
      <text x="7" y="10" textAnchor="middle" fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="#f59e0b">
        {"{}"}
      </text>
    </svg>
  );
}

function IconMarkdown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect width="14" height="14" rx="2.5" fill="#9ca3af" opacity="0.12" />
      <text x="7" y="10" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="monospace" fill="#9ca3af">
        M↓
      </text>
    </svg>
  );
}

function getFileIconEl(name: string, type: "file" | "directory", expanded = false) {
  if (type === "directory") return <IconFolder open={expanded} />;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":      return <IconBadge label="ts"  color="#3b82f6" />;
    case "tsx":     return <IconBadge label="tsx" color="#60a5fa" />;
    case "js":      return <IconBadge label="js"  color="#eab308" />;
    case "jsx":     return <IconBadge label="jsx" color="#facc15" />;
    case "json":    return <IconJson />;
    case "md":      return <IconMarkdown />;
    case "css":     return <IconBadge label="css" color="#38bdf8" />;
    case "html":    return <IconBadge label="html" color="#f97316" />;
    case "py":      return <IconBadge label="py"  color="#22d3ee" />;
    case "sh":
    case "bash":    return <IconBadge label="sh"  color="#10b981" />;
    case "svg":     return <IconBadge label="svg" color="#f472b6" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":    return <IconBadge label="img" color="#a78bfa" />;
    default:        return <IconDocument />;
  }
}

// ── Inline create input ──────────────────────────────────────────────────────

function CreateInput({
  kind,
  contextDir,
  depth,
  onConfirm,
  onCancel,
}: {
  kind: "file" | "dir";
  contextDir: string;
  depth: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) onConfirm(trimmed);
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <li>
      <div
        className="flex items-center gap-1.5 py-[3px] pr-2"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="w-3 shrink-0" />
        <span className="shrink-0 flex items-center">
          {kind === "dir" ? <IconFolder open={false} /> : <IconDocument color="#7c5cfc" />}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onCancel}
          placeholder={kind === "dir" ? "nueva-carpeta" : "nuevo-fichero.ts"}
          className="flex-1 min-w-0 bg-surface-400/60 border border-accent/40 rounded px-1.5 py-0.5 text-[11.5px] font-mono text-gray-200 placeholder-muted-600 outline-none focus:border-accent/80"
          aria-label={kind === "dir" ? "Nombre de la nueva carpeta" : "Nombre del nuevo fichero"}
        />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onConfirm(trimmed);
          }}
          className="shrink-0 text-[10px] text-accent-300 hover:text-accent-200 px-1"
          aria-label="Confirmar"
        >
          ✓
        </button>
      </div>
    </li>
  );
}

// ── TreeItem ─────────────────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  creating,
  onToggle,
  onFileClick,
  onAddRef,
  onSetActiveDir,
  onCreateConfirm,
  onCreateCancel,
}: {
  node: TreeNode;
  depth: number;
  creating: { kind: CreatingKind; parentPath: string } | null;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  onAddRef: (path: string) => void;
  onSetActiveDir: (path: string) => void;
  onCreateConfirm: (name: string) => void;
  onCreateCancel: () => void;
}) {
  const isDir = node.type === "directory";

  function handleClick() {
    if (isDir) {
      onSetActiveDir(node.path);
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

  // Show create input inside this directory?
  const showCreateHere =
    creating &&
    creating.kind &&
    creating.parentPath === node.path &&
    node.expanded;

  return (
    <li role="treeitem" aria-expanded={isDir ? node.expanded : undefined}>
      <div
        className="flex items-center gap-1.5 py-[3px] pr-2 rounded-md hover:bg-white/5 cursor-pointer text-sm group transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={
          isDir
            ? `${node.expanded ? "Colapsar" : "Expandir"} directorio: ${node.name}`
            : `Abrir fichero: ${node.name}`
        }
      >
        <span className="w-3 shrink-0 flex items-center justify-center" aria-hidden="true">
          {isDir &&
            (node.loading ? (
              <svg width="8" height="8" viewBox="0 0 8 8" className="animate-spin" fill="none">
                <circle cx="4" cy="4" r="3" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="10 5" />
              </svg>
            ) : (
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                style={{
                  transform: node.expanded ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s",
                }}
              >
                <path
                  d="M2.5 1.5L5.5 4L2.5 6.5"
                  stroke="#6b7280"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
        </span>

        <span className="shrink-0 flex items-center">
          {getFileIconEl(node.name, node.type, node.expanded)}
        </span>

        <span
          className={`font-mono text-[11.5px] truncate leading-none ${
            isDir ? "text-gray-200 font-medium" : "text-gray-400"
          }`}
        >
          {node.name}
        </span>

        {!isDir && (
          <button
            className="ml-auto opacity-0 group-hover:opacity-100 text-[9px] text-accent-400 hover:text-accent-300 transition-opacity px-1 shrink-0 font-mono"
            onClick={(e) => {
              e.stopPropagation();
              onAddRef(node.path);
            }}
            aria-label={`Añadir ${node.name} como referencia`}
            title="Añadir como referencia"
          >
            +ref
          </button>
        )}
      </div>

      {isDir && node.expanded && node.children && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              creating={creating}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onAddRef={onAddRef}
              onSetActiveDir={onSetActiveDir}
              onCreateConfirm={onCreateConfirm}
              onCreateCancel={onCreateCancel}
            />
          ))}

          {/* Inline create input inside this directory */}
          {showCreateHere && (
            <CreateInput
              kind={creating!.kind!}
              contextDir={node.path}
              depth={depth + 1}
              onConfirm={onCreateConfirm}
              onCancel={onCreateCancel}
            />
          )}

          {node.children.length === 0 && !showCreateHere && (
            <li
              className="text-[11px] text-muted-600 italic"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              vacío
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

// ── WorkspaceTreeView ─────────────────────────────────────────────────────────

export function WorkspaceTreeView({
  workspaceId,
  onFileSelect,
  onAddReference,
  repoConfigured,
}: WorkspaceTreeViewProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rootLoading, setRootLoading] = useState(false);

  // Active directory context for new file/folder creation
  const [activeDir, setActiveDir] = useState<string>("");
  // Pending creation: kind + where to show the input
  const [creating, setCreating] = useState<{ kind: CreatingKind; parentPath: string } | null>(null);

  const loadRootDirectory = useCallback(async () => {
    if (!workspaceId || workspaceId <= 0) {
      setRoots([]);
      setLoaded(true);
      setRootLoading(false);
      return;
    }
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
    if (!repoConfigured) {
      setRoots([]);
      setLoaded(false);
      setRootLoading(false);
      setLoadError(null);
      return;
    }
    setRoots([]);
    setLoaded(false);
    setLoadError(null);
    void loadRootDirectory();
  }, [repoConfigured, workspaceId, loadRootDirectory]);

  async function handleToggle(path: string) {
    const node = findNode(roots, path);
    if (node && node.type === "directory" && !node.loaded) {
      setRoots((prev) => markNodeLoading(prev, path));
      await loadChildren(path);
    } else {
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
      if (node.path === targetPath)
        return { ...node, children, loaded: true, expanded: true, loading: false };
      if (node.children)
        return { ...node, children: updateNodeChildren(node.children, targetPath, children) };
      return node;
    });
  }

  // ── Creation flow ──────────────────────────────────────────────────────────

  function startCreating(kind: "file" | "dir") {
    setCreating({ kind, parentPath: activeDir });

    // If creating inside a directory that isn't expanded yet, expand it
    if (activeDir) {
      const node = findNode(roots, activeDir);
      if (node && node.type === "directory" && !node.expanded) {
        void handleToggle(activeDir);
      }
    }
  }

  async function handleCreateConfirm(name: string) {
    const targetPath = creating!.parentPath
      ? `${creating!.parentPath}/${name}`
      : name;

    try {
      if (creating!.kind === "dir") {
        await createWorkspaceDir(workspaceId, targetPath);
        // Reload the parent directory
        const parentPath = creating!.parentPath;
        if (parentPath) {
          setRoots((prev) => markNodeLoading(prev, parentPath));
          await loadChildren(parentPath);
        } else {
          await loadRootDirectory();
        }
      } else {
        await saveWorkspaceFile(workspaceId, targetPath, "");
        // Reload the parent directory
        const parentPath = creating!.parentPath;
        if (parentPath) {
          setRoots((prev) => markNodeLoading(prev, parentPath));
          await loadChildren(parentPath);
        } else {
          await loadRootDirectory();
        }
        // Open the new file
        onFileSelect(targetPath);
      }
    } catch (err) {
      console.error("Error creating:", err);
    } finally {
      setCreating(null);
    }
  }

  function handleCreateCancel() {
    setCreating(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin shrink-0" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 6" />
          </svg>
          <span>Cargando árbol de ficheros…</span>
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

  const contextLabel = activeDir || "/";

  return (
    <div className="rounded-xl bg-surface-400/30 border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 bg-surface-400/20 flex items-center gap-2">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-accent-400 shrink-0" aria-hidden="true">
          <path
            d="M2.5 3A1.5 1.5 0 001 4.5v7A1.5 1.5 0 002.5 13h11A1.5 1.5 0 0015 11.5v-6A1.5 1.5 0 0013.5 4H7L5.5 3H2.5z"
            fill="currentColor"
            opacity="0.7"
          />
        </svg>
        <span className="text-[11px] font-medium text-muted-400 tracking-wide uppercase mr-auto">
          Explorador
        </span>

        {/* New file button */}
        <button
          onClick={() => startCreating("file")}
          title={`Nuevo fichero en ${contextLabel}`}
          aria-label="Nuevo fichero"
          className={`p-1 rounded transition-colors ${
            creating?.kind === "file"
              ? "bg-accent/20 text-accent-300"
              : "text-muted-500 hover:text-accent-300 hover:bg-white/5"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 2h5.5L13 5.5V14H4V2z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
            <path d="M7 10v3M5.5 11.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* New folder button */}
        <button
          onClick={() => startCreating("dir")}
          title={`Nueva carpeta en ${contextLabel}`}
          aria-label="Nueva carpeta"
          className={`p-1 rounded transition-colors ${
            creating?.kind === "dir"
              ? "bg-accent/20 text-accent-300"
              : "text-muted-500 hover:text-accent-300 hover:bg-white/5"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2.5 3A1.5 1.5 0 001 4.5v7A1.5 1.5 0 002.5 13h11A1.5 1.5 0 0015 11.5v-6A1.5 1.5 0 0013.5 4H7L5.5 3H2.5z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M8 7.5v3M6.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Context hint while creating */}
      {creating && (
        <div className="px-3 py-1.5 bg-accent/5 border-b border-accent/10 flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-accent-400 shrink-0">
            <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] text-muted-500">
            {creating.kind === "file" ? "Nuevo fichero" : "Nueva carpeta"} en{" "}
            <span className="font-mono text-accent-400">{contextLabel}</span>
            <span className="ml-2 opacity-60">— Esc para cancelar</span>
          </span>
        </div>
      )}

      {/* Tree */}
      <div className="py-1">
        <ul role="tree" aria-label="Estructura del proyecto">
          {roots.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              creating={creating}
              onToggle={handleToggle}
              onFileClick={onFileSelect}
              onAddRef={onAddReference}
              onSetActiveDir={setActiveDir}
              onCreateConfirm={handleCreateConfirm}
              onCreateCancel={handleCreateCancel}
            />
          ))}

          {/* Root-level create input */}
          {creating && creating.parentPath === "" && (
            <CreateInput
              kind={creating.kind!}
              contextDir=""
              depth={0}
              onConfirm={handleCreateConfirm}
              onCancel={handleCreateCancel}
            />
          )}

          {roots.length === 0 && loaded && !creating && (
            <li className="text-[11px] text-muted-600 px-3 py-2 italic">Directorio vacío</li>
          )}
        </ul>
      </div>
    </div>
  );
}
