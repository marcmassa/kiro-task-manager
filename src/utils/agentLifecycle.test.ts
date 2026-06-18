import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import {
  AGENT_STATES,
  TRANSITIONS,
  canTransition,
  applyTransition,
  type AgentState,
  type Actor,
} from "./agentLifecycle";

const stateArb = fc.constantFrom<AgentState>(...AGENT_STATES);
const actorArb = fc.constantFrom<Actor>("human", "agent");

// ---------------------------------------------------------------------------
// Property 1 — El gate humano: un agente NUNCA puede llegar a "done" (R8/R18)
// ---------------------------------------------------------------------------
describe("agentLifecycle — Property 1: el agente nunca alcanza 'done'", () => {
  test("∀ estado origen, canTransition(s, 'done', 'agent') === false", () => {
    fc.assert(
      fc.property(stateArb, (from) => {
        expect(canTransition(from, "done", "agent")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test("ninguna transición declarada lleva a 'done' con actor 'agent'", () => {
    const offending = TRANSITIONS.filter((t) => t.to === "done" && t.actor === "agent");
    expect(offending).toEqual([]);
  });

  test("applyTransition a 'done' como agente siempre falla", () => {
    fc.assert(
      fc.property(stateArb, (from) => {
        const result = applyTransition(from, "done", "agent");
        expect(result.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Transición fuera de la tabla ⇒ rechazo, estado intacto (R12/R20)
// ---------------------------------------------------------------------------
describe("agentLifecycle — Property 2: transición no declarada se rechaza", () => {
  test("∀ (from,to,actor) no en TRANSITIONS ⇒ applyTransition.ok === false", () => {
    fc.assert(
      fc.property(stateArb, stateArb, actorArb, (from, to, actor) => {
        const declared = TRANSITIONS.some(
          (t) => t.from === from && t.to === to && t.actor === actor,
        );
        const result = applyTransition(from, to, actor);
        if (!declared) {
          expect(result.ok).toBe(false);
        } else {
          expect(result).toEqual({ ok: true, next: to });
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — El grafo solo usa los 5 estados declarados (R5)
// ---------------------------------------------------------------------------
describe("agentLifecycle — Property 3: solo 5 estados", () => {
  test("AGENT_STATES tiene exactamente los 5 estados del ciclo", () => {
    expect([...AGENT_STATES].sort()).toEqual(
      (["agent_working", "assigned", "changes_requested", "done", "pending_review"] as const)
        .slice()
        .sort(),
    );
  });

  test("toda transición referencia estados declarados", () => {
    for (const t of TRANSITIONS) {
      expect(AGENT_STATES).toContain(t.from);
      expect(AGENT_STATES).toContain(t.to);
    }
  });
});

// ---------------------------------------------------------------------------
// Units — cada transición válida (R6, R7, R9, R10, R11)
// ---------------------------------------------------------------------------
describe("agentLifecycle — transiciones válidas (units)", () => {
  test("R6: assigned → agent_working (agente)", () => {
    expect(applyTransition("assigned", "agent_working", "agent")).toEqual({
      ok: true,
      next: "agent_working",
    });
  });

  test("R7: agent_working → pending_review (agente)", () => {
    expect(applyTransition("agent_working", "pending_review", "agent")).toEqual({
      ok: true,
      next: "pending_review",
    });
  });

  test("R9: pending_review → done (humano)", () => {
    expect(applyTransition("pending_review", "done", "human")).toEqual({
      ok: true,
      next: "done",
    });
  });

  test("R10: pending_review → changes_requested (humano)", () => {
    expect(applyTransition("pending_review", "changes_requested", "human")).toEqual({
      ok: true,
      next: "changes_requested",
    });
  });

  test("R11: changes_requested → agent_working (agente)", () => {
    expect(applyTransition("changes_requested", "agent_working", "agent")).toEqual({
      ok: true,
      next: "agent_working",
    });
  });

  test("un humano no puede reclamar (assigned → agent_working con human)", () => {
    expect(applyTransition("assigned", "agent_working", "human").ok).toBe(false);
  });
});
