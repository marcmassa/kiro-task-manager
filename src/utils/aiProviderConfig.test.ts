import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { validateAiProviderConfig, maskApiKey, PROVIDER_REGISTRY } from "./aiProviderConfig";
import type { AuthType } from "./aiProviderConfig";

// ---------------------------------------------------------------------------
// Helpers / Generators
// ---------------------------------------------------------------------------

const VALID_PROVIDER_IDS = PROVIDER_REGISTRY.map((p) => p.id);

/** Generate a valid config object for a specific provider */
function makeValidConfig(providerId: string): Record<string, unknown> {
  const provider = PROVIDER_REGISTRY.find((p) => p.id === providerId)!;
  const base: Record<string, unknown> = {
    providerId,
    model: provider.models[0],
  };

  if (provider.authType === "api_key") {
    base.apiKey = "sk-test1234567890abcdef";
  } else if (provider.authType === "aws_credentials") {
    base.region = "us-east-1";
    base.accessKeyId = "AKIAIOSFODNN7EXAMPLE";
    base.secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  } else if (provider.authType === "none") {
    base.baseUrl = "http://localhost:11434";
  }

  return base;
}

/** Arbitrary non-empty string that is NOT a valid provider id */
function arbitraryInvalidProviderId(): fc.Arbitrary<string> {
  return fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0 && !VALID_PROVIDER_IDS.includes(s));
}

