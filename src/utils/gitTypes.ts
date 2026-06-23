/** Estado de conexión del repositorio. */
export type RepoStatus = "connected" | "disconnected" | "error" | "not_configured";

/** Tipo de referencia de fichero a tarea. */
export type FileReferenceType = "context" | "output" | "modified";

/** Tipo de cambio registrado por el agente. */
export type FileChangeType = "created" | "modified" | "deleted";

/** Códigos de error de validación de ruta de repositorio. */
export type RepoPathErrorCode =
  | "EMPTY_PATH"
  | "NOT_ABSOLUTE"
  | "DIR_NOT_FOUND"
  | "NOT_GIT_REPO"
  | "NO_PERMISSIONS";

/** Códigos de error de validación de ruta de fichero relativa. */
export type FilePathErrorCode = "EMPTY_PATH" | "ABSOLUTE_PATH" | "PATH_TRAVERSAL" | "NULL_CHAR";

/** Resultado de validación de ruta de repositorio. */
export type RepoPathValidationResult =
  | { ok: true; repoPath: string; currentBranch: string }
  | { ok: false; code: RepoPathErrorCode; message: string };

/** Resultado de validación de ruta de fichero relativa. */
export type FilePathValidationResult =
  | { ok: true; normalizedPath: string }
  | { ok: false; code: FilePathErrorCode; message: string };

/** Configuración del repositorio (persistida en workspace_settings). */
export interface RepoConfig {
  repoPath: string | null;
  repoRemoteUrl: string | null;
  repoDefaultBranch: string;
  repoStatus: RepoStatus;
  currentBranch: string | null;
}

/** Registro de referencia de fichero (tabla task_file_references). */
export interface FileReference {
  id: number;
  taskId: number;
  filePath: string;
  referenceType: FileReferenceType;
  createdAt: string;
}

/** Registro de cambio de fichero (tabla task_file_changes). */
export interface FileChange {
  id: number;
  taskId: number;
  filePath: string;
  changeType: FileChangeType;
  agentExecutionId: number | null;
  createdAt: string;
}

/** Adaptador de filesystem inyectable para testing. */
export interface FsAdapter {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  hasReadWritePermission(path: string): boolean;
  readGitHead(path: string): string | null;
}

/** Contexto del repositorio para el system prompt del agente. */
export interface RepoPromptContext {
  workingDir: string;
  currentBranch: string;
  directoryTree: string;
  contextFiles: string[];
}

// ── FEAT-011: Git Operations Extension (R16-R20) ────────────────────────────

/** Estado de un fichero en git status --porcelain. */
export interface GitStatusFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
  staged: boolean;
}

/** Información de ramas del repositorio. */
export interface GitBranchInfo {
  branches: string[];
  current: string;
}
