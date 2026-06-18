/**
 * Prueba de conexión MCP: intenta un handshake breve (initialize + listTools)
 * con un servidor MCP externo usando el SDK oficial.
 *
 * Exporta funciones puras de shaping (para test) y la función impura de probe.
 * NUNCA incluye valores de env en mensajes de error (R10).
 *
 * Cubre: R10, R15, R16
 */

import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type ProbeErrorKind = "timeout" | "spawn_error" | "protocol_error";

export interface ProbeSuccess {
  ok: true;
  toolCount: number;
  toolNames: string[];
}

export interface ProbeError {
  ok: false;
  errorKind: ProbeErrorKind;
  message: string;
}

export type ProbeResult = ProbeSuccess | ProbeError;

// ---------------------------------------------------------------------------
// Funciones puras de shaping (exportadas para test)
// ---------------------------------------------------------------------------

/**
 * Clasifica un error crudo en la taxonomía de probe.
 * NUNCA incluye valores de env en el mensaje (R10).
 */
export function shapeProbeError(error: unknown): ProbeError {
  if (error instanceof Error) {
    // Timeout via AbortController
    if (error.name === "AbortError" || error.message.includes("aborted")) {
      return {
        ok: false,
        errorKind: "timeout",
        message: "La conexión superó el tiempo de espera",
      };
    }

    // Spawn errors (command not found, permission denied, etc.)
    const code = (error as NodeJS.ErrnoException).code;
    if (
      code === "ENOENT" ||
      code === "EACCES" ||
      code === "EPERM" ||
      error.message.includes("spawn") ||
      error.message.includes("ENOENT")
    ) {
      return {
        ok: false,
        errorKind: "spawn_error",
        message: "No se pudo iniciar el proceso del servidor MCP",
      };
    }

    // Everything else is a protocol error
    return {
      ok: false,
      errorKind: "protocol_error",
      message: "Error de protocolo al comunicarse con el servidor MCP",
    };
  }

  // Non-Error thrown values
  return {
    ok: false,
    errorKind: "protocol_error",
    message: "Error desconocido al probar el servidor MCP",
  };
}

/**
 * Da forma al resultado exitoso del listado de tools.
 */
export function shapeProbeSuccess(tools: { name: string }[]): ProbeSuccess {
  return {
    ok: true,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  };
}

// ---------------------------------------------------------------------------
// Función principal de probe (impura — spawns proceso / conecta HTTP)
// ---------------------------------------------------------------------------

export interface ProbeConfig {
  transport: "stdio" | "http";
  command?: string | null;
  args?: string[];
  env?: Record<string, string>;
  url?: string | null;
}

export interface ProbeOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Intenta un handshake MCP breve con el servidor configurado:
 * initialize + listTools. Devuelve éxito con la lista de tools
 * o un error tipado (timeout | spawn_error | protocol_error).
 *
 * Timeout configurable (default 8s) con AbortController (R16).
 * NUNCA incluye valores de env en los mensajes de error (R10).
 */
export async function probeMcpServer(
  config: ProbeConfig,
  options?: ProbeOptions,
): Promise<ProbeResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let transport: Transport | undefined;

  try {
    if (config.transport === "stdio") {
      const command = config.command ?? "";
      const args = config.args ?? [];
      // Merge process.env with user env — sin filtrar (R15), pero nunca se
      // exponen los valores en errores (R10).
      const env: Record<string, string> = {
        ...process.env,
        ...(config.env ?? {}),
      } as Record<string, string>;

      transport = new StdioClientTransport({ command, args, env });
    } else {
      const url = config.url ?? "";
      transport = new StreamableHTTPClientTransport(new URL(url));
    }

    const client = new Client({ name: "mcp-registry-probe", version: "1.0.0" });

    await client.connect(transport, { signal: controller.signal });

    const result = await client.listTools(undefined, { signal: controller.signal });

    clearTimeout(timer);

    // Close gracefully
    try {
      await client.close();
    } catch {
      // ignore close errors
    }

    return shapeProbeSuccess(result.tools);
  } catch (error: unknown) {
    clearTimeout(timer);

    // Attempt to close transport on error
    if (transport) {
      try {
        await transport.close();
      } catch {
        // ignore close errors
      }
    }

    // If the abort signal fired, it's a timeout regardless of the error message
    if (controller.signal.aborted) {
      return {
        ok: false,
        errorKind: "timeout",
        message: "La conexión superó el tiempo de espera",
      };
    }

    return shapeProbeError(error);
  }
}
