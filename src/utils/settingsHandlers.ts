/**
 * Pure handler logic for the Settings / Integrations endpoints.
 *
 * Why a separate module: the Elysia `.post(...)` route is a closure that
 * captures the live `db` instance. For unit + property tests (T17, T20) we
 * need to call the handler with an in-memory or test-scoped db and a mocked
 * `validateApiKey`. Extracting the body of each handler here keeps the route
 * definitions thin and the test surface small.
 *
 * SECURITY: the `connectLinear` function is the only place that holds the
 * plaintext API key. It does NOT log it, does NOT include it in the
 * response, and the encrypted blob is persisted via the supplied `db`.
 * The `T17` property test enforces this.
 */

import type { Database } from "bun:sqlite";
import { encryptApiKey } from "./crypto";
import * as linearClient from "./linearClient";
import type { LinearViewer } from "./linearClient";

// ---------------------------------------------------------------------------
// Settings — workspace + notifications (singleton row, id = 1)
// ---------------------------------------------------------------------------

export interface SettingsResponse {
  workspace: {
    workspaceName: string;
    defaultLanguage: string;
    defaultTimezone: string;
  };
  notifications: {
    notifyOnDue: boolean;
    notifyOnDone: boolean;
    notifyDailyDigest: boolean;
  };
}

function rowToSettings(row: Record<string, unknown>): SettingsResponse {
  return {
    workspace: {
      workspaceName: String(row.workspace_name ?? "Mi Workspace"),
      defaultLanguage: String(row.default_language ?? "es-ES"),
      defaultTimezone: String(row.default_timezone ?? "Europe/Madrid"),
    },
    notifications: {
      notifyOnDue: Number(row.notify_on_due ?? 1) === 1,
      notifyOnDone: Number(row.notify_on_done ?? 0) === 1,
      notifyDailyDigest: Number(row.notify_daily_digest ?? 0) === 1,
    },
  };
}

export function getSettings(db: Database): SettingsResponse {
  const row = db.query("SELECT * FROM workspace_settings WHERE id = 1").get() as Record<
    string,
    unknown
  > | null;
  if (!row) {
    // Should never happen — T1 seeds the singleton. Defensive default.
    return rowToSettings({});
  }
  return rowToSettings(row);
}

export interface PatchWorkspaceInput {
  workspaceName?: string;
  defaultLanguage?: string;
  defaultTimezone?: string;
}

export function patchWorkspaceSettings(
  db: Database,
  input: PatchWorkspaceInput,
): { status: number; body: unknown } {
  const current = getSettings(db);
  const next = {
    workspaceName:
      typeof input.workspaceName === "string" && input.workspaceName.trim() !== ""
        ? input.workspaceName.trim()
        : current.workspace.workspaceName,
    defaultLanguage: input.defaultLanguage ?? current.workspace.defaultLanguage,
    defaultTimezone: input.defaultTimezone ?? current.workspace.defaultTimezone,
  };
  db.prepare(
    `UPDATE workspace_settings
       SET workspace_name = ?, default_language = ?, default_timezone = ?, updated_at = datetime('now')
     WHERE id = 1`,
  ).run(next.workspaceName, next.defaultLanguage, next.defaultTimezone);
  return { status: 200, body: getSettings(db) };
}

export interface PatchNotificationsInput {
  notifyOnDue?: boolean;
  notifyOnDone?: boolean;
  notifyDailyDigest?: boolean;
}

export function patchNotificationSettings(
  db: Database,
  input: PatchNotificationsInput,
): { status: number; body: unknown } {
  const current = getSettings(db);
  const next = {
    notifyOnDue:
      typeof input.notifyOnDue === "boolean"
        ? input.notifyOnDue
        : current.notifications.notifyOnDue,
    notifyOnDone:
      typeof input.notifyOnDone === "boolean"
        ? input.notifyOnDone
        : current.notifications.notifyOnDone,
    notifyDailyDigest:
      typeof input.notifyDailyDigest === "boolean"
        ? input.notifyDailyDigest
        : current.notifications.notifyDailyDigest,
  };
  db.prepare(
    `UPDATE workspace_settings
       SET notify_on_due = ?, notify_on_done = ?, notify_daily_digest = ?, updated_at = datetime('now')
     WHERE id = 1`,
  ).run(next.notifyOnDue ? 1 : 0, next.notifyOnDone ? 1 : 0, next.notifyDailyDigest ? 1 : 0);
  return { status: 200, body: getSettings(db) };
}

// ---------------------------------------------------------------------------
// Linear integration — connect / status / sync / disconnect
// ---------------------------------------------------------------------------

export interface LinearStatusResponse {
  connected: boolean;
  account?: { id: string; name: string; email: string };
  lastSyncAt?: string | null;
  lastSyncSummary?: { found: number; mappable: number; alreadyInKanban: number };
}

function rowToLinearStatus(row: Record<string, unknown>): LinearStatusResponse {
  const account = {
    id: String(row.account_id),
    name: String(row.account_name),
    email: String(row.account_email),
  };
  const status: LinearStatusResponse = {
    connected: true,
    account,
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
  };
  if (row.last_sync_summary) {
    try {
      status.lastSyncSummary = JSON.parse(String(row.last_sync_summary));
    } catch {
      // ignore malformed summary
    }
  }
  return status;
}

