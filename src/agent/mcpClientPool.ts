/**
 * Pool de clientes MCP: gestiona conexiones persistentes a servidores MCP
 * externos registrados en la base de datos. Provee herramientas externas
 * al agent engine y maneja reconexión automática de servidores fallidos.
 *
 * NUNCA registra valores de env/secrets en logs — solo mensajes de error (R12.1).
 *
 * Cubre: R6.1, R6.4, R6.5, R12.2, R12.4
 */

import type { Database } from "bun:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { decryptApiKey } from "../utils/crypto";
import type { ToolDefinition } from "./types";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

/** Estado de conexión de un servidor MCP. */
type ServerState = "connected" | "failed" | "disconnected";

/** Información de un servidor MCP conectado (o fallido). */
interface ConnectedServer {
  name: string;
  client: Client;
  transport: Transport;
  state: ServerState;
  tools: ToolDefinition[];
}

/** Fila cruda de la tabla mcp_servers. */
interface McpServerRow {
  id: number;
  name: string;
  transport: "stdio" | "http";
  command: string | null;
  args: string;
  env_encrypted: string;
  url: string | null;
  enabled: number;
  auto_approve: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

/** Pool de clientes MCP para el agent engine. */
export interface McpClientPool {
  /** Conecta a todos los servidores MCP habilitados del registro. */
  initialize(): Promise<void>;

  /** Devuelve ToolDefinition[] de todos los servidores conectados. */
  getExternalTools(): ToolDefinition[];

  /** Ejecuta una herramienta en un servidor MCP específico. */
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string>;

  /** Intenta reconectar servidores en estado `failed`. */
  reconnectFailed(): Promise<void>;

  /** Desconecta todos los clientes. */
  shutdown(): Promise<void>;

  /** Devuelve el mapa toolName → serverName para routing. */
  getToolMap(): Map<string, string>;
}

// ---------------------------------------------------------------------------
// Default timeout
// ---------------------------------------------------------------------------

const DEFAULT_TOOL_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Crea una instancia del pool de clientes MCP.
 *
 * @param db - Base de datos SQLite con la tabla `mcp_servers`.
 * @param toolTimeoutMs - Timeout por llamada a herramienta (default 30s).
 */
export function createMcpClientPool(db: Database, toolTimeoutMs?: number): McpClientPool {
  const timeout = toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  const servers: ConnectedServer[] = [];

  // -------------------------------------------------------------------------
  // Helpers internos
  // -------------------------------------------------------------------------

  /**
   * Conecta a un servidor MCP individual. En caso de fallo marca como `failed`.
   */
  async function connectServer(row: McpServerRow): Promise<ConnectedServer> {
    let transport: Transport;
    const serverEntry: ConnectedServer = {
      name: row.name,
      client: new Client({ name: `agent-mcp-${row.name}`, version: "1.0.0" }),
      transport: undefined as unknown as Transport,
      state: "disconnected",
      tools: [],
    };

    try {
      // Descifrar variables de entorno
      let env: Record<string, string> = {};
      if (row.env_encrypted) {
        const envJson = await decryptApiKey(row.env_encrypted);
        env = JSON.parse(envJson) as Record<string, string>;
      }

      if (row.transport === "stdio") {
        const command = row.command ?? "";
        const args: string[] = JSON.parse(row.args || "[]");
        transport = new StdioClientTransport({
          command,
          args,
          env: { ...process.env, ...env } as Record<string, string>,
        });
      } else {
        const url = row.url ?? "";
        transport = new StreamableHTTPClientTransport(new URL(url));
      }

      serverEntry.transport = transport;

      // Conectar con timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      await serverEntry.client.connect(transport, { signal: controller.signal });

      // Obtener lista de herramientas
      const result = await serverEntry.client.listTools(undefined, {
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Mapear herramientas al formato ToolDefinition
      serverEntry.tools = result.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
      }));

      serverEntry.state = "connected";
    } catch {
      // No registrar detalles de env — solo el nombre del servidor (R12.1)
      serverEntry.state = "failed";
      serverEntry.tools = [];

      // Intentar cerrar transport si se creó
      if (serverEntry.transport) {
        try {
          await serverEntry.transport.close();
        } catch {
          // Ignorar errores de cierre
        }
      }
    }

    return serverEntry;
  }

  // -------------------------------------------------------------------------
  // Implementación de la interfaz
  // -------------------------------------------------------------------------

  async function initialize(): Promise<void> {
    // Limpiar conexiones previas
    await shutdown();

    // Consultar servidores habilitados
    const rows = db.query("SELECT * FROM mcp_servers WHERE enabled = 1").all() as McpServerRow[];

    // Conectar a cada servidor (secuencial para evitar races en stdio spawn)
    for (const row of rows) {
      const server = await connectServer(row);
      servers.push(server);
    }
  }

  function getExternalTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const server of servers) {
      if (server.state === "connected") {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  async function callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const server = servers.find((s) => s.name === serverName);
    if (!server) {
      throw new Error(`Servidor MCP "${serverName}" no encontrado en el pool`);
    }
    if (server.state !== "connected") {
      throw new Error(`Servidor MCP "${serverName}" no está conectado (estado: ${server.state})`);
    }

    const result = await server.client.callTool({ name: toolName, arguments: args }, undefined, {
      signal: AbortSignal.timeout(timeout),
    });

    // Extraer texto del resultado MCP: { content: [{ type: "text", text: "..." }] }
    if (result.content && Array.isArray(result.content)) {
      const textParts = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text" && c.text !== undefined)
        .map((c) => c.text as string);
      return textParts.join("\n");
    }

    return "";
  }

  async function reconnectFailed(): Promise<void> {
    // Re-leer filas de DB para servidores habilitados que están en estado failed
    const failedServers = servers.filter((s) => s.state === "failed");
    if (failedServers.length === 0) return;

    const rows = db.query("SELECT * FROM mcp_servers WHERE enabled = 1").all() as McpServerRow[];

    for (const failed of failedServers) {
      const row = rows.find((r) => r.name === failed.name);
      if (!row) continue;

      // Intentar cerrar cliente anterior
      try {
        await failed.client.close();
      } catch {
        // Ignorar
      }

      // Crear nuevo cliente
      const reconnected = await connectServer(row);

      // Reemplazar en el array
      const idx = servers.indexOf(failed);
      if (idx !== -1) {
        servers[idx] = reconnected;
      }
    }
  }

  async function shutdown(): Promise<void> {
    for (const server of servers) {
      try {
        await server.client.close();
      } catch {
        // Ignorar errores de cierre
      }
      server.state = "disconnected";
      server.tools = [];
    }
    servers.length = 0;
  }

  function getToolMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const server of servers) {
      if (server.state === "connected") {
        for (const tool of server.tools) {
          map.set(tool.name, server.name);
        }
      }
    }
    return map;
  }

  return {
    initialize,
    getExternalTools,
    callTool,
    reconnectFailed,
    shutdown,
    getToolMap,
  };
}
