import { describe, expect, test } from "bun:test";
import { sddPhaseStyle } from "./sddPhaseDisplay";
import { SDD_PHASES } from "./sddLifecycle";

describe("sddPhaseDisplay", () => {
  for (const phase of SDD_PHASES) {
    test(`${phase}: working mode returns non-empty badge and headerColor`, () => {
      const style = sddPhaseStyle(phase, false);
      expect(typeof style.badge).toBe("string");
      expect(style.badge.length).toBeGreaterThan(0);
      expect(typeof style.headerColor).toBe("string");
      expect(style.headerColor.length).toBeGreaterThan(0);
      expect(typeof style.dot).toBe("string");
      expect(style.dot.length).toBeGreaterThan(0);
    });

    test(`${phase}: review mode returns non-empty badge and headerColor`, () => {
      const style = sddPhaseStyle(phase, true);
      expect(typeof style.badge).toBe("string");
      expect(style.badge.length).toBeGreaterThan(0);
      expect(typeof style.headerColor).toBe("string");
      expect(style.headerColor.length).toBeGreaterThan(0);
    });

    test(`${phase}: review vs working produce different badge classes`, () => {
      const working = sddPhaseStyle(phase, false);
      const review = sddPhaseStyle(phase, true);
      expect(working.badge).not.toBe(review.badge);
    });
  }
});
