/**
 * Handler logic for the MCP Servers registry endpoints.
 *
 * Pattern: same as settingsHandlers.ts — functions receive `db: Database`
 * as first arg, return `{ status: number; body: unknown }`. Thin, testable,
 * imported by server.ts routes.
 *
 * SECURITY: env values are encrypted at rest (R8). They are decrypted ONLY
 * inside `applyMcpConfig` (to write the mcp.json) and internally during
 * listing (to extract keys for masking). The frontend NEVER receives
 * plaintext env values (R9). No env value is ever logged (R10).
 *
 * Covers: R1–R5, R8, R9, R10, R11, R12, R13
 */

import type { Database } from "bun:sqlite";
import { encryptApiKey, decryptApiKey } from "./crypto";
import { validateMcpServer, buildMcpJson, maskEnv, type NormalizedMcpServer } from "./mcpConfig";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface McpServerRow {
  id: number;
  name: string;
  transport: string;
  command: string | null;
  args: string;
  env_encrypted: string;
  url: string | null;
  enabled: number;
  auto_approve: string;
  created_at: string;
  updated_at: string;
}

/**
 * Decrypts the env blob and returns masked env (keys visible, values hidden).
 * Returns empty object if env_encrypted is empty.
 */
async function decryptAndMaskEnv(envEncrypted: string): Promise<Record<string, string>> {
  if (!envEncrypted) return {};
  const decrypted = await decryptApiKey(envEncrypted);
  const parsed = JSON.parse(decrypted) as Record<string, string>;
  return maskEnv(parsed);
}

/**
 * Transforms a DB row into a safe response object (env masked).
 */
async function rowToResponse(row: McpServerRow): Promise<Record<string, unknown>> {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    command: row.command,
    args: JSON.parse(row.args) as string[],
    env: await decryptAndMaskEnv(row.env_encrypted),
    url: row.url,
    enabled: row.enabled === 1,
    autoApprove: JSON.parse(row.auto_approve) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// listMcpServers (R1, R9)
// ---------------------------------------------------------------------------

export async function listMcpServers(db: Database): Promise<{ status: number; body: unknown }> {
  const rows = db.query("SELECT * FROM mcp_servers ORDER BY id").all() as McpServerRow[];
  const servers = await Promise.all(rows.map(rowToResponse));
  return { status: 200, body: servers };
}

// ---------------------------------------------------------------------------
// createMcpServer (R1, R2, R6, R8, R9, R10)
// ---------------------------------------------------------------------------

export async function createMcpServer(
  db: Database,
  input: unknown,
): Promise<{ status: number; body: unknown }> {
  const validation = validateMcpServer(input);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.reason } };
  }

  const value = validation.value;

  // Check name uniqueness (R2)
  const existing = db.query("SELECT id FROM mcp_servers WHERE name = ?").get(value.name) as {
    id: number;
  } | null;
  if (existing) {
    return { status: 409, body: { error: "Ya existe un servidor con ese nombre" } };
  }

  // Encrypt env (R8) — NEVER log env values (R10)
  const envEncrypted =
    Object.keys(value.env).length > 0 ? await encryptApiKey(JSON.stringify(value.env)) : "";

  db.prepare(
    `INSERT INTO mcp_servers (name, transport, command, args, env_encrypted, url, enabled, auto_approve)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    value.name,
    value.transport,
    value.command,
    JSON.stringify(value.args),
    envEncrypted,
    value.url,
    value.enabled ? 1 : 0,
    JSON.stringify(value.autoApprove),
  );

  const created = db
    .query("SELECT * FROM mcp_servers WHERE id = last_insert_rowid()")
    .get() as McpServerRow;

  return { status: 201, body: await rowToResponse(created) };
}

// ---------------------------------------------------------------------------
// updateMcpServer (R3, R6, R8, R9, R10)
// ---------------------------------------------------------------------------

export async function updateMcpServer(
  db: Database,
  id: number,
  input: unknown,
): Promise<{ status: number; body: unknown }> {
  const existing = db
    .query("SELECT * FROM mcp_servers WHERE id = ?")
    .get(id) as McpServerRow | null;
  if (!existing) {
    return { status: 404, body: { error: "Servidor no encontrado" } };
  }

  const validation = validateMcpServer(input);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.reason } };
  }

  const value = validation.value;

  // If env is provided and non-empty, re-encrypt; otherwise keep existing (R19)
  let envEncrypted: string;
  if (Object.keys(value.env).length > 0) {
    envEncrypted = await encryptApiKey(JSON.stringify(value.env));
  } else {
    envEncrypted = existing.env_encrypted;
  }

  db.prepare(
    `UPDATE mcp_servers
       SET name = ?, transport = ?, command = ?, args = ?, env_encrypted = ?,
           url = ?, enabled = ?, auto_approve = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    value.name,
    value.transport,
    value.command,
    JSON.stringify(value.args),
    envEncrypted,
    value.url,
    value.enabled ? 1 : 0,
    JSON.stringify(value.autoApprove),
    id,
  );

  const updated = db.query("SELECT * FROM mcp_servers WHERE id = ?").get(id) as McpServerRow;

  return { status: 200, body: await rowToResponse(updated) };
}

