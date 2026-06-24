import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { effectiveColumn, VALID_COLUMN_IDS, type KanbanColumnId } from "./sddKanban";
import { SDD_PHASES, type SddPhase } from "./sddLifecycle";

const taskStatusArb = fc.constantFrom("todo", "in_progress", "done") as fc.Arbitrary<
  "todo" | "in_progress" | "done"
>;
const agentStateArb = fc.constantFrom(
  "assigned",
  "agent_working",
  "pending_review",
  "changes_requested",
  "done",
) as fc.Arbitrary<"assigned" | "agent_working" | "pending_review" | "changes_requested" | "done">;
const sddPhaseArb = fc.constantFrom(...SDD_PHASES) as fc.Arbitrary<SddPhase>;
const sddPhaseNullArb = fc.option(sddPhaseArb, { nil: null });

describe("sddKanban — effectiveColumn", () => {
  // Property 4: effectiveColumn is total — never throws and always returns a valid column
  test("P4: effectiveColumn is total for any valid input", () => {
    fc.assert(
      fc.property(taskStatusArb, agentStateArb, sddPhaseNullArb, (status, state, sdd_phase) => {
        const col = effectiveColumn({ status, sdd_phase: null }, { state, sdd_phase });
        return (VALID_COLUMN_IDS as readonly string[]).includes(col);
      }),
      { numRuns: 100 },
    );
  });

  // Unit: SDD phases map to correct columns
  test("sdd_phase=requirements → requirements column", () => {
    expect(
      effectiveColumn(
        { status: "todo", sdd_phase: null },
        { state: "agent_working", sdd_phase: "requirements" },
      ),
    ).toBe("requirements");
  });

  test("sdd_phase=design → design column", () => {
    expect(
      effectiveColumn(
        { status: "todo", sdd_phase: null },
        { state: "agent_working", sdd_phase: "design" },
      ),
    ).toBe("design");
  });

  test("sdd_phase=tasks → tasks column", () => {
    expect(
      effectiveColumn(
        { status: "in_progress", sdd_phase: null },
        { state: "agent_working", sdd_phase: "tasks" },
      ),
    ).toBe("tasks");
  });

  test("sdd_phase=execution → in_progress column", () => {
    expect(
      effectiveColumn(
        { status: "todo", sdd_phase: null },
        { state: "agent_working", sdd_phase: "execution" },
      ),
    ).toBe("in_progress");
  });

  // Unit: done execution falls back to task.status
  test("sdd_phase set but state=done → falls back to task.status", () => {
    expect(
      effectiveColumn(
        { status: "todo", sdd_phase: null },
        { state: "done", sdd_phase: "requirements" },
      ),
    ).toBe("todo");
    expect(
      effectiveColumn({ status: "done", sdd_phase: null }, { state: "done", sdd_phase: "design" }),
    ).toBe("done");
  });

  // Unit: Legacy (null sdd_phase) follows task.status
  test("sdd_phase=null → todo", () => {
    expect(
      effectiveColumn({ status: "todo", sdd_phase: null }, { state: "assigned", sdd_phase: null }),
    ).toBe("todo");
  });

  test("sdd_phase=null → in_progress", () => {
    expect(
      effectiveColumn(
        { status: "in_progress", sdd_phase: null },
        { state: "agent_working", sdd_phase: null },
      ),
    ).toBe("in_progress");
  });

  test("sdd_phase=null → done", () => {
    expect(
      effectiveColumn({ status: "done", sdd_phase: null }, { state: "done", sdd_phase: null }),
    ).toBe("done");
  });

  // Unit: null execution → task.status
  test("no execution → task.status", () => {
    expect(effectiveColumn({ status: "todo", sdd_phase: null }, null)).toBe("todo");
    expect(effectiveColumn({ status: "done", sdd_phase: null }, null)).toBe("done");
  });
});
