/**
 * Attachment validation — pure logic (FEAT-006).
 *
 * No fs / network dependencies so it can be property-tested in isolation and
 * shared by the upload endpoint. Enforces a size cap and a MIME allow-list (R14).
 */

/** Maximum allowed attachment size: 10 MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Allow-list of accepted MIME types. */
export const ALLOWED_MIME: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
] as const;

export type AttachmentValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validates an attachment's MIME type and size. Returns a Spanish-language
 * reason on rejection. Never throws.
 */
export function validateAttachment(input: { mime: string; size: number }): AttachmentValidation {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, reason: "El archivo está vacío o tiene un tamaño inválido." };
  }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: `El archivo supera el límite de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
    };
  }
  if (!ALLOWED_MIME.includes(input.mime)) {
    return { ok: false, reason: `Tipo de archivo no permitido: ${input.mime}` };
  }
  return { ok: true };
}
