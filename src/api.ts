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
