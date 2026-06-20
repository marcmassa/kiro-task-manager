import type { ToolDefinition, LLMResponse, ToolCall, Message } from "./types";
import type { NormalizedAiProviderConfig } from "../utils/aiProviderConfig";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message as BedrockMessage,
  type Tool,
  type ToolResultBlock,
} from "@aws-sdk/client-bedrock-runtime";

const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "ollama", "bedrock"] as const;

type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Verifica si un providerId es soportado.
 */
function isSupportedProvider(providerId: string): providerId is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(providerId);
}

/**
 * Función pura: convierte ToolDefinition[] al formato nativo del proveedor.
 * Lanza error si el providerId no es soportado.
 */
export function formatToolsForProvider(tools: ToolDefinition[], providerId: string): unknown {
  if (!isSupportedProvider(providerId)) {
    throw new Error(`Proveedor no soportado: ${providerId}`);
  }

  switch (providerId) {
    case "openai":
    case "ollama":
      return tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));

    case "anthropic":
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));

    case "google":
      return [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })),
        },
      ];

    case "bedrock":
      return {
        tools: tools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
        })),
      };
  }
}

/**
 * Función pura: normaliza la respuesta cruda del proveedor al formato interno LLMResponse.
 * Lanza error si el providerId no es soportado o la respuesta está malformada.
 */
export function normalizeProviderResponse(rawResponse: unknown, providerId: string): LLMResponse {
  if (!isSupportedProvider(providerId)) {
    throw new Error(`Proveedor no soportado: ${providerId}`);
  }

  try {
    switch (providerId) {
      case "openai":
      case "ollama":
        return normalizeOpenAiResponse(rawResponse);

      case "anthropic":
        return normalizeAnthropicResponse(rawResponse);

      case "google":
        return normalizeGoogleResponse(rawResponse);

      case "bedrock":
        return normalizeBedrockResponse(rawResponse);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Proveedor no soportado")) {
      throw error;
    }
    throw new Error(`Respuesta malformada del proveedor ${providerId}`);
  }
}

/**
 * Normaliza respuesta de OpenAI/Ollama.
 */
function normalizeOpenAiResponse(raw: unknown): LLMResponse {
  const response = raw as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string | Record<string, unknown> };
        }>;
      };
    }>;
  };

  const message = response?.choices?.[0]?.message;
  if (!message) {
    throw new Error("missing message");
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls: ToolCall[] = message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments:
        typeof tc.function.arguments === "string"
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : tc.function.arguments,
    }));
    return { type: "tool_use", toolCalls };
  }

  if (message.content) {
    return { type: "text", content: message.content };
  }

  throw new Error("no content or tool_calls");
}

/**
 * Normaliza respuesta de Anthropic.
 */
function normalizeAnthropicResponse(raw: unknown): LLMResponse {
  const response = raw as {
    content?: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >;
  };

  const content = response?.content;
  if (!content || content.length === 0) {
    throw new Error("missing content");
  }

  const toolUseBlocks = content.filter(
    (
      block,
    ): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      block.type === "tool_use",
  );

  if (toolUseBlocks.length > 0) {
    const toolCalls: ToolCall[] = toolUseBlocks.map((block) => ({
      id: block.id,
      name: block.name,
      arguments: block.input,
    }));
    return { type: "tool_use", toolCalls };
  }

  const textBlock = content.find(
    (block): block is { type: "text"; text: string } => block.type === "text",
  );

  if (textBlock) {
    return { type: "text", content: textBlock.text };
  }

  throw new Error("no text or tool_use blocks");
}

/**
 * Normaliza respuesta de Google (Gemini).
 */
function normalizeGoogleResponse(raw: unknown): LLMResponse {
  const response = raw as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
    }>;
  };

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error("missing parts");
  }

  const functionCalls = parts.filter(
    (part): part is { functionCall: { name: string; args: Record<string, unknown> } } =>
      part.functionCall !== undefined,
  );

  if (functionCalls.length > 0) {
    const toolCalls: ToolCall[] = functionCalls.map((part) => ({
      id: crypto.randomUUID(),
      name: part.functionCall.name,
      arguments: part.functionCall.args,
    }));
    return { type: "tool_use", toolCalls };
  }

  const textPart = parts.find((part) => part.text !== undefined);
  if (textPart && textPart.text) {
    return { type: "text", content: textPart.text };
  }

  throw new Error("no text or functionCall parts");
}

