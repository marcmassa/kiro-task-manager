import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMcpServer,
  listMcpServers,
  toggleMcpServer,
  deleteMcpServer,
  applyMcpConfig,
} from "./mcpHandlers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE mcp_servers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      transport     TEXT NOT NULL DEFAULT 'stdio'
                    CHECK (transport IN ('stdio','http')),
      command       TEXT,
      args          TEXT NOT NULL DEFAULT '[]',
      env_encrypted TEXT NOT NULL DEFAULT '',
      url           TEXT,
      enabled       INTEGER NOT NULL DEFAULT 1,
      auto_approve  TEXT NOT NULL DEFAULT '[]',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

const VALID_STDIO_INPUT = {
  name: "filesystem",
  transport: "stdio" as const,
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem"],
  env: { API_KEY: "secret-value-123" },
};

const VALID_HTTP_INPUT = {
  name: "remote-api",
  transport: "http" as const,
  url: "https://mcp.example.com/sse",
  env: { TOKEN: "my-http-secret" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mcpHandlers — integration (DB :memory:)", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  // -------------------------------------------------------------------------
  // 1. createMcpServer — valid input (R1, R8, R9)
  // -------------------------------------------------------------------------

  describe("createMcpServer — alta válida (R1, R8, R9)", () => {
    test("retorna status 201 con datos del servidor", async () => {
      const result = await createMcpServer(db, VALID_STDIO_INPUT);
      expect(result.status).toBe(201);

      const body = result.body as Record<string, unknown>;
      expect(body.name).toBe("filesystem");
      expect(body.transport).toBe("stdio");
      expect(body.command).toBe("npx");
      expect(body.enabled).toBe(true);
    });

    test("env enmascarado en la respuesta (R9)", async () => {
      const result = await createMcpServer(db, VALID_STDIO_INPUT);
      const body = result.body as Record<string, unknown>;
      const env = body.env as Record<string, string>;

      // All values must be masked
      expect(env.API_KEY).toBe("••••••••");
      // Must NOT contain the original secret
      expect(env.API_KEY).not.toBe("secret-value-123");
    });

    test("env_encrypted en la DB NO es el JSON original (R8)", async () => {
      await createMcpServer(db, VALID_STDIO_INPUT);

      const row = db
        .query("SELECT env_encrypted FROM mcp_servers WHERE name = ?")
        .get("filesystem") as { env_encrypted: string };

      // The stored value must not be the plaintext JSON
      expect(row.env_encrypted).not.toBe(JSON.stringify({ API_KEY: "secret-value-123" }));
      // It must not be empty either (there IS env data)
      expect(row.env_encrypted.length).toBeGreaterThan(0);
      // It must not contain the literal secret
      expect(row.env_encrypted).not.toContain("secret-value-123");
    });
  });

  // -------------------------------------------------------------------------
  // 2. createMcpServer — duplicate name rejected (R2)
  // -------------------------------------------------------------------------

  describe("createMcpServer — nombre duplicado rechazado (R2)", () => {
    test("retorna 409 al crear con nombre ya existente", async () => {
      const first = await createMcpServer(db, { ...VALID_STDIO_INPUT, name: "test-server" });
      expect(first.status).toBe(201);

      const second = await createMcpServer(db, { ...VALID_STDIO_INPUT, name: "test-server" });
      expect(second.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // 3. createMcpServer — invalid input rejected (R6)
  // -------------------------------------------------------------------------

  describe("createMcpServer — input inválido rechazado (R6)", () => {
    test("nombre vacío → 400 con razón en español", async () => {
      const result = await createMcpServer(db, {
        name: "",
        transport: "stdio",
        command: "node",
      });
      expect(result.status).toBe(400);
      const body = result.body as { error: string };
      expect(body.error).toContain("nombre");
    });

    test("stdio sin command → 400 con razón en español", async () => {
      const result = await createMcpServer(db, {
        name: "invalid-server",
        transport: "stdio",
      });
      expect(result.status).toBe(400);
      const body = result.body as { error: string };
      expect(body.error).toContain("comando");
    });
  });

  // -------------------------------------------------------------------------
  // 4. toggleMcpServer (R5)
  // -------------------------------------------------------------------------

  describe("toggleMcpServer (R5)", () => {
    test("alterna enabled de true a false y luego a true", async () => {
      const created = await createMcpServer(db, VALID_STDIO_INPUT);
      const id = (created.body as Record<string, unknown>).id as number;

      // Initially enabled=true → toggle → should be false
      const toggle1 = await toggleMcpServer(db, id);
      expect(toggle1.status).toBe(200);
      expect((toggle1.body as Record<string, unknown>).enabled).toBe(false);

      // Toggle again → should be true
      const toggle2 = await toggleMcpServer(db, id);
      expect(toggle2.status).toBe(200);
      expect((toggle2.body as Record<string, unknown>).enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. deleteMcpServer (R4)
  // -------------------------------------------------------------------------

  describe("deleteMcpServer (R4)", () => {
    test("elimina servidor existente → 200", async () => {
      const created = await createMcpServer(db, VALID_STDIO_INPUT);
      const id = (created.body as Record<string, unknown>).id as number;

      const result = deleteMcpServer(db, id);
      expect(result.status).toBe(200);
      expect((result.body as Record<string, unknown>).deleted).toBe(true);
    });

    test("eliminar de nuevo el mismo id → 404", async () => {
      const created = await createMcpServer(db, VALID_STDIO_INPUT);
      const id = (created.body as Record<string, unknown>).id as number;

      deleteMcpServer(db, id);
      const result = deleteMcpServer(db, id);
      expect(result.status).toBe(404);
    });

    test("el servidor desaparece de la DB tras eliminar", async () => {
      const created = await createMcpServer(db, VALID_STDIO_INPUT);
      const id = (created.body as Record<string, unknown>).id as number;

      deleteMcpServer(db, id);

      const row = db.query("SELECT * FROM mcp_servers WHERE id = ?").get(id);
      expect(row).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6. applyMcpConfig — writes correct mcp.json (R11, R12, R13)
  // -------------------------------------------------------------------------

  describe("applyMcpConfig — escribe mcp.json correcto (R11, R12, R13)", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    test("genera mcp.json con estructura correcta para stdio y http", async () => {
      // Create one enabled stdio server
      await createMcpServer(db, VALID_STDIO_INPUT);
      // Create one disabled http server
      await createMcpServer(db, { ...VALID_HTTP_INPUT, enabled: false });

      const result = await applyMcpConfig(db, tmpDir);
      expect(result.status).toBe(200);

      const filePath = join(tmpDir, "mcp.json");
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      // Has mcpServers key
      expect(content.mcpServers).toBeDefined();

      // Both servers are present
      expect(content.mcpServers["filesystem"]).toBeDefined();
      expect(content.mcpServers["remote-api"]).toBeDefined();
    });

    test("disabled server tiene disabled: true, enabled tiene disabled: false (R12)", async () => {
      await createMcpServer(db, VALID_STDIO_INPUT); // enabled by default
      await createMcpServer(db, { ...VALID_HTTP_INPUT, enabled: false });

      await applyMcpConfig(db, tmpDir);

      const filePath = join(tmpDir, "mcp.json");
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      expect(content.mcpServers["filesystem"].disabled).toBe(false);
      expect(content.mcpServers["remote-api"].disabled).toBe(true);
    });

    test("stdio server tiene command, args y env descifrado", async () => {
      await createMcpServer(db, VALID_STDIO_INPUT);
      await applyMcpConfig(db, tmpDir);

      const filePath = join(tmpDir, "mcp.json");
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      const entry = content.mcpServers["filesystem"];
      expect(entry.command).toBe("npx");
      expect(entry.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem"]);
      // env must be DECRYPTED (plaintext) in the mcp.json
      expect(entry.env).toEqual({ API_KEY: "secret-value-123" });
    });

    test("http server tiene url", async () => {
      await createMcpServer(db, VALID_HTTP_INPUT);
      await applyMcpConfig(db, tmpDir);

      const filePath = join(tmpDir, "mcp.json");
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      const entry = content.mcpServers["remote-api"];
      expect(entry.url).toBe("https://mcp.example.com/sse");
    });
  });

  // -------------------------------------------------------------------------
  // 7. No secrets in logs (R10)
  // -------------------------------------------------------------------------

  describe("No se filtran secretos en logs (R10)", () => {
    test("console.log/error nunca contiene el secreto de env", async () => {
      const SECRET = "super-secret-token-xyz-999";
      const logOutput: string[] = [];

      // Intercept console
      const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logOutput.push(args.map(String).join(" "));
      });
      const errorSpy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        logOutput.push(args.map(String).join(" "));
      });
      const warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        logOutput.push(args.map(String).join(" "));
      });

      try {
        // Perform all handler operations
        await createMcpServer(db, {
          name: "secret-test",
          transport: "stdio",
          command: "node",
          env: { MY_SECRET: SECRET },
        });

        await listMcpServers(db);

        const row = db.query("SELECT id FROM mcp_servers WHERE name = ?").get("secret-test") as {
          id: number;
        };
        await toggleMcpServer(db, row.id);
        deleteMcpServer(db, row.id);

        // Verify no log output contains the secret
        const allLogs = logOutput.join("\n");
        expect(allLogs).not.toContain(SECRET);
      } finally {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
      }
    });
  });
});
