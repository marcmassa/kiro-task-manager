export type ValidationIntent = "approve" | "request_changes" | null;

const APPROVE_PATTERN = /^(✅|aprobado|aprobada|lgtm|ok)(?=\s|$)/i;
const CHANGES_PATTERN = /^(❌|cambios:|revisar:|pedir cambios)/i;

/**
 * Pure — no side effects. Parses a comment body and returns the validation
 * intent, or null if the comment is not a validation signal.
 */
export function parseValidationComment(text: string): ValidationIntent {
  const trimmed = text.trim();
  if (APPROVE_PATTERN.test(trimmed)) return "approve";
  if (CHANGES_PATTERN.test(trimmed)) return "request_changes";
  return null;
}

/** Extracts the feedback body after the keyword (for request_changes). */
export function extractFeedback(text: string): string {
  return text.replace(CHANGES_PATTERN, "").trim();
}
