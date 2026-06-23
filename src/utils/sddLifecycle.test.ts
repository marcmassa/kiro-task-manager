import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import {
  SDD_PHASES,
  nextPhase,
  isFinalPhase,
  phaseLabel,
  applyPhaseApproval,
  type SddPhase,
} from "./sddLifecycle";

const phaseArb = fc.constantFrom(...SDD_PHASES);

describe("sddLifecycle", () => {
  // Property 1: nextPhase never goes backward
  test("P1: nextPhase index always increases", () => {
    fc.assert(
      fc.property(phaseArb, (p) => {
        const next = nextPhase(p);
        if (next === null) return true; // execution has no next — OK
        return SDD_PHASES.indexOf(next) > SDD_PHASES.indexOf(p);
      }),
      { numRuns: 100 },
    );
  });

  // Property 2: nextPhase('execution') === null always
  test("P2: nextPhase('execution') is always null", () => {
    fc.assert(
      fc.property(fc.constant("execution" as SddPhase), (p) => nextPhase(p) === null),
      { numRuns: 100 },
    );
  });

  // Property 3: applyPhaseApproval returns 'done' only for 'execution'
  test("P3: applyPhaseApproval → done only for execution", () => {
    fc.assert(
      fc.property(phaseArb, (p) => {
        const result = applyPhaseApproval(p);
        if (!result.ok) return false;
        if (result.nextState === "done") return p === "execution";
        return result.nextState === "agent_working";
      }),
      { numRuns: 100 },
    );
  });

  // Unit: R6 — approving requirements advances to design
  test("approving requirements → design (agent_working)", () => {
    const result = applyPhaseApproval("requirements");
    expect(result).toEqual({ ok: true, nextState: "agent_working", nextPhase: "design" });
  });

  // Unit: R6 — approving design advances to tasks
  test("approving design → tasks (agent_working)", () => {
    const result = applyPhaseApproval("design");
    expect(result).toEqual({ ok: true, nextState: "agent_working", nextPhase: "tasks" });
  });

  // Unit: R6 — approving tasks advances to execution
  test("approving tasks → execution (agent_working)", () => {
    const result = applyPhaseApproval("tasks");
    expect(result).toEqual({ ok: true, nextState: "agent_working", nextPhase: "execution" });
  });

  // Unit: R7 — approving execution → done
  test("approving execution → done", () => {
    const result = applyPhaseApproval("execution");
    expect(result).toEqual({ ok: true, nextState: "done", nextPhase: null });
  });

  // Unit: nextPhase correctness
  test("nextPhase sequence: requirements→design→tasks→execution→null", () => {
    expect(nextPhase("requirements")).toBe("design");
    expect(nextPhase("design")).toBe("tasks");
    expect(nextPhase("tasks")).toBe("execution");
    expect(nextPhase("execution")).toBe(null);
  });

  // Unit: isFinalPhase
  test("isFinalPhase is true only for execution", () => {
    expect(isFinalPhase("execution")).toBe(true);
    expect(isFinalPhase("requirements")).toBe(false);
    expect(isFinalPhase("design")).toBe(false);
    expect(isFinalPhase("tasks")).toBe(false);
  });

  // Unit: phaseLabel returns non-empty Spanish strings
  test("phaseLabel returns non-empty strings for all phases", () => {
    for (const p of SDD_PHASES) {
      const label = phaseLabel(p);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  // Unit: exactly 3 phases have a next
  test("exactly 3 phases have a next (not execution)", () => {
    const withNext = SDD_PHASES.filter((p) => nextPhase(p) !== null);
    expect(withNext.length).toBe(3);
  });
});
