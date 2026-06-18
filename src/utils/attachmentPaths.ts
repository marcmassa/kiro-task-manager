/**
 * Pure helpers for deriving on-disk storage paths for task attachments.
 *
 * Layout: `uploads/<task_id>/<uuid>-<sanitized-filename>`
 *
 * These functions are pure (no fs access) so they can be unit-tested in
 * isolation. The actual file write/read lives in the server layer.
 */

/** Root directory (relative to the task-manager package root). */
export const UPLOADS_DIR = "uploads";

/**
 * Removes path separators and control characters from a filename so it cannot
 * escape its task directory or inject traversal sequences. Collapses the
 * result to a safe basename; empty results fall back to "archivo".
 */
export function sanitizeFilename(filename: string): string {
  // Keep only the basename — drop any directory component.
  const base = filename.split(/[/\\]/).pop() ?? "";
  // Replace anything that isn't a safe filename char.
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "") // control chars
    .replace(/[^a-zA-Z0-9._-]/g, "_") // unsafe chars → underscore
    .replace(/^\.+/, "") // no leading dots (hidden / traversal)
    .slice(0, 200); // cap length
  return cleaned.length > 0 ? cleaned : "archivo";
}

/** Directory that holds all attachments for a given task. */
export function taskUploadDir(taskId: number): string {
  return `${UPLOADS_DIR}/${taskId}`;
}

/**
 * Full relative storage path for a new attachment.
 * `uuid` is injected (not generated here) to keep the function pure and
 * deterministic for tests.
 */
export function attachmentStoragePath(taskId: number, uuid: string, filename: string): string {
  return `${taskUploadDir(taskId)}/${uuid}-${sanitizeFilename(filename)}`;
}
