import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  validateApiKey,
  LinearAuthError,
  LinearNetworkError,
  LinearRateLimitError,
} from "./linearClient";

/**
 * Replace globalThis.fetch with a callable that records every call
 * and returns a pre-canned Response-like object. Restores the original
 * on `restore()`.
 */
function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  const wrapped = mock(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(url, init);
  });
  globalThis.fetch = wrapped as unknown as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("linearClient.validateApiKey", () => {
  test("empty key throws LinearAuthError without network call", async () => {
    const { calls, restore } = mockFetch(() => {
      throw new Error("should not be called");
    });
    try {
      await expect(validateApiKey("")).rejects.toBeInstanceOf(LinearAuthError);
      expect(calls).toHaveLength(0);
    } finally {
      restore();
    }
  });

  test("whitespace-only key throws LinearAuthError without network call", async () => {
    const { calls, restore } = mockFetch(() => {
      throw new Error("should not be called");
    });
    try {
      await expect(validateApiKey("   ")).rejects.toBeInstanceOf(LinearAuthError);
      expect(calls).toHaveLength(0);
    } finally {
      restore();
    }
  });

  test("Authorization header carries the key (no header => LinearAuthError is fine, but we assert the header is sent)", async () => {
    const capturedAuth: { value: string | null } = { value: null };
    const { restore } = mockFetch((_url, init) => {
      const headers = new Headers(init.headers as HeadersInit);
      capturedAuth.value = headers.get("Authorization");
      return jsonResponse({
        data: { viewer: { id: "u1", name: "Test User", email: "t@example.com" } },
      });
    });
    try {
      const viewer = await validateApiKey("lin_api_test_abc123");
      expect(capturedAuth.value).toBe("lin_api_test_abc123");
      expect(viewer).toEqual({ id: "u1", name: "Test User", email: "t@example.com" });
    } finally {
      restore();
    }
  });

  test("401 response throws LinearAuthError", async () => {
    const { restore } = mockFetch(() => jsonResponse({ errors: [{ message: "auth" }] }, 401));
    try {
      await expect(validateApiKey("lin_api_bad")).rejects.toBeInstanceOf(LinearAuthError);
    } finally {
      restore();
    }
  });

  test("200 with data.viewer === null throws LinearAuthError", async () => {
    const { restore } = mockFetch(() => jsonResponse({ data: { viewer: null } }));
    try {
      await expect(validateApiKey("lin_api_noviewer")).rejects.toBeInstanceOf(LinearAuthError);
    } finally {
      restore();
    }
  });

  test("5xx is retried once and then throws LinearNetworkError", async () => {
    let calls = 0;
    const { restore } = mockFetch(() => {
      calls++;
      return jsonResponse({ errors: [{ message: "boom" }] }, 500);
    });
    try {
      await expect(validateApiKey("lin_api_500")).rejects.toBeInstanceOf(LinearNetworkError);
      // 1 initial + 1 retry = 2
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      restore();
    }
  });

  test("429 is retried once with backoff and then throws LinearRateLimitError", async () => {
    let calls = 0;
    const { restore } = mockFetch(() => {
      calls++;
      return jsonResponse({ errors: [{ message: "rate limited" }] }, 429);
    });
    try {
      await expect(validateApiKey("lin_api_429")).rejects.toBeInstanceOf(LinearRateLimitError);
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      restore();
    }
  });

  test("GraphQL AUTHENTICATION_ERROR surfaces as LinearAuthError", async () => {
    const { restore } = mockFetch(() =>
      jsonResponse({
        errors: [
          { message: "Authentication required", extensions: { code: "AUTHENTICATION_ERROR" } },
        ],
      }),
    );
    try {
      await expect(validateApiKey("lin_api_gql_auth")).rejects.toBeInstanceOf(LinearAuthError);
    } finally {
      restore();
    }
  });
});