export function getLinearStatus(db: Database): LinearStatusResponse {
  const row = db
    .query("SELECT * FROM integration_connections WHERE provider = ?")
    .get("linear") as Record<string, unknown> | null;
  if (!row) return { connected: false };
  return rowToLinearStatus(row);
}

export interface ConnectLinearInput {
  apiKey: string;
}

/**
 * The CORE R7 enforcement boundary.
 *
 * `connectLinear` accepts the plaintext API key, validates it via
 * `linearClient.validateApiKey`, encrypts it, and persists the ciphertext
 * + the safe viewer subset. The plaintext key:
 *   - is the function parameter (lives in the call stack for the duration)
 *   - is never returned, never logged, never persisted in plaintext
 *   - is forgotten as soon as the function returns
 *
 * The T17 property test asserts that `JSON.stringify(result).includes(apiKey)`
 * is always false for any syntactically-valid Linear key.
 */
export async function connectLinear(
  db: Database,
  input: ConnectLinearInput,
  deps: { validateApiKey?: (key: string) => Promise<LinearViewer> } = {},
): Promise<{ status: number; body: unknown }> {
  // SECURITY: apiKey must NEVER be logged. See R7.
  const apiKey = (input?.apiKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) {
    return { status: 400, body: { error: "El API key no puede estar vacío" } };
  }

  const validate = deps.validateApiKey ?? linearClient.validateApiKey;
  let viewer: LinearViewer;
  try {
    viewer = await validate(apiKey);
  } catch {
    return { status: 400, body: { error: "API key inválido o sin acceso" } };
  }

  const ciphertext = await encryptApiKey(apiKey);
  // The plaintext `apiKey` is dropped from the local scope here. Any
  // accidental capture in a closure (e.g. an error object) would still
  // not include the key in `result.body` because the response shape is
  // fixed below and only `viewer` and `lastSyncAt` are returned.
  db.prepare(
    `INSERT INTO integration_connections
       (provider, api_key_encrypted, account_id, account_name, account_email, last_sync_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(provider) DO UPDATE SET
       api_key_encrypted = excluded.api_key_encrypted,
       account_id        = excluded.account_id,
       account_name      = excluded.account_name,
       account_email     = excluded.account_email,
       updated_at        = datetime('now')`,
  ).run("linear", ciphertext, viewer.id, viewer.name, viewer.email);

  return {
    status: 200,
    body: {
      connected: true,
      account: { id: viewer.id, name: viewer.name, email: viewer.email },
      lastSyncAt: null,
    },
  };
}

export function disconnectLinear(db: Database): { status: number; body: unknown } {
  db.prepare("DELETE FROM integration_connections WHERE provider = ?").run("linear");
  return { status: 200, body: { connected: false } };
}

export interface SyncLinearResponse {
  found: number;
  mappable: number;
  alreadyInKanban: number;
  lastSyncAt: string;
}

/**
 * v1 sync is a stub: it does NOT actually call Linear (the issue mapping
 * is a v2 feature). The endpoint exists so the UI can demonstrate the
 * "Sincronizar ahora" flow with a deterministic summary, and so the
 * `lastSyncAt` + `lastSyncSummary` fields are populated for the v2
 * implementation to replace with a real `fetchIssues` call.
 */
export function syncLinear(db: Database): { status: number; body: unknown } {
  const row = db
    .query("SELECT * FROM integration_connections WHERE provider = ?")
    .get("linear") as Record<string, unknown> | null;
  if (!row) {
    return { status: 400, body: { error: "No hay ninguna integración con Linear configurada" } };
  }
  const summary = { found: 47, mappable: 12, alreadyInKanban: 3 };
  const lastSyncAt = new Date().toISOString();
  db.prepare(
    `UPDATE integration_connections
       SET last_sync_at = ?, last_sync_summary = ?, updated_at = datetime('now')
     WHERE provider = ?`,
  ).run(lastSyncAt, JSON.stringify(summary), "linear");
  return { status: 200, body: { ...summary, lastSyncAt } };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function buildExportPayload(db: Database): string {
  const tasks = db.query("SELECT * FROM tasks ORDER BY id").all();
  const comments = db.query("SELECT * FROM comments ORDER BY id").all();
  const categories = db.query("SELECT * FROM categories ORDER BY id").all();
  const priorities = db.query("SELECT * FROM priorities ORDER BY id").all();
  const workspace = db.query("SELECT * FROM workspace_settings WHERE id = 1").get() as Record<
    string,
    unknown
  > | null;
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      workspace,
      tasks,
      comments,
      categories,
      priorities,
    },
    null,
    2,
  );
}

export function exportAttachmentResponse(db: Database): Response {
  const body = buildExportPayload(db);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="workshop-kiro-tasks-${date}.json"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Delete all (transactional)
// ---------------------------------------------------------------------------

export function deleteAllTasks(db: Database): { status: number; body: unknown } {
  const tx = db.transaction(() => {
    db.exec("DELETE FROM comments");
    db.exec("DELETE FROM tasks");
  });
  tx();
  // `SELECT changes()` returns the number of rows changed by the most
  // recent INSERT/UPDATE/DELETE — which is the DELETE FROM tasks count
  // (the DELETE FROM comments was overwritten).
  const result = db.query("SELECT changes() as n").get() as { n: number };
  return { status: 200, body: { deleted: result.n } };
}
