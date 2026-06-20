import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { buildSystemPrompt } from "./systemPrompt";
import type { TaskContext, ToolDefinition } from "./types";

// ── Arbitraries ────────────────────────────────────────────────────────────

const arbTaskContext = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  priority: fc.string({ minLength: 1, maxLength: 20 }),
  category: fc.string({ minLength: 1, maxLength: 30 }),
  dueDate: fc.oneof(
    fc.constant(null),
    fc.date().map((d) => d.toISOString().slice(0, 10)),
  ),
  comments: fc.array(
    fc.record({
      author: fc.string({ minLength: 1, maxLength: 20 }),
      content: fc.string({ minLength: 1, maxLength: 200 }),
      createdAt: fc.date().map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 5 },
  ),
  attachments: fc.array(
    fc.record({
      filename: fc.string({ minLength: 1, maxLength: 50 }),
      content: fc.string({ minLength: 0, maxLength: 100 }),
    }),
    { minLength: 0, maxLength: 3 },
  ),
  reviewFeedback: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 200 })),
});

const arbToolDefinition: fc.Arbitrary<ToolDefinition> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  inputSchema: fc.constant({ type: "object", properties: {} }),
});

// ── Property Tests ─────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 2.2, 2.3, 3.1, 3.2**
 */
describe("Property 1: System Prompt Completeness", () => {
  test("output contains all required fields from TaskContext and tool names", () => {
    fc.assert(
      fc.property(
        arbTaskContext,
        fc.array(arbToolDefinition, { minLength: 1, maxLength: 5 }),
        (task, tools) => {
          const prompt = buildSystemPrompt(task, tools);

          // Must contain task fields
          expect(prompt).toContain(task.title);
          expect(prompt).toContain(task.description);
          expect(prompt).toContain(task.priority);
          expect(prompt).toContain(task.category);

          // Must contain all tool names
          for (const tool of tools) {
            expect(prompt).toContain(tool.name);
          }

          // Must contain review feedback if present
          if (task.reviewFeedback !== null) {
            expect(prompt).toContain(task.reviewFeedback);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Unit Tests ─────────────────────────────────────────────────────────────

describe("buildSystemPrompt unit tests", () => {
  const baseTask: TaskContext = {
    id: 1,
    title: "Test Task",
    description: "A test description",
    priority: "Alta",
    category: "Desarrollo",
    dueDate: "2025-06-20",
    comments: [],
    attachments: [],
    reviewFeedback: null,
  };

  const baseTools: ToolDefinition[] = [
    { name: "get_task", description: "Gets a task", inputSchema: { type: "object" } },
  ];

  test("includes review feedback when non-null", () => {
    const task = { ...baseTask, reviewFeedback: "Necesita más detalle en el resumen" };
    const prompt = buildSystemPrompt(task, baseTools);
    expect(prompt).toContain("Necesita más detalle en el resumen");
    expect(prompt).toContain("Feedback de Revisión Anterior");
  });

  test("excludes review feedback section when null", () => {
    const prompt = buildSystemPrompt(baseTask, baseTools);
    expect(prompt).not.toContain("Feedback de Revisión Anterior");
  });

  test("includes due date when present", () => {
    const prompt = buildSystemPrompt(baseTask, baseTools);
    expect(prompt).toContain("2025-06-20");
  });

  test("omits due date line when null", () => {
    const task = { ...baseTask, dueDate: null };
    const prompt = buildSystemPrompt(task, baseTools);
    expect(prompt).not.toContain("Fecha límite");
  });
});