// ---------------------------------------------------------------------------
// toggleMcpServer (R5)
// ---------------------------------------------------------------------------

export async function toggleMcpServer(
  db: Database,
  id: number,
): Promise<{ status: number; body: unknown }> {
  const existing = db
    .query("SELECT * FROM mcp_servers WHERE id = ?")
    .get(id) as McpServerRow | null;
  if (!existing) {
    return { status: 404, body: { error: "Servidor no encontrado" } };
  }

  const newEnabled = existing.enabled === 1 ? 0 : 1;
  db.prepare("UPDATE mcp_servers SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
    newEnabled,
    id,
  );

  const updated = db.query("SELECT * FROM mcp_servers WHERE id = ?").get(id) as McpServerRow;

  return { status: 200, body: await rowToResponse(updated) };
}

// ---------------------------------------------------------------------------
// deleteMcpServer (R4)
// ---------------------------------------------------------------------------

export function deleteMcpServer(db: Database, id: number): { status: number; body: unknown } {
  const result = db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
  if (result.changes === 0) {
    return { status: 404, body: { error: "Servidor no encontrado" } };
  }
  return { status: 200, body: { deleted: true } };
}

// ---------------------------------------------------------------------------
// applyMcpConfig (R8, R10, R11, R12, R13)
// ---------------------------------------------------------------------------

/**
 * Decrypts all env blobs, builds the mcp.json, and writes it to disk.
 * The output directory defaults to `<cwd>/.mcp/` (task-manager/.mcp/).
 * An optional `outputDir` can be passed for testing.
 *
 * NEVER logs env values (R10).
 */
export async function applyMcpConfig(
  db: Database,
  outputDir?: string,
): Promise<{ status: number; body: unknown }> {
  const rows = db.query("SELECT * FROM mcp_servers ORDER BY id").all() as McpServerRow[];

  const servers: NormalizedMcpServer[] = await Promise.all(
    rows.map(async (row) => {
      let env: Record<string, string> = {};
      if (row.env_encrypted) {
        const decrypted = await decryptApiKey(row.env_encrypted);
        env = JSON.parse(decrypted) as Record<string, string>;
      }
      return {
        name: row.name,
        transport: row.transport as "stdio" | "http",
        command: row.command,
        args: JSON.parse(row.args) as string[],
        env,
        url: row.url,
        enabled: row.enabled === 1,
        autoApprove: JSON.parse(row.auto_approve) as string[],
      };
    }),
  );

  const mcpJson = buildMcpJson(servers);

  const dir = outputDir ?? join(process.cwd(), ".mcp");
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, "mcp.json");
  await Bun.write(filePath, JSON.stringify(mcpJson, null, 2));

  return { status: 200, body: { applied: true, serverCount: servers.length } };
}
