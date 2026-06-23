export interface Task {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority_id: number;
  category_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  priority_name: string;
  priority_color: string;
  priority_level: number;
  category_name: string;
  category_color: string;
}

export interface Comment {
  id: number;
  task_id: number;
  content: string;
  author: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Priority {
  id: number;
  name: string;
  level: number;
  color: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskFormData {
  title: string;
  description: string;
  priority_id: number;
  category_id: number;
  due_date: string;
  status: TaskStatus;
}

// ── FEAT-005: Settings + Linear integration types ─────────────────────────

export interface WorkspaceSettings {
  workspaceName: string;
  defaultLanguage: string; // 'es-ES' en v1
  defaultTimezone: string; // 'Europe/Madrid' en v1
}

export interface NotificationSettings {
  notifyOnDue: boolean;
  notifyOnDone: boolean;
  notifyDailyDigest: boolean;
}

export interface SettingsResponse {
  workspace: WorkspaceSettings;
  notifications: NotificationSettings;
}

export interface LinearAccount {
  id: string;
  name: string;
  email: string;
}

export interface LinearIntegrationStatus {
  connected: boolean;
  account?: LinearAccount; // presente solo si connected
  lastSyncAt?: string | null; // ISO timestamp
  lastSyncSummary?: {
    // presente si lastSyncAt !== null
    found: number;
    mappable: number;
    alreadyInKanban: number;
  };
}

export interface SyncResult {
  found: number;
  mappable: number;
  alreadyInKanban: number;
  lastSyncAt: string;
}

export interface DeleteAllResult {
  deleted: number;
}

// ── FEAT-006: Agent orchestration types ───────────────────────────────────

/** Lifecycle state of an agent execution (parallel to the Kanban status). */
export type AgentState =
  | "assigned"
  | "agent_working"
  | "pending_review"
  | "changes_requested"
  | "done";

/** An AI agent that can be assigned tasks. */
export interface Agent {
  id: string; // 'kiro', 'opencode', ...
  name: string;
  kind: string; // 'mcp' in v1
  enabled: boolean;
}

/** The agent execution attached to a task (null when unassigned). */
export interface AgentExecution {
  id: number;
  task_id: number;
  agent_id: string;
  state: AgentState;
  agent_summary: string | null;
  review_feedback: string | null;
  created_at: string;
  updated_at: string;
}

/** Metadata for a file attached to a task (the file itself lives on disk). */
export interface TaskAttachment {
  id: number;
  task_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

// ── FEAT-007: MCP Servers Registry types ──────────────────────────────────

export type McpTransport = "stdio" | "http";

export interface McpServer {
  id: number;
  name: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: Record<string, string>; // masked values (never plaintext)
  url: string | null;
  enabled: boolean;
  autoApprove: string[];
  createdAt: string;
  updatedAt: string;
}

export interface McpServerInput {
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
  autoApprove?: string[];
}

export interface McpTestResult {
  ok: boolean;
  toolCount?: number;
  toolNames?: string[];
  errorKind?: "timeout" | "spawn_error" | "protocol_error";
  message?: string;
}

// ── FEAT-009: AI Provider configuration types ─────────────────────────────

export type AiAuthType = "api_key" | "aws_credentials" | "none";

export interface AiProviderMeta {
  id: string;
  displayName: string;
  defaultBaseUrl: string;
  authType: AiAuthType;
  models: string[];
  supportsCustomBaseUrl: boolean;
}

export interface AiProviderConfigResponse {
  configured: boolean;
  providerId?: string;
  providerName?: string;
  model?: string;
  apiKeyMasked?: string;
  accessKeyId?: string;
  region?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProviderSaveInput {
  providerId: string;
  model: string;
  apiKey?: string;
  secretAccessKey?: string;
  accessKeyId?: string;
  region?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiConnectionTestResult {
  ok: boolean;
  model?: string;
  errorKind?: "timeout" | "auth_error" | "network_error" | "provider_error";
  message?: string;
}

// ── FEAT-010: Agent Engine types ──────────────────────────────────────────

/** Estado del motor de agente. */
export type AgentEngineStatus = "idle" | "working" | "error" | "disabled";

/** Respuesta de GET /api/agent/status. */
export interface AgentStatusResponse {
  status: AgentEngineStatus;
  currentTaskId: number | null;
  currentTaskTitle: string | null;
  lastError: string | null;
  lastCycleAt: string | null;
}

/** Configuración del agent engine (GET/PUT /api/agent/config). */
export interface AgentEngineConfig {
  autoStart: boolean;
  pollIntervalMs: number;
  maxIterations: number;
  maxRetries: number;
  toolTimeoutMs: number;
}

/** Resultado de POST /api/agent/run. */
export interface AgentRunResult {
  ok: boolean;
  taskId?: number;
  message: string;
}

// ── FEAT-011: Workspace Git types ─────────────────────────────────────────

/** Estado de conexión del repositorio. */
export type RepoStatus = "connected" | "disconnected" | "error" | "not_configured";

/** Tipo de referencia de fichero a tarea. */
export type FileReferenceType = "context" | "output" | "modified";

/** Tipo de cambio registrado por el agente. */
export type FileChangeType = "created" | "modified" | "deleted";

/** Configuración del repositorio (desde GET /api/workspace/repo). */
export interface RepoConfig {
  repoPath: string | null;
  repoRemoteUrl: string | null;
  repoDefaultBranch: string;
  repoStatus: RepoStatus;
  currentBranch: string | null;
}

/** Referencia de fichero asociada a una tarea. */
export interface FileReference {
  id: number;
  taskId: number;
  filePath: string;
  referenceType: FileReferenceType;
  createdAt: string;
}

/** Cambio de fichero registrado por el agente durante ejecución. */
export interface FileChange {
  id: number;
  taskId: number;
  filePath: string;
  changeType: FileChangeType;
  agentExecutionId: number | null;
  createdAt: string;
}

/** Entrada del árbol de directorio (desde GET /api/workspace/tree). */
export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  size: number;
}

/** Respuesta del visor de contenido (desde GET /api/workspace/file). */
export interface FileContentResponse {
  content: string;
  size: number;
  language: string;
}


// ── FEAT-011: Git Operations Extension (R16-R20) ────────────────────────────

/** Estado de un fichero en git status. */
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
