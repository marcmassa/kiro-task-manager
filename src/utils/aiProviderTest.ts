/**
 * Connection test module for AI providers.
 *
 * Sends a minimal prompt to the provider endpoint and verifies connectivity.
 * Each provider has its own request strategy (endpoint, headers, body format).
 *
 * SECURITY: API keys are NEVER included in error messages (R5.3, R6.4).
 * Timeout: 15 seconds via AbortController (R5.2).
 *
 * Covers: R5.1, R5.2, R5.3, R5.4, R6.3, R6.4
 */

import type { NormalizedAiProviderConfig } from "./aiProviderConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionTestResult {
  ok: boolean;
  model?: string;
  errorKind?: "timeout" | "auth_error" | "network_error" | "provider_error";
  message?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_TIMEOUT_MS = 15_000;
const TEST_PROMPT = "Responde solo con 'ok'.";

// ---------------------------------------------------------------------------
// Per-provider strategies
// ---------------------------------------------------------------------------

interface ProviderStrategy {
  buildRequest(config: NormalizedAiProviderConfig): { url: string; init: RequestInit };
}

const openaiStrategy: ProviderStrategy = {
  buildRequest(config) {
    const url = `${config.baseUrl}/chat/completions`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: TEST_PROMPT }],
          max_tokens: 10,
        }),
      },
    };
  },
};

const anthropicStrategy: ProviderStrategy = {
  buildRequest(config) {
    const url = `${config.baseUrl}/v1/messages`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: TEST_PROMPT }],
          max_tokens: 10,
        }),
      },
    };
  },
};

const googleStrategy: ProviderStrategy = {
  buildRequest(config) {
    const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: TEST_PROMPT }] }],
        }),
      },
    };
  },
};

const bedrockStrategy: ProviderStrategy = {
  buildRequest(config) {
    // Bedrock uses the AWS SDK for SigV4 signing.
    // We construct the endpoint URL; actual invocation uses the SDK.
    const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${config.model}/invoke`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ type: "text", text: TEST_PROMPT }] }],
          max_tokens: 10,
          anthropic_version: "bedrock-2023-05-31",
        }),
      },
    };
  },
};

const ollamaStrategy: ProviderStrategy = {
  buildRequest(config) {
    const url = `${config.baseUrl}/api/chat`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: TEST_PROMPT }],
          stream: false,
        }),
      },
    };
  },
};

const strategies: Record<string, ProviderStrategy> = {
  openai: openaiStrategy,
  anthropic: anthropicStrategy,
  google: googleStrategy,
  bedrock: bedrockStrategy,
  ollama: ollamaStrategy,
};

// ---------------------------------------------------------------------------
// Bedrock test via AWS SDK
// ---------------------------------------------------------------------------

async function testBedrockConnection(
  config: NormalizedAiProviderConfig,
): Promise<ConnectionTestResult> {
  try {
    // Dynamic import to avoid bundling the SDK when not needed
    const { BedrockRuntimeClient, InvokeModelCommand } =
      await import("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    try {
      const command = new InvokeModelCommand({
        modelId: config.model,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ type: "text", text: TEST_PROMPT }] }],
          max_tokens: 10,
          anthropic_version: "bedrock-2023-05-31",
        }),
      });

      await client.send(command, { abortSignal: controller.signal });
      clearTimeout(timeout);

      return { ok: true, model: config.model };
    } catch (error: unknown) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          errorKind: "timeout",
          message: "La prueba de conexión superó el tiempo de espera (15s)",
        };
      }

      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };

      if (
        err.$metadata?.httpStatusCode === 401 ||
        err.$metadata?.httpStatusCode === 403 ||
        err.name === "UnrecognizedClientException" ||
        err.name === "AccessDeniedException"
      ) {
        return {
          ok: false,
          errorKind: "auth_error",
          message: "Credenciales inválidas o sin acceso",
        };
      }

      return {
        ok: false,
        errorKind: "provider_error",
        message: `Error del proveedor (${err.name ?? "desconocido"})`,
      };
    }
  } catch {
    // SDK not available or import failed
    return {
      ok: false,
      errorKind: "provider_error",
      message: "El SDK de AWS Bedrock no está disponible. Instala @aws-sdk/client-bedrock-runtime.",
    };
  }
}

// ---------------------------------------------------------------------------
// Generic HTTP test (OpenAI, Anthropic, Google, Ollama)
// ---------------------------------------------------------------------------

async function testHttpConnection(
  config: NormalizedAiProviderConfig,
  strategy: ProviderStrategy,
): Promise<ConnectionTestResult> {
  const { url, init } = strategy.buildRequest(config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { ok: true, model: config.model };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        errorKind: "auth_error",
        message: "Credenciales inválidas o sin acceso",
      };
    }

    return {
      ok: false,
      errorKind: "provider_error",
      message: `Error del proveedor (status ${response.status})`,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorKind: "timeout",
        message: "La prueba de conexión superó el tiempo de espera (15s)",
      };
    }

    // Network errors (DNS, connection refused, TLS, etc.)
    return {
      ok: false,
      errorKind: "network_error",
      message: "No se pudo conectar con el proveedor",
    };
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Tests connectivity to the configured AI provider.
 * Sends a minimal prompt and verifies a successful response.
 *
 * SECURITY: Never includes API keys or secrets in error messages.
 */
export async function testProviderConnection(
  config: NormalizedAiProviderConfig,
): Promise<ConnectionTestResult> {
  // Bedrock uses the AWS SDK (SigV4) — separate path
  if (config.providerId === "bedrock") {
    return testBedrockConnection(config);
  }

  const strategy = strategies[config.providerId];
  if (!strategy) {
    return {
      ok: false,
      errorKind: "provider_error",
      message: `Proveedor no soportado: ${config.providerId}`,
    };
  }

  return testHttpConnection(config, strategy);
}
