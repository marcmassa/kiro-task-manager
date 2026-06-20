import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { classifyTool } from "./toolRouter";
import { computeRetryDelay } from "./engine";

// ── Property 7: Tool Routing Correctness ───────────────────────────────────

describe("Property 7: Tool Routing Correctness", () => {
  test("classifies internal tools correctly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 }),
          ),
          { minLength: 0, maxLength: 10 },
        ),
        (internalNames, externalEntries) => {
          const externalMap = new Map(externalEntries);

          // Every internal name should classify as internal
          for (const name of internalNames) {
            const result = classifyTool(name, internalNames, externalMap);
            expect(result.type).toBe("internal");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("classifies external tools correctly", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 }),
          ),
          { minLength: 1, maxLength: 10 },
        ),
        (externalEntries) => {
          const externalMap = new Map(externalEntries);
          const internalNames: string[] = []; // empty internal to avoid conflicts

          for (const [toolName, serverName] of externalEntries) {
            const result = classifyTool(toolName, internalNames, externalMap);
            expect(result.type).toBe("external");
            if (result.type === "external") {
              expect(result.serverName).toBe(serverName);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test("classifies unknown tools correctly", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        (toolName, internalNames) => {
          // Ensure toolName is NOT in internal or external
          const filteredInternal = internalNames.filter((n) => n !== toolName);
          const emptyExternal = new Map<string, string>();
          const result = classifyTool(toolName, filteredInternal, emptyExternal);
          expect(result.type).toBe("unknown");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 8: Exponential Backoff Calculation ────────────────────────────

describe("Property 8: Exponential Backoff Calculation", () => {
  test("computes min(base * 2^attempt, max), always positive, non-decreasing until cap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 1000, max: 60000 }),
        (attempt, baseDelay, maxDelay) => {
          // Ensure maxDelay >= baseDelay for meaningful tests
          const effectiveMax = Math.max(baseDelay, maxDelay);
          const result = computeRetryDelay(attempt, baseDelay, effectiveMax);

          // Should equal min(base * 2^attempt, max)
          const expected = Math.min(baseDelay * Math.pow(2, attempt), effectiveMax);
          expect(result).toBe(expected);

          // Always positive
          expect(result).toBeGreaterThan(0);

          // Non-decreasing: result for attempt should be >= result for attempt-1
          if (attempt > 0) {
            const prev = computeRetryDelay(attempt - 1, baseDelay, effectiveMax);
            expect(result).toBeGreaterThanOrEqual(prev);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Unit Tests ─────────────────────────────────────────────────────────────

describe("classifyTool unit tests", () => {
  test("empty tool name returns unknown", () => {
    const result = classifyTool("", ["get_task"], new Map([["external_tool", "server1"]]));
    expect(result.type).toBe("unknown");
  });

  test("internal takes priority over external", () => {
    const map = new Map([["shared_name", "server1"]]);
    const result = classifyTool("shared_name", ["shared_name"], map);
    expect(result.type).toBe("internal");
  });
});

describe("computeRetryDelay unit tests", () => {
  test("never exceeds maxDelay", () => {
    for (let attempt = 0; attempt <= 20; attempt++) {
      const result = computeRetryDelay(attempt, 1000, 30000);
      expect(result).toBeLessThanOrEqual(30000);
    }
  });

  test("first attempt returns baseDelay", () => {
    expect(computeRetryDelay(0, 1000, 30000)).toBe(1000);
  });

  test("second attempt returns 2x baseDelay", () => {
    expect(computeRetryDelay(1, 1000, 30000)).toBe(2000);
  });
});
