/**
 * Lógica pura para validación, generación de mcp.json y enmascaramiento de env.
 * Sin efectos secundarios — todas las funciones son puras y testeables en aislamiento.
 *
 * Cubre: R6, R7, R9, R11, R12, R14
 */

export type McpTransport = "stdio" | "http";

export interface McpServerInput {
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
  autoApprove?: string[];
}

export interface NormalizedMcpServer {
  name: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  enabled: boolean;
  autoApprove: string[];
}

export interface McpJsonEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  disabled: boolean;
  autoApprove?: string[];
}

/**
 * Valida una configuración de servidor MCP desconocida y la normaliza.
 * Función pura — nunca lanza excepciones (R7).
 * Rechaza con razón en español si la configuración es inválida (R6).
 */
export function validateMcpServer(
  input: unknown,
): { ok: true; value: NormalizedMcpServer } | { ok: false; reason: string } {
  if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "La configuración debe ser un objeto" };
  }

  const obj = input as Record<string, unknown>;

  // Validar name
  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    return { ok: false, reason: "El nombre es obligatorio y debe ser una cadena no vacía" };
  }

  // Validar transport
  if (obj.transport !== "stdio" && obj.transport !== "http") {
    return { ok: false, reason: 'El transporte debe ser "stdio" o "http"' };
  }

  const transport: McpTransport = obj.transport;

  // Validar command para stdio
  if (transport === "stdio") {
    if (typeof obj.command !== "string" || obj.command.trim() === "") {
      return { ok: false, reason: "El comando es obligatorio para transporte stdio" };
    }
  }

  // Validar url para http
  if (transport === "http") {
    if (typeof obj.url !== "string" || obj.url.trim() === "") {
      return { ok: false, reason: "La URL es obligatoria para transporte http" };
    }
  }

  // Validar args (opcional, debe ser array de strings)
  if (obj.args !== undefined && obj.args !== null) {
    if (!Array.isArray(obj.args)) {
      return { ok: false, reason: "Los argumentos deben ser un array de cadenas" };
    }
    for (const arg of obj.args) {
      if (typeof arg !== "string") {
        return { ok: false, reason: "Los argumentos deben ser un array de cadenas" };
      }
    }
  }

  // Validar env (opcional, debe ser Record<string, string>)
  if (obj.env !== undefined && obj.env !== null) {
    if (typeof obj.env !== "object" || Array.isArray(obj.env)) {
      return {
        ok: false,
        reason: "Las variables de entorno deben ser un objeto con valores de cadena",
      };
    }
    const envObj = obj.env as Record<string, unknown>;
    for (const key of Object.keys(envObj)) {
      if (typeof envObj[key] !== "string") {
        return {
          ok: false,
          reason: "Las variables de entorno deben ser un objeto con valores de cadena",
        };
      }
    }
  }

  // Validar autoApprove (opcional, debe ser array de strings)
  if (obj.autoApprove !== undefined && obj.autoApprove !== null) {
    if (!Array.isArray(obj.autoApprove)) {
      return { ok: false, reason: "autoApprove debe ser un array de cadenas" };
    }
    for (const item of obj.autoApprove) {
      if (typeof item !== "string") {
        return { ok: false, reason: "autoApprove debe ser un array de cadenas" };
      }
    }
  }

  // Normalizar
  const normalized: NormalizedMcpServer = {
    name: obj.name as string,
    transport,
    command: typeof obj.command === "string" ? obj.command : null,
    args: Array.isArray(obj.args) ? (obj.args as string[]) : [],
    env: obj.env !== undefined && obj.env !== null ? (obj.env as Record<string, string>) : {},
    url: typeof obj.url === "string" ? obj.url : null,
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
    autoApprove: Array.isArray(obj.autoApprove) ? (obj.autoApprove as string[]) : [],
  };

  return { ok: true, value: normalized };
}

/**
 * Genera un objeto mcp.json compatible con Kiro a partir del registro de servidores (R11/R12/R14).
 * Función pura — sin efectos secundarios.
 *
 * - Cada servidor se mapea por su `name` como clave.
 * - `disabled === !enabled` (R12).
 * - Para `stdio`: incluye `command`, `args`, `env`.
 * - Para `http`: incluye `url`.
 * - Incluye `autoApprove` solo si es un array no vacío (R11).
 */
export function buildMcpJson(servers: NormalizedMcpServer[]): {
  mcpServers: Record<string, McpJsonEntry>;
} {
  const mcpServers: Record<string, McpJsonEntry> = {};

  for (const server of servers) {
    const entry: McpJsonEntry = {
      disabled: !server.enabled,
    };

    if (server.transport === "stdio") {
      entry.command = server.command ?? undefined;
      entry.args = server.args;
      entry.env = server.env;
    } else {
      entry.url = server.url ?? undefined;
    }

    if (server.autoApprove.length > 0) {
      entry.autoApprove = server.autoApprove;
    }

    mcpServers[server.name] = entry;
  }

  return { mcpServers };
}

/**
 * Enmascara todos los valores de un objeto de variables de entorno (R9).
 * Devuelve las mismas claves con todos los valores reemplazados por "••••••••".
 * Usado al listar servidores — el frontend nunca ve los valores reales de env.
 */
export function maskEnv(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = Object.create(null);
  for (const key of Object.keys(env)) {
    masked[key] = "••••••••";
  }
  return masked;
}
