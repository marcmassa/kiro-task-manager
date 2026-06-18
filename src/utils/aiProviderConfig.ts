/**
 * Lógica pura para validación y registro de proveedores de IA.
 * Sin efectos secundarios — todas las funciones son puras y testeables en aislamiento.
 *
 * Cubre: R1, R3, R4, R9
 */

export type AuthType = "api_key" | "aws_credentials" | "none";

export interface ProviderMeta {
  id: string;
  displayName: string;
  defaultBaseUrl: string;
  authType: AuthType;
  models: string[];
  supportsCustomBaseUrl: boolean;
}

export interface AiProviderInput {
  providerId: string;
  model: string;
  apiKey?: string;
  secretAccessKey?: string;
  accessKeyId?: string;
  region?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface NormalizedAiProviderConfig {
  providerId: string;
  model: string;
  apiKey: string;
  secretAccessKey: string;
  accessKeyId: string;
  region: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export type ValidationResult =
  | { ok: true; value: NormalizedAiProviderConfig }
  | { ok: false; reason: string };

export const PROVIDER_REGISTRY: readonly ProviderMeta[] = [
  {
    id: "openai",
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    authType: "api_key",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini"],
    supportsCustomBaseUrl: true,
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    authType: "api_key",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250514", "claude-3-5-sonnet-20241022"],
    supportsCustomBaseUrl: true,
  },
  {
    id: "google",
    displayName: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    authType: "api_key",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    supportsCustomBaseUrl: true,
  },
  {
    id: "bedrock",
    displayName: "AWS Bedrock",
    defaultBaseUrl: "",
    authType: "aws_credentials",
    models: [
      "anthropic.claude-sonnet-4-20250514-v1:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "amazon.nova-pro-v1:0",
    ],
    supportsCustomBaseUrl: false,
  },
  {
    id: "ollama",
    displayName: "Ollama",
    defaultBaseUrl: "http://localhost:11434",
    authType: "none",
    models: ["llama3.1", "mistral", "codellama", "deepseek-coder-v2"],
    supportsCustomBaseUrl: false,
  },
];

/**
 * Valida una configuración de proveedor de IA desconocida y la normaliza.
 * Función pura — nunca lanza excepciones.
 * Rechaza con razón en español si la configuración es inválida.
 */
export function validateAiProviderConfig(input: unknown): ValidationResult {
  if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "La configuración debe ser un objeto" };
  }

  const obj = input as Record<string, unknown>;

  // Validar providerId
  const providerId = obj.providerId;
  if (typeof providerId !== "string" || providerId.trim() === "") {
    return { ok: false, reason: "El proveedor seleccionado no es válido" };
  }

  const provider = PROVIDER_REGISTRY.find((p) => p.id === providerId);
  if (!provider) {
    return { ok: false, reason: "El proveedor seleccionado no es válido" };
  }

  // Validar model
  const model = obj.model;
  if (typeof model !== "string" || model.trim() === "") {
    return { ok: false, reason: "El modelo es obligatorio" };
  }

  // Validar campos requeridos según authType
  if (provider.authType === "api_key") {
    if (typeof obj.apiKey !== "string" || obj.apiKey.trim() === "") {
      return { ok: false, reason: "La API key es obligatoria para este proveedor" };
    }
  }

  if (provider.authType === "aws_credentials") {
    const region = obj.region;
    const accessKeyId = obj.accessKeyId;
    const secretAccessKey = obj.secretAccessKey;

    if (
      typeof region !== "string" ||
      region.trim() === "" ||
      typeof accessKeyId !== "string" ||
      accessKeyId.trim() === "" ||
      typeof secretAccessKey !== "string" ||
      secretAccessKey.trim() === ""
    ) {
      return {
        ok: false,
        reason: "La región, access key ID y secret access key son obligatorios para AWS Bedrock",
      };
    }
  }

  if (provider.authType === "none") {
    if (typeof obj.baseUrl !== "string" || obj.baseUrl.trim() === "") {
      return { ok: false, reason: "La URL base es obligatoria para Ollama" };
    }
  }

  // Validar parámetros opcionales
  if (obj.temperature !== undefined && obj.temperature !== null) {
    if (typeof obj.temperature !== "number" || obj.temperature < 0.0 || obj.temperature > 2.0) {
      return { ok: false, reason: "La temperatura debe estar entre 0.0 y 2.0" };
    }
  }

  if (obj.maxTokens !== undefined && obj.maxTokens !== null) {
    if (
      typeof obj.maxTokens !== "number" ||
      !Number.isInteger(obj.maxTokens) ||
      obj.maxTokens < 1
    ) {
      return { ok: false, reason: "El máximo de tokens debe ser al menos 1" };
    }
  }

  // Normalizar
  const temperature = typeof obj.temperature === "number" ? obj.temperature : 0.7;
  const maxTokens =
    typeof obj.maxTokens === "number" && Number.isInteger(obj.maxTokens) ? obj.maxTokens : 4096;

  let baseUrl: string;
  if (typeof obj.baseUrl === "string" && obj.baseUrl.trim() !== "") {
    baseUrl = obj.baseUrl;
  } else {
    baseUrl = provider.defaultBaseUrl;
  }

  const normalized: NormalizedAiProviderConfig = {
    providerId: provider.id,
    model: model as string,
    apiKey: typeof obj.apiKey === "string" ? obj.apiKey : "",
    secretAccessKey: typeof obj.secretAccessKey === "string" ? obj.secretAccessKey : "",
    accessKeyId: typeof obj.accessKeyId === "string" ? obj.accessKeyId : "",
    region: typeof obj.region === "string" ? obj.region : "",
    baseUrl,
    temperature,
    maxTokens,
  };

  return { ok: true, value: normalized };
}

/**
 * Enmascara una API key para mostrar en el frontend.
 * Keys cortas (≤8 chars) se enmascaran completamente.
 * Keys largas muestran prefix(4) + "••••" + suffix(4).
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}