/** Arbitrary for a valid config for a given provider (with random valid fields) */
function arbitraryValidConfigForProvider(
  providerId: string,
): fc.Arbitrary<Record<string, unknown>> {
  const provider = PROVIDER_REGISTRY.find((p) => p.id === providerId)!;
  const modelArb = fc.constantFrom(...provider.models);
  const nonEmptyStr = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

  if (provider.authType === "api_key") {
    return fc.record({
      providerId: fc.constant(providerId),
      model: modelArb,
      apiKey: nonEmptyStr,
    });
  } else if (provider.authType === "aws_credentials") {
    return fc.record({
      providerId: fc.constant(providerId),
      model: modelArb,
      region: nonEmptyStr,
      accessKeyId: nonEmptyStr,
      secretAccessKey: nonEmptyStr,
    });
  } else {
    // authType === "none"
    return fc.record({
      providerId: fc.constant(providerId),
      model: modelArb,
      baseUrl: nonEmptyStr,
    });
  }
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe("Property-Based Tests — ai-provider", () => {
  // -------------------------------------------------------------------------
  // Feature: ai-provider, Property 1: Registry completeness
  // Validates: Requirements 1.2
  // -------------------------------------------------------------------------
  test("P1 – Registry completeness: every entry has correct types and non-empty fields", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROVIDER_REGISTRY), (entry) => {
        // id is non-empty string
        if (typeof entry.id !== "string" || entry.id.length === 0) return false;
        // displayName is non-empty string
        if (typeof entry.displayName !== "string" || entry.displayName.length === 0) return false;
        // defaultBaseUrl is string
        if (typeof entry.defaultBaseUrl !== "string") return false;
        // authType is one of the valid values
        const validAuthTypes: AuthType[] = ["api_key", "aws_credentials", "none"];
        if (!validAuthTypes.includes(entry.authType)) return false;
        // models is non-empty array of strings
        if (!Array.isArray(entry.models) || entry.models.length === 0) return false;
        if (!entry.models.every((m) => typeof m === "string")) return false;
        // supportsCustomBaseUrl is boolean
        if (typeof entry.supportsCustomBaseUrl !== "boolean") return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Feature: ai-provider, Property 2: Per-provider required-field validation
  // Validates: Requirements 3.1, 3.2, 3.3, 4.2
  // -------------------------------------------------------------------------
  test("P2 – Per-provider required-field validation: valid config accepted, missing required field rejected", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROVIDER_REGISTRY), fc.context(), (provider, ctx) => {
        // Part A: valid config with all required fields → accepted
        const validConfig = arbitraryValidConfigForProvider(provider.id);
        const validSample = fc.sample(validConfig, 1)[0];
        const resultValid = validateAiProviderConfig(validSample);
        ctx.log(`Provider: ${provider.id}, valid config: ${JSON.stringify(validSample)}`);
        if (!resultValid.ok) {
          ctx.log(`Unexpected rejection: ${resultValid.reason}`);
          return false;
        }

        // Part B: config MISSING a required field → rejected
        if (provider.authType === "api_key") {
          const missingKey = { ...validSample };
          delete missingKey.apiKey;
          const resultMissing = validateAiProviderConfig(missingKey);
          if (resultMissing.ok) return false;
        } else if (provider.authType === "aws_credentials") {
          // Missing region
          const missingRegion = { ...validSample };
          delete missingRegion.region;
          const res1 = validateAiProviderConfig(missingRegion);
          if (res1.ok) return false;

          // Missing accessKeyId
          const missingAccessKey = { ...validSample };
          delete missingAccessKey.accessKeyId;
          const res2 = validateAiProviderConfig(missingAccessKey);
          if (res2.ok) return false;

          // Missing secretAccessKey
          const missingSecret = { ...validSample };
          delete missingSecret.secretAccessKey;
          const res3 = validateAiProviderConfig(missingSecret);
          if (res3.ok) return false;
        } else if (provider.authType === "none") {
          const missingUrl = { ...validSample };
          delete missingUrl.baseUrl;
          const resultMissing = validateAiProviderConfig(missingUrl);
          if (resultMissing.ok) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Feature: ai-provider, Property 3: Unknown provider rejection
  // Validates: Requirements 4.1
  // -------------------------------------------------------------------------
  test("P3 – Unknown provider rejection: any invalid providerId is rejected with non-empty reason", () => {
    fc.assert(
      fc.property(arbitraryInvalidProviderId(), (invalidId) => {
        const config = {
          providerId: invalidId,
          model: "some-model",
          apiKey: "some-key",
        };
        const result = validateAiProviderConfig(config);
        if (result.ok) return false;
        if (typeof result.reason !== "string" || result.reason.length === 0) return false;
        return true;
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Feature: ai-provider, Property 4: Optional parameter range validation
  // Validates: Requirements 4.3, 9.1, 9.2
  // -------------------------------------------------------------------------
  test("P4 – Optional parameter range validation: out-of-range rejected, in-range accepted", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.oneof(
          fc.integer({ min: -1000, max: 1000 }),
          fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
        ),
        (temperature, maxTokens) => {
          // Use a valid base config (OpenAI)
          const config: Record<string, unknown> = {
            providerId: "openai",
            model: "gpt-4o",
            apiKey: "sk-valid-key-12345678",
            temperature,
            maxTokens,
          };

          const result = validateAiProviderConfig(config);

          const tempInRange = temperature >= 0.0 && temperature <= 2.0;
          const tokensValid =
            typeof maxTokens === "number" && Number.isInteger(maxTokens) && maxTokens >= 1;

          if (!tempInRange || !tokensValid) {
            // Should be rejected
            if (result.ok) return false;
          } else {
            // Should NOT be rejected for these params (could still pass or have other issues)
            if (!result.ok) {
              // Check the error is NOT about temperature or maxTokens
              if (result.reason.includes("temperatura") || result.reason.includes("tokens")) {
                return false;
              }
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Feature: ai-provider, Property 5: Validation round-trip (idempotence)
  // Validates: Requirements 4.5
  // -------------------------------------------------------------------------
  test("P5 – Validation round-trip: valid config validated → serialized → parsed → validated again yields same result", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PROVIDER_REGISTRY), (provider) => {
        const configArb = arbitraryValidConfigForProvider(provider.id);
        const config = fc.sample(configArb, 1)[0];

        // First validation
        const result1 = validateAiProviderConfig(config);
        if (!result1.ok) return true; // skip if generator produced invalid (shouldn't happen)

        // Serialize to JSON and parse back
        const serialized = JSON.stringify(result1.value);
        const parsed = JSON.parse(serialized);

        // Second validation
        const result2 = validateAiProviderConfig(parsed);
        if (!result2.ok) return false;

        // Compare normalized results
        return JSON.stringify(result1.value) === JSON.stringify(result2.value);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — maskApiKey
// ---------------------------------------------------------------------------

describe("maskApiKey", () => {
  test("key ≤ 8 chars → fully masked as '••••••••'", () => {
    expect(maskApiKey("abcd")).toBe("••••••••");
    expect(maskApiKey("12345678")).toBe("••••••••");
    expect(maskApiKey("")).toBe("••••••••");
  });

  test("key > 8 chars → first 4 + '••••' + last 4", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1••••cdef");
    expect(maskApiKey("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA••••MPLE");
  });

  test("exactly 9 chars → first 4 + '••••' + last 4 pattern", () => {
    const key = "abcdefghi"; // 9 chars: "abcd" + "••••" + "fghi"
    expect(maskApiKey(key)).toBe("abcd••••fghi");
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — PROVIDER_REGISTRY
// ---------------------------------------------------------------------------

describe("PROVIDER_REGISTRY", () => {
  test("contains exactly 5 providers", () => {
    expect(PROVIDER_REGISTRY.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — validateAiProviderConfig (concrete cases)
// ---------------------------------------------------------------------------

describe("validateAiProviderConfig — concrete cases", () => {
  test("OpenAI: valid config accepted", () => {
    const result = validateAiProviderConfig(makeValidConfig("openai"));
    expect(result.ok).toBe(true);
  });

  test("Anthropic: valid config accepted", () => {
    const result = validateAiProviderConfig(makeValidConfig("anthropic"));
    expect(result.ok).toBe(true);
  });

  test("Google: valid config accepted", () => {
    const result = validateAiProviderConfig(makeValidConfig("google"));
    expect(result.ok).toBe(true);
  });

  test("Bedrock: valid config accepted", () => {
    const result = validateAiProviderConfig(makeValidConfig("bedrock"));
    expect(result.ok).toBe(true);
  });

  test("Ollama: valid config accepted", () => {
    const result = validateAiProviderConfig(makeValidConfig("ollama"));
    expect(result.ok).toBe(true);
  });

  test("OpenAI without apiKey → rejected with correct message", () => {
    const config = { providerId: "openai", model: "gpt-4o" };
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("La API key es obligatoria para este proveedor");
    }
  });

  test("Bedrock without region → rejected with correct message", () => {
    const config = { providerId: "bedrock", model: "anthropic.claude-sonnet-4-20250514-v1:0" };
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(
        "La región, access key ID y secret access key son obligatorios para AWS Bedrock",
      );
    }
  });

  test("Ollama without baseUrl → rejected with correct message", () => {
    const config = { providerId: "ollama", model: "llama3.1" };
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("La URL base es obligatoria para Ollama");
    }
  });

  test("empty model → rejected with correct message", () => {
    const config = { providerId: "openai", model: "", apiKey: "sk-valid" };
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("El modelo es obligatorio");
    }
  });

  test("invalid providerId → rejected with correct message", () => {
    const config = { providerId: "invalid-provider-xyz", model: "some-model", apiKey: "key" };
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("El proveedor seleccionado no es válido");
    }
  });

  test("defaults applied: temperature=0.7, maxTokens=4096 when not provided", () => {
    const config = makeValidConfig("openai");
    const result = validateAiProviderConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.temperature).toBe(0.7);
      expect(result.value.maxTokens).toBe(4096);
    }
  });

  test("non-object input (null) → rejected with correct message", () => {
    const result = validateAiProviderConfig(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("La configuración debe ser un objeto");
    }
  });

  test("non-object input (array) → rejected with correct message", () => {
    const result = validateAiProviderConfig([1, 2, 3]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("La configuración debe ser un objeto");
    }
  });

  test("non-object input (string) → rejected with correct message", () => {
    const result = validateAiProviderConfig("not-an-object");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("La configuración debe ser un objeto");
    }
  });
});
