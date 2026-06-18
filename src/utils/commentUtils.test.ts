import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { isAgentComment, shouldShowActivityIndicator } from "./commentUtils";
import type { Comment, AgentState } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    task_id: 1,
    content: "Test comment",
    author: "Usuario",
    created_at: "2024-06-01T12:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe("Property-Based Tests — commentUtils", () => {
  // ---------------------------------------------------------------------------
  // Feature: agent-comments, Property 6: Agent classification correctness
  // **Validates: Requirements 4.3**
  // ---------------------------------------------------------------------------
  test("P6 – isAgentComment devuelve true iff agentNames.includes(author) (case-sensitive)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
        (author, agentNames) => {
          const result = isAgentComment(author, agentNames);
          const expected = agentNames.includes(author);
          return result === expected;
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: agent-comments, Property 7: Activity indicator logic
  // **Validates: Requirements 7.1**
  // ---------------------------------------------------------------------------
  test("P7 – shouldShowActivityIndicator devuelve true iff state=agent_working Y existe comentario humano posterior al último del agente", () => {
    const arbitraryState = fc.constantFrom<AgentState | null>(
      "assigned",
      "agent_working",
      "pending_review",
      "changes_requested",
      "done",
      null,
    );

    const arbitraryISO = fc
      .integer({ min: 1672531200000, max: 1798761599999 })
      .map((ms) => new Date(ms).toISOString());

    const arbitraryComment = fc.record({
      id: fc.integer({ min: 1 }),
      task_id: fc.constant(1),
      content: fc.string({ minLength: 1, maxLength: 100 }),
      author: fc.string({ minLength: 1, maxLength: 20 }),
      created_at: arbitraryISO,
    });

    fc.assert(
      fc.property(
        fc.array(arbitraryComment, { minLength: 0, maxLength: 15 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        arbitraryState,
        (comments, agentNames, executionState) => {
          const result = shouldShowActivityIndicator(comments, agentNames, executionState);

          // Condition 1: state must be "agent_working"
          if (executionState !== "agent_working") {
            return result === false;
          }

          // Condition 2: must have at least one comment
          if (comments.length === 0) {
            return result === false;
          }

          // Find the last agent comment's created_at
          let lastAgentDate: string | null = null;
          for (const c of comments) {
            if (agentNames.includes(c.author)) {
              if (lastAgentDate === null || c.created_at > lastAgentDate) {
                lastAgentDate = c.created_at;
              }
            }
          }

          // Check if there's a human comment after the last agent comment
          let hasHumanAfterAgent = false;
          for (const c of comments) {
            if (!agentNames.includes(c.author)) {
              if (lastAgentDate === null || c.created_at > lastAgentDate) {
                hasHumanAfterAgent = true;
                break;
              }
            }
          }

          return result === hasHumanAfterAgent;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — isAgentComment
// ---------------------------------------------------------------------------

describe("isAgentComment — unit tests", () => {
  test('isAgentComment("Kiro", ["Kiro", "GPT"]) → true', () => {
    expect(isAgentComment("Kiro", ["Kiro", "GPT"])).toBe(true);
  });

  test('isAgentComment("kiro", ["Kiro"]) → false (case-sensitive)', () => {
    expect(isAgentComment("kiro", ["Kiro"])).toBe(false);
  });

  test('isAgentComment("Usuario", []) → false (empty agent list)', () => {
    expect(isAgentComment("Usuario", [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — shouldShowActivityIndicator
// ---------------------------------------------------------------------------

describe("shouldShowActivityIndicator — unit tests", () => {
  test("returns false when there are no comments", () => {
    expect(shouldShowActivityIndicator([], ["Kiro"], "agent_working")).toBe(false);
  });

  test("returns true when state is agent_working and human comment exists (no agent comments)", () => {
    const humanComments: Comment[] = [
      makeComment({ id: 1, author: "Usuario", created_at: "2024-06-01T12:00:00.000Z" }),
    ];
    expect(shouldShowActivityIndicator(humanComments, ["Kiro"], "agent_working")).toBe(true);
  });

  test('returns false when state is "pending_review" (wrong state)', () => {
    const comments: Comment[] = [
      makeComment({ id: 1, author: "Usuario", created_at: "2024-06-01T12:00:00.000Z" }),
    ];
    expect(shouldShowActivityIndicator(comments, ["Kiro"], "pending_review")).toBe(false);
  });

  test("returns false when executionState is null", () => {
    const comments: Comment[] = [
      makeComment({ id: 1, author: "Usuario", created_at: "2024-06-01T12:00:00.000Z" }),
    ];
    expect(shouldShowActivityIndicator(comments, ["Kiro"], null)).toBe(false);
  });

  test("returns false when agent replied last (no unanswered human comments)", () => {
    const comments: Comment[] = [
      makeComment({ id: 1, author: "Usuario", created_at: "2024-06-01T10:00:00.000Z" }),
      makeComment({ id: 2, author: "Kiro", created_at: "2024-06-01T12:00:00.000Z" }),
    ];
    expect(shouldShowActivityIndicator(comments, ["Kiro"], "agent_working")).toBe(false);
  });

  test("returns true when human posted after agent's last comment", () => {
    const comments: Comment[] = [
      makeComment({ id: 1, author: "Kiro", created_at: "2024-06-01T10:00:00.000Z" }),
      makeComment({ id: 2, author: "Usuario", created_at: "2024-06-01T12:00:00.000Z" }),
    ];
    expect(shouldShowActivityIndicator(comments, ["Kiro"], "agent_working")).toBe(true);
  });
});
