import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  getAiProviderConfig,
  saveAiProviderConfig,
  deleteAiProviderConfig,
  getActiveProviderConfig,
  _invalidateCache_forTest,
} from "./aiProviderHandlers";
import { decryptApiKey } from "./crypto";

// ---------------------------------------------------------------------------
// Test DB setup (in-memory)
// ---------------------------------------------------------------------------

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE ai_provider_config (
      id                          INTEGER PRIMARY KEY CHECK (id = 1),
      provider_id                 TEXT NOT NULL,
      model                       TEXT NOT NULL,
      api_key_encrypted           TEXT NOT NULL DEFAULT '',
      secret_access_key_encrypted TEXT NOT NULL DEFAULT '',
      access_key_id               TEXT NOT NULL DEFAULT '',
      region                      TEXT NOT NULL DEFAULT '',
      base_url                    TEXT NOT NULL DEFAULT '',
      temperature                 REAL NOT NULL DEFAULT 0.7,
      max_tokens                  INTEGER NOT NULL DEFAULT 4096,
      created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

let db: Database;

beforeEach(() => {
  db = createTestDb();
  _invalidateCache_forTest();
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Test 1: Singleton invariant (Property 6 / R2.2)
// ---------------------------------------------------------------------------

describe("Singleton invariant (Property 6 / R2.2)", () => {
  test("saving twice results in only one row in the DB", async () => {
    // First save: OpenAI config
    await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "gpt-4o",
      apiKey: "sk-first-key-1234567890",
    });

    // Second save: Anthropic config (replaces OpenAI)
    await saveAiProviderConfig(db, {
      providerId: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "sk-second-key-abcdefgh",
    });

    // Verify only one row exists
    const count = db.query("SELECT COUNT(*) as cnt FROM ai_provider_config").get() as {
      cnt: number;
    };
    expect(count.cnt).toBe(1);

    // Verify it's the second config (Anthropic)
    const row = db.query("SELECT provider_id FROM ai_provider_config WHERE id = 1").get() as {
      provider_id: string;
    };
    expect(row.provider_id).toBe("anthropic");
  });
});

// ---------------------------------------------------------------------------
// Test 2: API key masking (Property 7 / R2.3, R6.2)
// ---------------------------------------------------------------------------

describe("API key masking (Property 7 / R2.3, R6.2)", () => {
  test("GET returns masked apiKey that differs from plaintext and follows mask pattern", async () => {
    const plaintext = "sk-1234567890abcdef";

    await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "gpt-4o",
      apiKey: plaintext,
    });

    const result = await getAiProviderConfig(db);
    const body = result.body as { configured: boolean; apiKeyMasked: string };

    expect(body.configured).toBe(true);
    // Masked value must NOT equal plaintext
    expect(body.apiKeyMasked).not.toBe(plaintext);
    // Must start with first 4 chars of key
    expect(body.apiKeyMasked.startsWith("sk-1")).toBe(true);
    // Must end with last 4 chars of key
    expect(body.apiKeyMasked.endsWith("cdef")).toBe(true);
    // Must contain the mask characters
    expect(body.apiKeyMasked).toContain("••••");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Encryption at rest (Property 9 / R6.1)
// ---------------------------------------------------------------------------

describe("Encryption at rest (Property 9 / R6.1)", () => {
  test("raw api_key_encrypted column is NOT plaintext and decrypts back to original", async () => {
    const plaintext = "sk-super-secret-key-xyz789";

    await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "gpt-4o",
      apiKey: plaintext,
    });

    // Read the raw encrypted value from DB
    const row = db.query("SELECT api_key_encrypted FROM ai_provider_config WHERE id = 1").get() as {
      api_key_encrypted: string;
    };

    // The encrypted value must NOT equal the plaintext
    expect(row.api_key_encrypted).not.toBe(plaintext);
    expect(row.api_key_encrypted.length).toBeGreaterThan(0);

    // Decrypt it and verify round-trip
    const decrypted = await decryptApiKey(row.api_key_encrypted);
    expect(decrypted).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Error message safety (Property 8 / R5.3, R6.4)
// ---------------------------------------------------------------------------

describe("Error message safety (Property 8 / R5.3, R6.4)", () => {
  test("400 error message does NOT contain the API key value", async () => {
    const sensitiveKey = "sk-SUPER-SECRET-DO-NOT-LEAK";

    // Send an invalid config: missing model (required field) but with an API key
    const result = await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "", // empty model triggers validation failure
      apiKey: sensitiveKey,
    });

    expect(result.status).toBe(400);
    const body = result.body as { error: string };
    // The error message must NOT contain the API key
    expect(body.error).not.toContain(sensitiveKey);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Delete clears config (R2.4)
// ---------------------------------------------------------------------------

describe("Delete clears config (R2.4)", () => {
  test("save config, delete, GET returns { configured: false }", async () => {
    // Save a config
    await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "gpt-4o",
      apiKey: "sk-to-be-deleted-1234",
    });

    // Verify it's there
    const before = await getAiProviderConfig(db);
    expect((before.body as { configured: boolean }).configured).toBe(true);

    // Delete
    const delResult = deleteAiProviderConfig(db);
    expect(delResult.status).toBe(200);
    expect((delResult.body as { configured: boolean }).configured).toBe(false);

    // GET should now return unconfigured
    const after = await getAiProviderConfig(db);
    expect((after.body as { configured: boolean }).configured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Cache invalidation (R7.3)
// ---------------------------------------------------------------------------

describe("Cache invalidation (R7.3)", () => {
  test("save/delete invalidates cache so getActiveProviderConfig returns fresh data", async () => {
    // Save first config
    await saveAiProviderConfig(db, {
      providerId: "openai",
      model: "gpt-4o",
      apiKey: "sk-first-cache-test-key",
    });

    // Populate cache by calling getActiveProviderConfig
    const first = await getActiveProviderConfig(db);
    expect(first).not.toBeNull();
    expect(first!.providerId).toBe("openai");
    expect(first!.model).toBe("gpt-4o");

    // Save DIFFERENT config (this should invalidate cache)
    await saveAiProviderConfig(db, {
      providerId: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "sk-second-cache-test-key",
    });

    // getActiveProviderConfig should now return the NEW config
    const second = await getActiveProviderConfig(db);
    expect(second).not.toBeNull();
    expect(second!.providerId).toBe("anthropic");
    expect(second!.model).toBe("claude-sonnet-4-20250514");
  });
});

// ---------------------------------------------------------------------------
// Test 7: Config for Bedrock (R3.2)
// ---------------------------------------------------------------------------

describe("Config for Bedrock (R3.2)", () => {
  test("saves and retrieves region + accessKeyId + encrypted secret", async () => {
    const region = "us-west-2";
    const accessKeyId = "AKIAIOSFODNN7EXAMPLE";
    const secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

    await saveAiProviderConfig(db, {
      providerId: "bedrock",
      model: "anthropic.claude-sonnet-4-20250514-v1:0",
      region,
      accessKeyId,
      secretAccessKey,
    });

    // GET should show config with region and accessKeyId (non-secret)
    const getResult = await getAiProviderConfig(db);
    const body = getResult.body as {
      configured: boolean;
      providerId: string;
      region: string;
      accessKeyId: string;
    };
    expect(body.configured).toBe(true);
    expect(body.providerId).toBe("bedrock");
    expect(body.region).toBe(region);
    expect(body.accessKeyId).toBe(accessKeyId);

    // Verify secret_access_key_encrypted is encrypted (not plaintext)
    const row = db
      .query("SELECT secret_access_key_encrypted FROM ai_provider_config WHERE id = 1")
      .get() as { secret_access_key_encrypted: string };
    expect(row.secret_access_key_encrypted).not.toBe(secretAccessKey);
    expect(row.secret_access_key_encrypted.length).toBeGreaterThan(0);

    // getActiveProviderConfig decrypts everything
    const active = await getActiveProviderConfig(db);
    expect(active).not.toBeNull();
    expect(active!.region).toBe(region);
    expect(active!.accessKeyId).toBe(accessKeyId);
    expect(active!.secretAccessKey).toBe(secretAccessKey);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Config for Ollama (R3.3)
// ---------------------------------------------------------------------------

describe("Config for Ollama (R3.3)", () => {
  test("saves and retrieves baseUrl without apiKey", async () => {
    const baseUrl = "http://localhost:11434";

    await saveAiProviderConfig(db, {
      providerId: "ollama",
      model: "llama3.1",
      baseUrl,
    });

    // GET should show configured with empty masked key
    const getResult = await getAiProviderConfig(db);
    const body = getResult.body as {
      configured: boolean;
      providerId: string;
      baseUrl: string;
      apiKeyMasked: string;
    };
    expect(body.configured).toBe(true);
    expect(body.providerId).toBe("ollama");
    expect(body.baseUrl).toBe(baseUrl);
    // No API key means empty mask
    expect(body.apiKeyMasked).toBe("");

    // getActiveProviderConfig returns baseUrl
    const active = await getActiveProviderConfig(db);
    expect(active).not.toBeNull();
    expect(active!.baseUrl).toBe(baseUrl);
    expect(active!.apiKey).toBe("");
  });
});
