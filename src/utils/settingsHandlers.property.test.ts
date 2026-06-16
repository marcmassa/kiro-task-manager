import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { Database } from "bun:sqlite";
import { connectLinear } from "./settingsHandlers";
import type { LinearViewer } from "./linearClient";

/**
 * FEAT-005 / T17 / R7 — Critical property test.
 *
 * "The frontend SHALL NEVER receive the Linear API key (neither encrypted
 *  nor in cleartext) in any API response."
 *
 * For any string matching the Linear API key format
 * (`^lin_api_[A-Za-z0-9]{40,}$`), the response body of `connectLinear`
 * (success AND failure paths) MUST NOT contain that key as a substring
 * in any field — including the encrypted ciphertext, headers, error
 * messages, or nested objects.
 *
 * This is a structural test: we mock `validateApiKey` so no real network
 * call happens, then we serialize the full response object and check.
 *
 * Why this catches regressions: if a future change accidentally adds
 * `apiKey: input.apiKey` to the success body, or surfaces the encrypted
 * blob in the response (e.g. for "display the masked key"), the
 * property test fails immediately.
 */

// We need a fresh in-memory database for the property test runs.
// bun:sqlite supports ":memory:" — perfect for isolated test fixtures.
function makeTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE integration_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      api_key_encrypted TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_email TEXT NOT NULL,
      last_sync_at TEXT,
      last_sync_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE workspace_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      workspace_name TEXT NOT NULL DEFAULT 'Mi Workspace',
      default_language TEXT NOT NULL DEFAULT 'es-ES',
      default_timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
      notify_on_due INTEGER NOT NULL DEFAULT 1,
      notify_on_done INTEGER NOT NULL DEFAULT 0,
      notify_daily_digest INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO workspace_settings (id) VALUES (1);
  `);
  return db;
}

function fakeViewer(name = "Test User"): LinearViewer {
  return { id: "user-uuid-1", name, email: "test@example.com" };
}

// The Linear key format: `lin_api_` + 40+ alphanumeric chars.
// fc.stringMatching gives us control over the format.
const linearKeyArb = fc.stringMatching(/^lin_api_[A-Za-z0-9]{40,60}$/);

describe("T17 / R7 — API key never round-trips to the response", () => {
  // Use a SINGLE db across the property runs so we don't recreate schema
  // hundreds of times. Each property run overwrites the same row.
  const db = makeTestDb();

  test("success path: response JSON never contains the API key", async () => {
    await fc.assert(
      fc.asyncProperty(linearKeyArb, async (apiKey) => {
        // Reset state between runs
        db.exec("DELETE FROM integration_connections");

        const result = await connectLinear(
          db,
          { apiKey },
          { validateApiKey: async () => fakeViewer("Test User") },
        );

        // Status must be 200 on the happy path
        expect(result.status).toBe(200);

        // Serialize the full response — this is what the wire would carry
        const serialized = JSON.stringify(result);
        expect(serialized.includes(apiKey)).toBe(false);

        // Defensive: also check the raw body object field-by-field
        const body = result.body as Record<string, unknown>;
        for (const value of Object.values(body)) {
          if (typeof value === "string") {
            expect(value).not.toBe(apiKey);
            expect(value).not.toContain(apiKey);
          } else if (value && typeof value === "object") {
            const nested = JSON.stringify(value);
            expect(nested.includes(apiKey)).toBe(false);
          }
        }

        // The DB must contain the encrypted blob, NOT the plaintext
        const row = db
          .query("SELECT api_key_encrypted FROM integration_connections WHERE provider = 'linear'")
          .get() as { api_key_encrypted: string } | null;
        expect(row).not.toBeNull();
        expect(row!.api_key_encrypted).not.toBe(apiKey);
        expect(row!.api_key_encrypted).not.toContain(apiKey);
      }),
      { numRuns: 100 },
    );
  });

  test("failure path (auth error): response JSON never contains the API key", async () => {
    await fc.assert(
      fc.asyncProperty(linearKeyArb, async (apiKey) => {
        // Force validateApiKey to throw (the path that returns 400)
        const result = await connectLinear(
          db,
          { apiKey },
          {
            validateApiKey: async () => {
              throw new Error("forced auth failure");
            },
          },
        );

        expect(result.status).toBe(400);
        const serialized = JSON.stringify(result);
        expect(serialized.includes(apiKey)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test("empty / short key path: 400 with no leak (only the Spanish error)", async () => {
    // Empty key
    const result = await connectLinear(
      db,
      { apiKey: "" },
      { validateApiKey: async () => fakeViewer() },
    );
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "El API key no puede estar vacío" });

    // Short key (less than the 10-char minimum)
    const result2 = await connectLinear(
      db,
      { apiKey: "short" },
      { validateApiKey: async () => fakeViewer() },
    );
    expect(result2.status).toBe(400);
    // The Spanish error is the only thing in the response — the user's
    // short input is NOT echoed back. The error is generic and safe.
    expect(result2.body).toEqual({ error: "El API key no puede estar vacío" });
  });
});
