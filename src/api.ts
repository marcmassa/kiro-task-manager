import type {
  Task,
  Comment,
  Category,
  Priority,
  TaskFormData,
  SettingsResponse,
  WorkspaceSettings,
  NotificationSettings,
  LinearIntegrationStatus,
  SyncResult,
  DeleteAllResult,
  Agent,
  AgentExecution,
  TaskAttachment,
  McpServer,
  McpServerInput,
  McpTestResult,
  AiProviderConfigResponse,
  AiProviderSaveInput,
  AiConnectionTestResult,
  AiProviderMeta,
  AgentStatusResponse,
  AgentEngineConfig,
  AgentRunResult,
  RepoConfig,
  FileReference,
  FileReferenceType,
  FileChange,
  FileContentResponse,
  DirectoryEntry,
  GitStatusFile,
  GitBranchInfo,
} from "./types";

const BASE_URL = "/api";

/**
 * Wraps `fetch` and throws if the response is not OK (status 2xx).
 * Parses the JSON body and returns it typed as `T`.
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Error ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) message = parsed.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  return request<Task[]>(`${BASE_URL}/tasks`);
}

export async function fetchTask(id: number): Promise<Task> {
  return request<Task>(`${BASE_URL}/tasks/${id}`);
}

export async function createTask(data: TaskFormData): Promise<Task> {
  return request<Task>(`${BASE_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: number, data: TaskFormData): Promise<Task> {
  return request<Task>(`${BASE_URL}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateTaskStatus(id: number, status: string): Promise<Task> {
  return request<Task>(`${BASE_URL}/tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

export async function fetchComments(taskId: number): Promise<Comment[]> {
  return request<Comment[]>(`${BASE_URL}/tasks/${taskId}/comments`);
}

export async function addComment(
  taskId: number,
  content: string,
  author: string,
): Promise<Comment> {
  return request<Comment>(`${BASE_URL}/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, author }),
  });
}

export async function fetchCategories(): Promise<Category[]> {
  return request<Category[]>(`${BASE_URL}/categories`);
}

export async function fetchPriorities(): Promise<Priority[]> {
  return request<Priority[]>(`${BASE_URL}/priorities`);
}

// ── FEAT-005: Settings + Linear integration + Export + Delete-all ─────────

/** GET /api/settings — returns the current workspace + notification settings. */
export async function fetchSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>(`${BASE_URL}/settings`);
}