/**
 * Normaliza respuesta de AWS Bedrock.
 */
function normalizeBedrockResponse(raw: unknown): LLMResponse {
  const response = raw as {
    output?: {
      message?: {
        content?: Array<
          | { text?: string }
          | { toolUse?: { toolUseId: string; name: string; input: Record<string, unknown> } }
        >;
      };
    };
  };

  const content = response?.output?.message?.content;
  if (!content || content.length === 0) {
    throw new Error("missing content");
  }

  const toolUseBlocks = content.filter(
    (
      block,
    ): block is { toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } } =>
      "toolUse" in block && block.toolUse !== undefined,
  );

  if (toolUseBlocks.length > 0) {
    const toolCalls: ToolCall[] = toolUseBlocks.map((block) => ({
      id: block.toolUse.toolUseId,
      name: block.toolUse.name,
      arguments: block.toolUse.input,
    }));
    return { type: "tool_use", toolCalls };
  }

  const textBlock = content.find(
    (block): block is { text: string } =>
      "text" in block && typeof (block as { text?: unknown }).text === "string",
  );

  if (textBlock) {
    return { type: "text", content: textBlock.text };
  }

  throw new Error("no text or toolUse blocks");
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Adapter — interfaz común y factory
// ─────────────────────────────────────────────────────────────────────────────

/** Timeout por defecto para cada petición HTTP al proveedor (ms). */
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Interfaz unificada para enviar mensajes al LLM.
 * Cada implementación interna maneja la conversión de mensajes y
 * la llamada HTTP/SDK específica del proveedor.
 */
export interface ProviderAdapter {
  sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse>;
}

/**
 * Factory: crea el adapter correcto según el providerId configurado.
 * Lanza error si el providerId no es soportado.
 */
export function createProviderAdapter(config: NormalizedAiProviderConfig): ProviderAdapter {
  if (!isSupportedProvider(config.providerId)) {
    throw new Error(`Proveedor no soportado: ${config.providerId}`);
  }

  switch (config.providerId) {
    case "openai":
      return new OpenAiAdapter(config);
    case "anthropic":
      return new AnthropicAdapter(config);
    case "google":
      return new GoogleAdapter(config);
    case "ollama":
      return new OllamaAdapter(config);
    case "bedrock":
      return new BedrockAdapter(config);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de conversión de mensajes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte mensajes internos al formato OpenAI/Ollama.
 */
function convertMessagesForOpenAi(messages: Message[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }

    if (msg.role === "tool") {
      return {
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content,
      };
    }

    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

/**
 * Convierte mensajes internos al formato Anthropic.
 * Extrae el system message y lo retorna por separado.
 */
function convertMessagesForAnthropic(messages: Message[]): {
  system: string | undefined;
  messages: Array<Record<string, unknown>>;
} {
  let system: string | undefined;
  const converted: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = msg.content;
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      converted.push({ role: "assistant", content });
      continue;
    }

    if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      });
      continue;
    }

    converted.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  return { system, messages: converted };
}

/**
 * Convierte mensajes internos al formato Google Gemini.
 */
function convertMessagesForGoogle(messages: Message[]): {
  systemInstruction: string | undefined;
  contents: Array<Record<string, unknown>>;
} {
  let systemInstruction: string | undefined;
  const contents: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const parts: Array<Record<string, unknown>> = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        parts.push({
          functionCall: { name: tc.name, args: tc.arguments },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    if (msg.role === "tool") {
      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: msg.toolCallId,
              response: { result: msg.content },
            },
          },
        ],
      });
      continue;
    }

    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  return { systemInstruction, contents };
}

/**
 * Convierte mensajes internos al formato AWS Bedrock Converse API.
 */
