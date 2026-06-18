/**
 * Handler logic for the AI Provider configuration endpoints.
 *
 * Pattern: same as mcpHandlers.ts — functions receive `db: Database`
 * as first arg, return `{ status: number; body: unknown }`. Thin, testable,
 * imported by server.ts routes.
 *
 * SECURITY: API keys are encrypted at rest (R6.1). They are decrypted ONLY
 * inside `getActiveProviderConfig` (internal, for agent use). The frontend
 * NEVER receives plaintext secrets (R6.2). No secret is ever logged (R6.3).
 *
 * Covers: R2.1, R2.2, R2.3, R2.4, R5.4, R6.1, R6.2, R6.3, R6.4, R7.1, R7.3
 */

import type { Database } from "bun:sqlite";
import { encryptApiKey, decryptApiKey } from "./crypto";
import {
  validateAiProviderConfig,
  maskApiKey,
  PROVIDER_REGISTRY,
  type NormalizedAiProviderConfig,
} from "./aiProviderConfig";
import { testProviderConnection } from "./aiProviderTest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiProviderRow {
  id: number;
  provider_id: string;
  model: string;
  api_key_encrypted: string;
  secret_access_key_encrypted: string;
  access_key_id: string;
  region: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Module-level cache (invalidated on save/delete)
// ---------------------------------------------------------------------------

let cachedConfig: { config: NormalizedAiProviderConfig; timestamp: number } | null = null;

function invalidateCache(): void {
  cachedConfig = null;
}

// ---------------------------------------------------------------------------
// getAiProviderConfig (R2.3)
// ---------------------------------------------------------------------------

/**
 * Returns the active AI provider config with masked secrets,
 * or `{ configured: false }` if no config exists.
 */
export async function getAiProviderConfig(
  db: Database,
): Promise<{ status: number; body: unknown }> {
  const row = db
    .query("SELECT * FROM ai_provider_config WHERE id = 1")
    .get() as AiProviderRow | null;

  if (!row) {
    return { status: 200, body: { configured: false } };
  }

  const provider = PROVIDER_REGISTRY.find((p) => p.id === row.provider_id);

  // Decrypt API key for masking only
  let apiKeyMasked = "";
  if (row.api_key_encrypted) {
    const decrypted = await decryptApiKey(row.api_key_encrypted);
    apiKeyMasked = maskApiKey(decrypted);
  }

  return {
    status: 200,
    body: {
      configured: true,
      providerId: row.provider_id,
      providerName: provider?.displayName ?? row.provider_id,
      model: row.model,
      apiKeyMasked,
      accessKeyId: row.access_key_id,
      region: row.region,
      baseUrl: row.base_url,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

// ---------------------------------------------------------------------------
// saveAiProviderConfig (R2.1, R2.2, R6.1)
// ---------------------------------------------------------------------------

/**
 * Validates input, encrypts secrets, and performs UPSERT on the singleton row.
 * Invalidates module-level cache on success.
 */
export async function saveAiProviderConfig(
  db: Database,
  input: unknown,
): Promise<{ status: number; body: unknown }> {
  const validation = validateAiProviderConfig(input);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.reason } };
  }

  const value = validation.value;

  // Encrypt secrets — NEVER log them (R6.3)
  const apiKeyEncrypted = value.apiKey ? await encryptApiKey(value.apiKey) : "";
  const secretAccessKeyEncrypted = value.secretAccessKey
    ? await encryptApiKey(value.secretAccessKey)
    : "";

  db.prepare(
    `INSERT INTO ai_provider_config (id, provider_id, model, api_key_encrypted, secret_access_key_encrypted, access_key_id, region, base_url, temperature, max_tokens, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       provider_id = excluded.provider_id,
       model = excluded.model,
       api_key_encrypted = excluded.api_key_encrypted,
       secret_access_key_encrypted = excluded.secret_access_key_encrypted,
       access_key_id = excluded.access_key_id,
       region = excluded.region,
       base_url = excluded.base_url,
       temperature = excluded.temperature,
       max_tokens = excluded.max_tokens,
       updated_at = excluded.updated_at`,
  ).run(
    value.providerId,
    value.model,
    apiKeyEncrypted,
    secretAccessKeyEncrypted,
    value.accessKeyId,
    value.region,
    value.baseUrl,
    value.temperature,
    value.maxTokens,
  );

  // Invalidate cache (R7.3)
  invalidateCache();

  // Return the saved config (masked)
  return getAiProviderConfig(db);
}

// ---------------------------------------------------------------------------
// deleteAiProviderConfig (R2.4)
// ---------------------------------------------------------------------------

/**
 * Deletes the singleton config row and invalidates cache.
 */
export function deleteAiProviderConfig(db: Database): { status: number; body: unknown } {
  db.prepare("DELETE FROM ai_provider_config WHERE id = 1").run();

  // Invalidate cache (R7.3)
  invalidateCache();

  return { status: 200, body: { configured: false } };
}

// ---------------------------------------------------------------------------
// testAiProviderConnection (R5.1, R5.2, R5.3, R5.4)
// ---------------------------------------------------------------------------

/**
 * Validates the input config and delegates to the connection test module.
 * Returns 200 with `{ ok, model?, errorKind?, message? }`.
 */
export async function testAiProviderConnection(
  input: unknown,
): Promise<{ status: number; body: unknown }> {
  const validation = validateAiProviderConfig(input);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.reason } };
  }

  const result = await testProviderConnection(validation.value);
  return { status: 200, body: result };
}

// ---------------------------------------------------------------------------
// getActiveProviderConfig (R7.1 — internal, NOT exposed via HTTP)
// ---------------------------------------------------------------------------

/**
 * Server-only internal function. Returns the full decrypted config for
 * agent use. NOT exposed via any HTTP endpoint.
 *
 * Uses a simple module-level cache invalidated on save/delete to avoid
 * repeated crypto operations during agent execution loops.
 */
export async function getActiveProviderConfig(
  db: Database,
): Promise<NormalizedAiProviderConfig | null> {
  // Return cached if available
  if (cachedConfig) {
    return cachedConfig.config;
  }

  const row = db
    .query("SELECT * FROM ai_provider_config WHERE id = 1")
    .get() as AiProviderRow | null;

  if (!row) {
    return null;
  }

  // Decrypt secrets
  const apiKey = row.api_key_encrypted ? await decryptApiKey(row.api_key_encrypted) : "";
  const secretAccessKey = row.secret_access_key_encrypted
    ? await decryptApiKey(row.secret_access_key_encrypted)
    : "";

  const config: NormalizedAiProviderConfig = {
    providerId: row.provider_id,
    model: row.model,
    apiKey,
    secretAccessKey,
    accessKeyId: row.access_key_id,
    region: row.region,
    baseUrl: row.base_url,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
  };

  // Cache for future calls
  cachedConfig = { config, timestamp: Date.now() };

  return config;
}

// Re-export invalidateCache for testing purposes
export { invalidateCache as _invalidateCache_forTest };
