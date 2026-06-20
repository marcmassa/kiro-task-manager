import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { formatToolsForProvider, normalizeProviderResponse } from "./providerAdapter";
import type { ToolDefinition, LLMResponse } from "./types";

const PROVIDER_IDS = ["openai", "anthropic", "google", "ollama", "bedrock"];

// Arbitrary for ToolDefinition
const arbToolDef: fc.Arbitrary<ToolDefinition> = fc.record({
  name: fc
    .string({ minLength: 1, maxLength: 30 })
    .filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  inputSchema: fc.constant({ type: "object", properties: {}, required: [] }),
});

// ── Property 2: Tool Definition Formatting Correctness ─────────────────────
// **Validates: Requirements 4.2, 4.5, 14.1**

describe("Property 2: Tool Definition Formatting Correctness", () => {
  test("formatToolsForProvider produces non-null structured result for all providers", () => {
    fc.assert(
      fc.property(
        fc.array(arbToolDef, { minLength: 1, maxLength: 5 }),
        fc.constantFrom(...PROVIDER_IDS),
        (tools, providerId) => {
          const result = formatToolsForProvider(tools, providerId);
          expect(result).not.toBeNull();
          expect(result).not.toBeUndefined();

          // Verify structure per provider
          if (providerId === "openai" || providerId === "ollama") {
            expect(Array.isArray(result)).toBe(true);
            const arr = result as Array<{ type: string; function: { name: string } }>;
            expect(arr.length).toBe(tools.length);
            for (const item of arr) {
              expect(item.type).toBe("function");
              expect(item.function.name).toBeDefined();
            }
          } else if (providerId === "anthropic") {
            expect(Array.isArray(result)).toBe(true);
            const arr = result as Array<{ name: string; input_schema: unknown }>;
            for (const item of arr) {
              expect(item.name).toBeDefined();
              expect(item.input_schema).toBeDefined();
            }
          } else if (providerId === "google") {
            expect(Array.isArray(result)).toBe(true);
            const arr = result as Array<{ functionDeclarations: Array<{ name: string }> }>;
            expect(arr[0].functionDeclarations).toBeDefined();
          } else if (providerId === "bedrock") {
            const obj = result as { tools: Array<{ toolSpec: { name: string } }> };
            expect(obj.tools).toBeDefined();
            expect(obj.tools.length).toBe(tools.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 3: Response Normalization Correctness ─────────────────────────
// **Validates: Requirements 4.3, 4.4, 14.2**

describe("Property 3: Response Normalization Correctness", () => {
  test("normalizeProviderResponse produces valid LLMResponse for text responses", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom(...PROVIDER_IDS),
        (text, providerId) => {
          // Build provider-specific text response
          const raw = buildTextResponse(providerId, text);
          const result = normalizeProviderResponse(raw, providerId);
          expect(result.type).toBe("text");
          if (result.type === "text") {
            expect(result.content.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("normalizeProviderResponse produces valid LLMResponse for tool_use responses", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z_]+$/.test(s)),
        fc.constantFrom(...PROVIDER_IDS),
        (toolName, providerId) => {
          const raw = buildToolUseResponse(providerId, toolName);
          const result = normalizeProviderResponse(raw, providerId);
          expect(result.type).toBe("tool_use");
          if (result.type === "tool_use") {
            expect(result.toolCalls.length).toBeGreaterThan(0);
            for (const tc of result.toolCalls) {
              expect(tc.id.length).toBeGreaterThan(0);
              expect(tc.name.length).toBeGreaterThan(0);
              expect(tc.arguments).not.toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 4: Provider Structural Consistency ────────────────────────────
// **Validates: Requirements 14.3**

describe("Property 4: Provider Structural Consistency", () => {
  test("format → simulate response → normalize produces tool names from original definitions", () => {
    fc.assert(
      fc.property(
        fc.array(arbToolDef, { minLength: 1, maxLength: 3 }),
        fc.constantFrom(...PROVIDER_IDS),
        (tools, providerId) => {
          // Format tools
          formatToolsForProvider(tools, providerId);

          // Pick a random tool name to simulate response
          const toolName = tools[0].name;
          const raw = buildToolUseResponse(providerId, toolName);
          const result = normalizeProviderResponse(raw, providerId);

          if (result.type === "tool_use") {
            for (const tc of result.toolCalls) {
              // Tool names in response should exist in original definitions
              const exists = tools.some((t) => t.name === tc.name);
              expect(exists).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Unit Tests (Task 4.11 partial) ────────────────────────────────────────

describe("formatToolsForProvider error cases", () => {
  test("throws for invalid providerId", () => {
    expect(() => formatToolsForProvider([], "invalid_provider")).toThrow("Proveedor no soportado");
  });
});

describe("normalizeProviderResponse error cases", () => {
  test("throws for malformed response", () => {
    expect(() => normalizeProviderResponse({}, "openai")).toThrow("Respuesta malformada");
  });

  test("throws for invalid providerId", () => {
    expect(() => normalizeProviderResponse({}, "invalid")).toThrow("Proveedor no soportado");
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTextResponse(providerId: string, text: string): unknown {
  switch (providerId) {
    case "openai":
    case "ollama":
      return { choices: [{ message: { content: text, tool_calls: null } }] };
    case "anthropic":
      return { content: [{ type: "text", text }] };
    case "google":
      return { candidates: [{ content: { parts: [{ text }] } }] };
    case "bedrock":
      return { output: { message: { content: [{ text }] } } };
    default:
      return {};
  }
}

function buildToolUseResponse(providerId: string, toolName: string): unknown {
  const args = { key: "value" };
  switch (providerId) {
    case "openai":
    case "ollama":
      return {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: "call_123", function: { name: toolName, arguments: JSON.stringify(args) } },
              ],
            },
          },
        ],
      };
    case "anthropic":
      return { content: [{ type: "tool_use", id: "toolu_123", name: toolName, input: args }] };
    case "google":
      return {
        candidates: [{ content: { parts: [{ functionCall: { name: toolName, args } }] } }],
      };
    case "bedrock":
      return {
        output: {
          message: {
            content: [{ toolUse: { toolUseId: "tooluse_123", name: toolName, input: args } }],
          },
        },
      };
    default:
      return {};
  }
}