function convertMessagesForBedrock(messages: Message[]): {
  system: Array<{ text: string }> | undefined;
  bedrockMessages: BedrockMessage[];
} {
  let system: Array<{ text: string }> | undefined;
  const bedrockMessages: BedrockMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = [{ text: msg.content }];
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: ContentBlock[] = [];
      if (msg.content) {
        content.push({ text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        content.push({
          toolUse: {
            toolUseId: tc.id,
            name: tc.name,
            input: tc.arguments as unknown as ContentBlock.ToolUseMember["toolUse"]["input"],
          },
        });
      }
      bedrockMessages.push({ role: "assistant", content });
      continue;
    }

    if (msg.role === "tool") {
      const toolResult: ToolResultBlock = {
        toolUseId: msg.toolCallId!,
        content: [{ text: msg.content }],
      };
      bedrockMessages.push({
        role: "user",
        content: [{ toolResult }],
      });
      continue;
    }

    bedrockMessages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: [{ text: msg.content }],
    });
  }

  return { system, bedrockMessages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementaciones internas de adaptadores por proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter para OpenAI (compatible con Chat Completions API).
 */
class OpenAiAdapter implements ProviderAdapter {
  constructor(private config: NormalizedAiProviderConfig) {}

  async sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const formattedTools = formatToolsForProvider(tools, "openai");
    const convertedMessages = convertMessagesForOpenAi(messages);

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: convertedMessages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    if (tools.length > 0) {
      body.tools = formattedTools;
    }

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return normalizeProviderResponse(raw, "openai");
  }
}

/**
 * Adapter para Anthropic (Messages API).
 */
class AnthropicAdapter implements ProviderAdapter {
  constructor(private config: NormalizedAiProviderConfig) {}

  async sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const formattedTools = formatToolsForProvider(tools, "anthropic");
    const { system, messages: convertedMessages } = convertMessagesForAnthropic(messages);

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: convertedMessages,
      temperature: this.config.temperature,
    };

    if (system) {
      body.system = system;
    }

    if (tools.length > 0) {
      body.tools = formattedTools;
    }

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return normalizeProviderResponse(raw, "anthropic");
  }
}

/**
 * Adapter para Google Gemini (GenerateContent API).
 */
class GoogleAdapter implements ProviderAdapter {
  constructor(private config: NormalizedAiProviderConfig) {}

  async sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const formattedTools = formatToolsForProvider(tools, "google");
    const { systemInstruction, contents } = convertMessagesForGoogle(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools.length > 0) {
      body.tools = formattedTools;
    }

    const url = `${this.config.baseUrl}/v1/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return normalizeProviderResponse(raw, "google");
  }
}

/**
 * Adapter para Ollama (API local, formato OpenAI-compatible).
 */
class OllamaAdapter implements ProviderAdapter {
  constructor(private config: NormalizedAiProviderConfig) {}

  async sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const formattedTools = formatToolsForProvider(tools, "ollama");
    const convertedMessages = convertMessagesForOpenAi(messages);

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: convertedMessages,
      stream: false,
      options: {
        temperature: this.config.temperature,
      },
    };

    if (tools.length > 0) {
      body.tools = formattedTools;
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    return normalizeProviderResponse(raw, "ollama");
  }
}

/**
 * Adapter para AWS Bedrock (Converse API via SDK).
 */
class BedrockAdapter implements ProviderAdapter {
  private client: BedrockRuntimeClient;

  constructor(private config: NormalizedAiProviderConfig) {
    this.client = new BedrockRuntimeClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async sendMessage(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse> {
    const formattedToolConfig = formatToolsForProvider(tools, "bedrock") as {
      tools: Tool[];
    };
    const { system, bedrockMessages } = convertMessagesForBedrock(messages);

    const command = new ConverseCommand({
      modelId: this.config.model,
      messages: bedrockMessages,
      system: system as Array<{ text: string }>,
      toolConfig: tools.length > 0 ? formattedToolConfig : undefined,
      inferenceConfig: {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
    });

    const response = await this.client.send(command, {
      requestTimeout: DEFAULT_REQUEST_TIMEOUT_MS,
    });

    return normalizeProviderResponse(response, "bedrock");
  }
}
