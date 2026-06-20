import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { validateMcpServer, buildMcpJson, maskEnv, type NormalizedMcpServer } from "./mcpConfig";

// ---------------------------------------------------------------------------
// Arbitrary generators
// ---------------------------------------------------------------------------

function arbitraryNormalizedServer(): fc.Arbitrary<NormalizedMcpServer> {
  return fc.oneof(arbitraryStdioServer(), arbitraryHttpServer());
}

function arbitraryStdioServer(): fc.Arbitrary<NormalizedMcpServer> {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    transport: fc.constant("stdio" as const),
    command: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    args: fc.array(fc.string(), { maxLength: 5 }),
    env: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[A-Za-z_]\w*$/.test(s)),
      fc.string({ minLength: 1, maxLength: 20 }),
      { maxKeys: 3 },
    ),
    url: fc.constant(null),
    enabled: fc.boolean(),
    autoApprove: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 4 }),
  });
}

function arbitraryHttpServer(): fc.Arbitrary<NormalizedMcpServer> {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    transport: fc.constant("http" as const),
    command: fc.constant(null),
    args: fc.array(fc.string(), { maxLength: 5 }),
    env: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[A-Za-z_]\w*$/.test(s)),
      fc.string({ minLength: 1, maxLength: 20 }),
      { maxKeys: 3 },
    ),
    url: fc.webUrl(),
    enabled: fc.boolean(),
    autoApprove: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 4 }),
  });
}

