import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { connectLinear, disconnectLinear, getLinearStatus } from "./settingsHandlers";
import type { LinearViewer } from "./linearClient";

/**
 * FEAT-005 / T20 — Connect → Disconnect flow.
 *
 * Verifies the full lifecycle:
 *   1. Initially: linear is NOT connected
 *   2. After connectLinear: connected, account populated, lastSyncAt is null,
 *      DB has one row with the encrypted key (NOT the plaintext)
 *   3. After disconnectLinear: connected is false, DB has no row
 *   4. After a second connect: state is replaced (ON CONFLICT), the new
 *      account info is what's stored
 */

function makeTestDb(): Database {
  const db = new Database(":memory:");
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
  `);
  return db;
}

describe("T20 / R5 + R8 — connect → disconnect flow", () => {
  test("initially: not connected", () => {
    const db = makeTestDb();
    const status = getLinearStatus(db);
    expect(status.connected).toBe(false);
    expect(status.account).toBeUndefined();
  });

  test("connect: status updates, DB row created with encrypted (not plaintext) key", async () => {
    const db = makeTestDb();
    const fakeViewer: LinearViewer = { id: "u-1", name: "Ana García", email: "ana@ejemplo.com" };

    const result = await connectLinear(
      db,
      { apiKey: "lin_api_TEST_KEY_REMOVED" },
      { validateApiKey: async () => fakeViewer },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      connected: true,
      account: { id: "u-1", name: "Ana García", email: "ana@ejemplo.com" },
      lastSyncAt: null,
    });

    // The status reflects the new state
    const status = getLinearStatus(db);
    expect(status.connected).toBe(true);
    expect(status.account).toEqual(fakeViewer);
    expect(status.lastSyncAt).toBeNull();

    // The DB row exists and the key is encrypted (NOT the plaintext)
    const row = db
      .query("SELECT * FROM integration_connections WHERE provider = 'linear'")
      .get() as Record<string, unknown> | null;
    expect(row).not.toBeNull();
    expect(row!.api_key_encrypted).not.toBe("lin_api_TEST_KEY_REMOVED");
    expect(String(row!.api_key_encrypted)).not.toContain("lin_api_");
    expect(row!.account_id).toBe("u-1");
    expect(row!.account_name).toBe("Ana García");
    expect(row!.account_email).toBe("ana@ejemplo.com");
  });

  test("disconnect: status flips to false, DB row removed", async () => {
    const db = makeTestDb();
    await connectLinear(
      db,
      { apiKey: "lin_api_TEST_KEY_REMOVED" },
      { validateApiKey: async () => ({ id: "u-2", name: "Test", email: "t@e.com" }) },
    );

    // Sanity: there's a row
    expect(db.query("SELECT COUNT(*) as n FROM integration_connections").get()).toMatchObject({
      n: 1,
    });

    const result = disconnectLinear(db);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ connected: false });

    const status = getLinearStatus(db);
    expect(status.connected).toBe(false);

    expect(db.query("SELECT COUNT(*) as n FROM integration_connections").get()).toMatchObject({
      n: 0,
    });
  });

  test("a second connect replaces the previous connection (ON CONFLICT)", async () => {
    const db = makeTestDb();
    const viewer1: LinearViewer = { id: "u-3", name: "First", email: "f@e.com" };
    const viewer2: LinearViewer = { id: "u-4", name: "Second", email: "s@e.com" };

    await connectLinear(
      db,
      { apiKey: "lin_api_TEST_KEY_REMOVED" },
      { validateApiKey: async () => viewer1 },
    );

    const result2 = await connectLinear(
      db,
      { apiKey: "lin_api_TEST_KEY_REMOVED" },
      { validateApiKey: async () => viewer2 },
    );

    expect(result2.status).toBe(200);
    expect(result2.body).toMatchObject({
      connected: true,
      account: { id: "u-4", name: "Second", email: "s@e.com" },
    });

    // Only ONE row in the table (no duplicate)
    expect(db.query("SELECT COUNT(*) as n FROM integration_connections").get()).toMatchObject({
      n: 1,
    });

    const row = db
      .query("SELECT * FROM integration_connections WHERE provider = 'linear'")
      .get() as Record<string, unknown>;
    expect(row.account_id).toBe("u-4");
    expect(row.account_name).toBe("Second");
  });
});