/** PATCH /api/settings/workspace — updates workspace fields. */
export async function updateWorkspaceSettings(
  data: Partial<WorkspaceSettings>,
): Promise<SettingsResponse> {
  return request<SettingsResponse>(`${BASE_URL}/settings/workspace`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** PATCH /api/settings/notifications — updates notification prefs. */
export async function updateNotificationSettings(
  data: Partial<NotificationSettings>,
): Promise<SettingsResponse> {
  return request<SettingsResponse>(`${BASE_URL}/settings/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** GET /api/integrations/linear — current status (no key in response). */
export async function getLinearStatus(): Promise<LinearIntegrationStatus> {
  return request<LinearIntegrationStatus>(`${BASE_URL}/integrations/linear`);
}

/**
 * POST /api/integrations/linear/connect — sends the API key ONCE.
 * The key is forgotten as soon as this function returns; the response
 * contains only the safe `{ connected, account, lastSyncAt }` subset.
 * NEVER store `apiKey` in React state beyond this call.
 */
export async function connectLinear(apiKey: string): Promise<LinearIntegrationStatus> {
  return request<LinearIntegrationStatus>(`${BASE_URL}/integrations/linear/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
}

/** POST /api/integrations/linear/sync — triggers a sync. */
export async function syncLinear(): Promise<SyncResult> {
  return request<SyncResult>(`${BASE_URL}/integrations/linear/sync`, {
    method: "POST",
  });
}

/** DELETE /api/integrations/linear — disconnects Linear. */
export async function disconnectLinear(): Promise<LinearIntegrationStatus> {
  return request<LinearIntegrationStatus>(`${BASE_URL}/integrations/linear`, {
    method: "DELETE",
  });
}

/**
 * GET /api/export — triggers a browser download of the JSON export.
 * Returns the filename so the caller can display it; the actual file
 * is downloaded via the browser's Content-Disposition handling.
 */
export async function exportTasks(): Promise<{ filename: string }> {
  const res = await fetch(`${BASE_URL}/export`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match
    ? match[1]
    : `workshop-kiro-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  return { filename };
}

/** DELETE /api/tasks/all — destructive: empties the workspace. */
export async function deleteAllTasks(): Promise<DeleteAllResult> {
  return request<DeleteAllResult>(`${BASE_URL}/tasks/all`, { method: "DELETE" });
}

// ── FEAT-006: Agent orchestration + attachments ──────────────────────────

/** GET /api/agents — enabled agents available for assignment. */
export async function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>(`${BASE_URL}/agents`);
}

/** POST /api/tasks/:id/assign — assigns an agent, creating an execution. */
export async function assignAgent(taskId: number, agentId: string): Promise<AgentExecution> {
  return request<AgentExecution>(`${BASE_URL}/tasks/${taskId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
}

/** GET /api/tasks/:id/execution — current execution or null. */
export async function getExecution(taskId: number): Promise<AgentExecution | null> {
  return request<AgentExecution | null>(`${BASE_URL}/tasks/${taskId}/execution`);
}

/** GET /api/executions — all executions (to render per-card badges). */
export async function fetchAllExecutions(): Promise<AgentExecution[]> {
  return request<AgentExecution[]>(`${BASE_URL}/executions`);
}

/** POST /api/tasks/:id/execution/approve — human approves (→ done). */
export async function approveExecution(taskId: number): Promise<AgentExecution> {
  return request<AgentExecution>(`${BASE_URL}/tasks/${taskId}/execution/approve`, {
    method: "POST",
  });
}

/** POST /api/tasks/:id/execution/request-changes — human requests changes. */
export async function requestChanges(taskId: number, feedback: string): Promise<AgentExecution> {
  return request<AgentExecution>(`${BASE_URL}/tasks/${taskId}/execution/request-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
}

/** GET /api/tasks/:id/attachments — attachment metadata list. */
export async function listAttachments(taskId: number): Promise<TaskAttachment[]> {
  return request<TaskAttachment[]>(`${BASE_URL}/tasks/${taskId}/attachments`);
}

/** POST /api/tasks/:id/attachments — uploads a file (multipart). */
export async function uploadAttachment(taskId: number, file: File): Promise<TaskAttachment> {
  const form = new FormData();
  form.append("file", file);
  return request<TaskAttachment>(`${BASE_URL}/tasks/${taskId}/attachments`, {
    method: "POST",
    body: form,
  });
}

/** DELETE /api/attachments/:id — removes DB record + file on disk. */
export async function deleteAttachment(attachmentId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/attachments/${attachmentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

/** Builds the download URL for an attachment (browser handles the download). */
export function attachmentDownloadUrl(attachmentId: number): string {
  return `${BASE_URL}/attachments/${attachmentId}/download`;
}

// ── FEAT-007: MCP Servers Registry ───────────────────────────────────────

/** GET /api/mcp-servers — list all registered MCP servers (env masked). */
export async function fetchMcpServers(): Promise<McpServer[]> {
  return request<McpServer[]>(`${BASE_URL}/mcp-servers`);
}

/** POST /api/mcp-servers — register a new MCP server. */
export async function createMcpServer(data: McpServerInput): Promise<McpServer> {
  return request<McpServer>(`${BASE_URL}/mcp-servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** PATCH /api/mcp-servers/:id — update a server's configuration. */
export async function updateMcpServer(id: number, data: McpServerInput): Promise<McpServer> {
  return request<McpServer>(`${BASE_URL}/mcp-servers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** POST /api/mcp-servers/:id/toggle — toggle enabled/disabled. */
export async function toggleMcpServer(id: number): Promise<McpServer> {
  return request<McpServer>(`${BASE_URL}/mcp-servers/${id}/toggle`, {
    method: "POST",
  });
}

/** DELETE /api/mcp-servers/:id — remove from registry. */
export async function deleteMcpServer(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/mcp-servers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

/** POST /api/mcp-servers/:id/test — probe connection (handshake + listTools). */
export async function testMcpServer(id: number): Promise<McpTestResult> {
  return request<McpTestResult>(`${BASE_URL}/mcp-servers/${id}/test`, {
    method: "POST",
  });
}

/** POST /api/mcp-servers/apply — generate and write mcp.json. */
export async function applyMcpConfig(): Promise<{ applied: boolean; serverCount: number }> {
  return request<{ applied: boolean; serverCount: number }>(`${BASE_URL}/mcp-servers/apply`, {
    method: "POST",
  });
}

// ── FEAT-009: AI Provider Configuration ──────────────────────────────────

/** GET /api/ai-provider — active provider config (masked) or { configured: false }. */
export async function fetchAiProviderConfig(): Promise<AiProviderConfigResponse> {
  return request<AiProviderConfigResponse>(`${BASE_URL}/ai-provider`);
}

/** PUT /api/ai-provider — save provider configuration. */
export async function saveAiProviderConfig(
  data: AiProviderSaveInput,
): Promise<AiProviderConfigResponse> {
  return request<AiProviderConfigResponse>(`${BASE_URL}/ai-provider`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** DELETE /api/ai-provider — remove provider configuration. */
export async function deleteAiProviderConfig(): Promise<AiProviderConfigResponse> {
  return request<AiProviderConfigResponse>(`${BASE_URL}/ai-provider`, {
    method: "DELETE",
  });
}

/** POST /api/ai-provider/test — test connection to provider. */
export async function testAiProviderConnection(
  data: AiProviderSaveInput,
): Promise<AiConnectionTestResult> {
  return request<AiConnectionTestResult>(`${BASE_URL}/ai-provider/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** GET /api/ai-provider/registry — available providers list. */
export async function fetchAiProviderRegistry(): Promise<AiProviderMeta[]> {
  return request<AiProviderMeta[]>(`${BASE_URL}/ai-provider/registry`);
}

// ── FEAT-010: Agent Engine ───────────────────────────────────────────────

/** GET /api/agent/status — current agent engine status. */
export async function fetchAgentStatus(): Promise<AgentStatusResponse> {
  return request<AgentStatusResponse>(`${BASE_URL}/agent/status`);
}

/** GET /api/agent/config — current agent engine configuration. */
export async function fetchAgentConfig(): Promise<AgentEngineConfig> {
  return request<AgentEngineConfig>(`${BASE_URL}/agent/config`);
}

/** PUT /api/agent/config — update agent engine configuration. */
export async function updateAgentConfig(
  data: Partial<AgentEngineConfig>,
): Promise<AgentEngineConfig> {
  return request<AgentEngineConfig>(`${BASE_URL}/agent/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** POST /api/agent/run — trigger a single agent cycle manually. */
export async function triggerAgentRun(): Promise<AgentRunResult> {
  return request<AgentRunResult>(`${BASE_URL}/agent/run`, {
    method: "POST",
  });
}

// ── FEAT-011: Workspace Git ──────────────────────────────────────────────

/** GET /api/workspace/repo — current repo configuration. */
export async function fetchRepoConfig(): Promise<RepoConfig> {
  return request<RepoConfig>(`${BASE_URL}/workspace/repo`);
}

/** PUT /api/workspace/repo — update repo configuration. */
export async function updateRepoConfig(data: Partial<RepoConfig>): Promise<RepoConfig> {
  return request<RepoConfig>(`${BASE_URL}/workspace/repo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** POST /api/workspace/repo/validate — validate a repo path without saving. */
export async function validateRepoPath(repoPath: string): Promise<{
  ok: boolean;
  repoPath?: string;
  currentBranch?: string;
  code?: string;
  message?: string;
}> {
  return request(`${BASE_URL}/workspace/repo/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoPath }),
  });
}

/** GET /api/tasks/:id/files — list file references for a task. */
export async function fetchTaskFiles(taskId: number): Promise<FileReference[]> {
  return request<FileReference[]>(`${BASE_URL}/tasks/${taskId}/files`);
}

/** POST /api/tasks/:id/files — add a file reference to a task. */
export async function addTaskFile(
  taskId: number,
  filePath: string,
  referenceType: FileReferenceType = "context",
): Promise<FileReference> {
  return request<FileReference>(`${BASE_URL}/tasks/${taskId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, referenceType }),
  });
}

/** DELETE /api/tasks/:id/files/:fileId — remove a file reference. */
export async function removeTaskFile(taskId: number, fileId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/files/${fileId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}

/** GET /api/tasks/:id/changes — list file changes for a task. */
export async function fetchTaskChanges(
  taskId: number,
  executionId?: number,
): Promise<FileChange[]> {
  const params = executionId ? `?execution_id=${executionId}` : "";
  return request<FileChange[]>(`${BASE_URL}/tasks/${taskId}/changes${params}`);
}

/** GET /api/workspace/file?path=<rel> — read file content from workspace. */
export async function fetchFileContent(path: string): Promise<FileContentResponse> {
  return request<FileContentResponse>(
    `${BASE_URL}/workspace/file?path=${encodeURIComponent(path)}`,
  );
}

/** GET /api/workspace/tree?path=<rel> — list directory in workspace. */
export async function fetchDirectoryTree(path?: string): Promise<{ entries: DirectoryEntry[] }> {
  const params = path ? `?path=${encodeURIComponent(path)}` : "";
  return request<{ entries: DirectoryEntry[] }>(`${BASE_URL}/workspace/tree${params}`);
}

/** PUT /api/workspace/file — save file content to workspace. */
export async function saveFileContent(
  filePath: string,
  content: string,
): Promise<{ ok: boolean; size: number }> {
  return request<{ ok: boolean; size: number }>(`${BASE_URL}/workspace/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
}

/** POST /api/workspace/upload — upload a file to the workspace. */
export async function uploadWorkspaceFile(
  file: File,
  dirPath?: string,
): Promise<{ ok: boolean; filePath: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
  return request<{ ok: boolean; filePath: string; size: number }>(
    `${BASE_URL}/workspace/upload${params}`,
    { method: "POST", body: form },
  );
}

/** GET /api/workspace/changes — list recent file changes across all tasks. */
export async function fetchWorkspaceChanges(limit?: number): Promise<FileChange[]> {
  const params = limit ? `?limit=${limit}` : "";
  return request<FileChange[]>(`${BASE_URL}/workspace/changes${params}`);
}

// ── FEAT-011: Git Operations (R16-R20) ──────────────────────────────────────

/** GET /api/workspace/git/status — lista de ficheros con estado Git. */
export async function fetchGitStatus(): Promise<{ files: GitStatusFile[] }> {
  return request<{ files: GitStatusFile[] }>(`${BASE_URL}/workspace/git/status`);
}

/** POST /api/workspace/git/stage — añade ficheros al staging area. */
export async function gitStageFiles(paths: string[]): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE_URL}/workspace/git/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
}

/** POST /api/workspace/git/unstage — quita ficheros del staging area. */
export async function gitUnstageFiles(paths: string[]): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE_URL}/workspace/git/unstage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
}

/** POST /api/workspace/git/commit — crea un commit con mensaje. */
export async function gitCommitChanges(
  message: string,
): Promise<{ ok: boolean; hash: string }> {
  return request<{ ok: boolean; hash: string }>(`${BASE_URL}/workspace/git/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

/** POST /api/workspace/git/push — push al remoto (requiere token). */
export async function gitPushChanges(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE_URL}/workspace/git/push`, {
    method: "POST",
  });
}

/** POST /api/workspace/git/pull — pull del remoto (requiere token). */
export async function gitPullChanges(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE_URL}/workspace/git/pull`, {
    method: "POST",
  });
}

/** GET /api/workspace/git/branches — lista de ramas. */
export async function fetchGitBranches(): Promise<GitBranchInfo> {
  return request<GitBranchInfo>(`${BASE_URL}/workspace/git/branches`);
}

/** POST /api/workspace/git/checkout — cambiar o crear rama. */
export async function gitCheckoutBranch(
  branch: string,
  create?: boolean,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${BASE_URL}/workspace/git/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch, create }),
  });
}