function arbitraryEnvObject(): fc.Arbitrary<Record<string, string>> {
  return fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[A-Za-z_]\w*$/.test(s)),
    fc.string({ minLength: 1, maxLength: 30 }),
    { minKeys: 1, maxKeys: 6 },
  );
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe("Property-Based Tests — mcpConfig", () => {
  // -------------------------------------------------------------------------
  // P1 — buildMcpJson invariants
  // Validates: Requirements R11, R12, R14
  // -------------------------------------------------------------------------

  test("P1.1 – buildMcpJson: ∀ servers, cada name aparece como clave en el resultado", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryNormalizedServer(), { maxLength: 10 }).filter((servers) => {
          // Ensure unique names (buildMcpJson uses name as key)
          const names = servers.map((s) => s.name);
          return new Set(names).size === names.length;
        }),
        (servers) => {
          const result = buildMcpJson(servers);
          for (const server of servers) {
            expect(server.name in result.mcpServers).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P1.2 – buildMcpJson: ∀ server, disabled === !enabled (R12)", () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryNormalizedServer(), { maxLength: 10 }).filter((servers) => {
          const names = servers.map((s) => s.name);
          return new Set(names).size === names.length;
        }),
        (servers) => {
          const result = buildMcpJson(servers);
          for (const server of servers) {
            expect(result.mcpServers[server.name].disabled).toBe(!server.enabled);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P1.3 – buildMcpJson: stdio servers producen command y args", () => {
    fc.assert(
      fc.property(arbitraryStdioServer(), (server) => {
        const result = buildMcpJson([server]);
        const entry = result.mcpServers[server.name];
        expect(entry.command).toBe(server.command!);
        expect(entry.args).toEqual(server.args);
      }),
      { numRuns: 100 },
    );
  });

  test("P1.4 – buildMcpJson: http servers producen url", () => {
    fc.assert(
      fc.property(arbitraryHttpServer(), (server) => {
        const result = buildMcpJson([server]);
        const entry = result.mcpServers[server.name];
        expect(entry.url).toBe(server.url!);
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // P2 — validateMcpServer properties
  // Validates: Requirements R6, R7
  // -------------------------------------------------------------------------

  test("P2.1 – validateMcpServer rechaza name vacío o ausente", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ transport: "stdio", command: "node" }),
          fc.constant({ name: "", transport: "stdio", command: "node" }),
          fc.constant({ name: "   ", transport: "stdio", command: "node" }),
        ),
        (input) => {
          const result = validateMcpServer(input);
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.2 – validateMcpServer rechaza transport inválido", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s !== "stdio" && s !== "http"),
        (transport) => {
          const result = validateMcpServer({ name: "test", transport, command: "node" });
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.3 – validateMcpServer rechaza stdio sin command", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ name: "test", transport: "stdio" }),
          fc.constant({ name: "test", transport: "stdio", command: "" }),
          fc.constant({ name: "test", transport: "stdio", command: "   " }),
        ),
        (input) => {
          const result = validateMcpServer(input);
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.4 – validateMcpServer rechaza http sin url", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ name: "test", transport: "http" }),
          fc.constant({ name: "test", transport: "http", url: "" }),
          fc.constant({ name: "test", transport: "http", url: "   " }),
        ),
        (input) => {
          const result = validateMcpServer(input);
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.5 – validateMcpServer rechaza args que no es array", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant({}), fc.boolean()), (args) => {
        const result = validateMcpServer({
          name: "test",
          transport: "stdio",
          command: "node",
          args,
        });
        expect(result.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test("P2.6 – validateMcpServer rechaza env que no es objeto", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant([]), fc.boolean()), (env) => {
        const result = validateMcpServer({
          name: "test",
          transport: "stdio",
          command: "node",
          env,
        });
        expect(result.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test("P2.7 – validateMcpServer rechaza autoApprove que no es array", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.constant({}), fc.boolean()),
        (autoApprove) => {
          const result = validateMcpServer({
            name: "test",
            transport: "stdio",
            command: "node",
            autoApprove,
          });
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.8 – validateMcpServer acepta configs stdio válidas", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          transport: fc.constant("stdio" as const),
          command: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          args: fc.array(fc.string(), { maxLength: 3 }),
          env: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[A-Za-z_]\w*$/.test(s)),
            fc.string({ maxLength: 20 }),
            { maxKeys: 3 },
          ),
          autoApprove: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
        }),
        (input) => {
          const result = validateMcpServer(input);
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("P2.9 – validateMcpServer acepta configs http válidas", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          transport: fc.constant("http" as const),
          url: fc.webUrl(),
          env: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[A-Za-z_]\w*$/.test(s)),
            fc.string({ maxLength: 20 }),
            { maxKeys: 3 },
          ),
          autoApprove: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
        }),
        (input) => {
          const result = validateMcpServer(input);
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // P3 — maskEnv invariants
  // Validates: Requirements R9
  // -------------------------------------------------------------------------

  test("P3.1 – maskEnv: ningún valor original sobrevive", () => {
    fc.assert(
      fc.property(arbitraryEnvObject(), (env) => {
        const masked = maskEnv(env);
        for (const key of Object.keys(env)) {
          expect(masked[key]).not.toBe(env[key]);
        }
      }),
      { numRuns: 100 },
    );
  });

  test("P3.2 – maskEnv: las claves se preservan (mismo set de claves)", () => {
    fc.assert(
      fc.property(arbitraryEnvObject(), (env) => {
        const masked = maskEnv(env);
        const inputKeys = Object.keys(env).sort();
        const outputKeys = Object.keys(masked).sort();
        expect(outputKeys).toEqual(inputKeys);
      }),
      { numRuns: 100 },
    );
  });

  test('P3.3 – maskEnv: todos los valores de salida son "••••••••"', () => {
    fc.assert(
      fc.property(arbitraryEnvObject(), (env) => {
        const masked = maskEnv(env);
        for (const value of Object.values(masked)) {
          expect(value).toBe("••••••••");
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — validateMcpServer (cada regla de validación R6)
// ---------------------------------------------------------------------------

describe("Unit Tests — validateMcpServer (R6)", () => {
  test("rechaza null/undefined/no-objeto", () => {
    expect(validateMcpServer(null)).toEqual({
      ok: false,
      reason: "La configuración debe ser un objeto",
    });
    expect(validateMcpServer(undefined)).toEqual({
      ok: false,
      reason: "La configuración debe ser un objeto",
    });
    expect(validateMcpServer("string")).toEqual({
      ok: false,
      reason: "La configuración debe ser un objeto",
    });
    expect(validateMcpServer([])).toEqual({
      ok: false,
      reason: "La configuración debe ser un objeto",
    });
  });

  test("rechaza name vacío", () => {
    const result = validateMcpServer({ name: "", transport: "stdio", command: "node" });
    expect(result).toEqual({
      ok: false,
      reason: "El nombre es obligatorio y debe ser una cadena no vacía",
    });
  });

  test("rechaza name ausente", () => {
    const result = validateMcpServer({ transport: "stdio", command: "node" });
    expect(result).toEqual({
      ok: false,
      reason: "El nombre es obligatorio y debe ser una cadena no vacía",
    });
  });

  test("rechaza name que es solo espacios", () => {
    const result = validateMcpServer({ name: "   ", transport: "stdio", command: "node" });
    expect(result).toEqual({
      ok: false,
      reason: "El nombre es obligatorio y debe ser una cadena no vacía",
    });
  });

  test('rechaza transport distinto de "stdio"/"http"', () => {
    const result = validateMcpServer({ name: "test", transport: "grpc", command: "node" });
    expect(result).toEqual({
      ok: false,
      reason: 'El transporte debe ser "stdio" o "http"',
    });
  });

  test("rechaza transport ausente", () => {
    const result = validateMcpServer({ name: "test", command: "node" });
    expect(result).toEqual({
      ok: false,
      reason: 'El transporte debe ser "stdio" o "http"',
    });
  });

  test("rechaza stdio sin command", () => {
    const result = validateMcpServer({ name: "test", transport: "stdio" });
    expect(result).toEqual({
      ok: false,
      reason: "El comando es obligatorio para transporte stdio",
    });
  });

  test("rechaza stdio con command vacío", () => {
    const result = validateMcpServer({ name: "test", transport: "stdio", command: "" });
    expect(result).toEqual({
      ok: false,
      reason: "El comando es obligatorio para transporte stdio",
    });
  });

  test("rechaza http sin url", () => {
    const result = validateMcpServer({ name: "test", transport: "http" });
    expect(result).toEqual({
      ok: false,
      reason: "La URL es obligatoria para transporte http",
    });
  });

  test("rechaza http con url vacía", () => {
    const result = validateMcpServer({ name: "test", transport: "http", url: "" });
    expect(result).toEqual({
      ok: false,
      reason: "La URL es obligatoria para transporte http",
    });
  });

  test("rechaza args que no es array", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      args: "not-array",
    });
    expect(result).toEqual({
      ok: false,
      reason: "Los argumentos deben ser un array de cadenas",
    });
  });

  test("rechaza args con elementos no-string", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      args: ["valid", 123],
    });
    expect(result).toEqual({
      ok: false,
      reason: "Los argumentos deben ser un array de cadenas",
    });
  });

  test("rechaza env que no es objeto (array)", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      env: ["KEY=VALUE"],
    });
    expect(result).toEqual({
      ok: false,
      reason: "Las variables de entorno deben ser un objeto con valores de cadena",
    });
  });

  test("rechaza env con valores no-string", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      env: { TOKEN: 12345 },
    });
    expect(result).toEqual({
      ok: false,
      reason: "Las variables de entorno deben ser un objeto con valores de cadena",
    });
  });

  test("rechaza autoApprove que no es array", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      autoApprove: "read",
    });
    expect(result).toEqual({
      ok: false,
      reason: "autoApprove debe ser un array de cadenas",
    });
  });

  test("rechaza autoApprove con elementos no-string", () => {
    const result = validateMcpServer({
      name: "test",
      transport: "stdio",
      command: "node",
      autoApprove: ["read", 42],
    });
    expect(result).toEqual({
      ok: false,
      reason: "autoApprove debe ser un array de cadenas",
    });
  });

  test("acepta config stdio válida completa", () => {
    const result = validateMcpServer({
      name: "filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@mcp/filesystem"],
      env: { HOME: "/home/user" },
      enabled: true,
      autoApprove: ["read_file", "list_directory"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("filesystem");
      expect(result.value.transport).toBe("stdio");
      expect(result.value.command).toBe("npx");
      expect(result.value.args).toEqual(["-y", "@mcp/filesystem"]);
      expect(result.value.env).toEqual({ HOME: "/home/user" });
      expect(result.value.enabled).toBe(true);
      expect(result.value.autoApprove).toEqual(["read_file", "list_directory"]);
    }
  });

  test("acepta config http válida completa", () => {
    const result = validateMcpServer({
      name: "remote-api",
      transport: "http",
      url: "https://mcp.example.com/api",
      env: { API_KEY: "sk-123" },
      enabled: false,
      autoApprove: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("remote-api");
      expect(result.value.transport).toBe("http");
      expect(result.value.url).toBe("https://mcp.example.com/api");
      expect(result.value.enabled).toBe(false);
    }
  });

  test("normaliza campos opcionales ausentes con valores por defecto", () => {
    const result = validateMcpServer({
      name: "minimal",
      transport: "stdio",
      command: "node",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.args).toEqual([]);
      expect(result.value.env).toEqual({});
      expect(result.value.enabled).toBe(true);
      expect(result.value.autoApprove).toEqual([]);
      expect(result.value.url).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — buildMcpJson
// ---------------------------------------------------------------------------

describe("Unit Tests — buildMcpJson", () => {
  test("genera objeto vacío para array vacío", () => {
    const result = buildMcpJson([]);
    expect(result).toEqual({ mcpServers: {} });
  });

  test("genera entry stdio con command, args, env", () => {
    const server: NormalizedMcpServer = {
      name: "fs",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@mcp/fs"],
      env: { TOKEN: "secret" },
      url: null,
      enabled: true,
      autoApprove: ["read"],
    };
    const result = buildMcpJson([server]);
    expect(result.mcpServers["fs"]).toEqual({
      command: "npx",
      args: ["-y", "@mcp/fs"],
      env: { TOKEN: "secret" },
      disabled: false,
      autoApprove: ["read"],
    });
  });

  test("genera entry http con url", () => {
    const server: NormalizedMcpServer = {
      name: "remote",
      transport: "http",
      command: null,
      args: [],
      env: {},
      url: "https://mcp.example.com",
      enabled: false,
      autoApprove: [],
    };
    const result = buildMcpJson([server]);
    expect(result.mcpServers["remote"]).toEqual({
      url: "https://mcp.example.com",
      disabled: true,
    });
  });

  test("omite autoApprove cuando es array vacío", () => {
    const server: NormalizedMcpServer = {
      name: "test",
      transport: "stdio",
      command: "cmd",
      args: [],
      env: {},
      url: null,
      enabled: true,
      autoApprove: [],
    };
    const result = buildMcpJson([server]);
    expect(result.mcpServers["test"].autoApprove).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — maskEnv
// ---------------------------------------------------------------------------

describe("Unit Tests — maskEnv", () => {
  test("enmascara un objeto vacío → resultado vacío", () => {
    expect(maskEnv({})).toEqual({});
  });

  test("enmascara todas las claves con el mismo token", () => {
    const result = maskEnv({ API_KEY: "sk-123", SECRET: "s3cr3t" });
    expect(result).toEqual({
      API_KEY: "••••••••",
      SECRET: "••••••••",
    });
  });

  test("preserva las claves exactas", () => {
    const input = { MY_TOKEN: "value", ANOTHER: "val2" };
    const result = maskEnv(input);
    expect(Object.keys(result).sort()).toEqual(["ANOTHER", "MY_TOKEN"]);
  });
});
