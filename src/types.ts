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
