import { describe, test, expect } from "bun:test";
// @ts-expect-error — tailwind.config.js es un módulo JS sin tipos declarados
import tailwindConfig from "./tailwind.config.js";

// ---------------------------------------------------------------------------
// Test estático de presencia de tokens de diseño (R1.1, R1.5)
//
// Verifica que tailwind.config.js declara las escalas de color y las claves de
// sombra/tipografía que la Component_Library consume como fuente única de
// verdad. Si un token desaparece o se renombra, este test falla antes de que
// los componentes rompan en tiempo de ejecución.
// ---------------------------------------------------------------------------

const extend = tailwindConfig?.theme?.extend ?? {};

describe("tailwind.config — presencia de tokens de diseño", () => {
  const colorScales = ["surface", "accent", "success", "warning", "danger", "muted"];

  describe("escalas de color (R1.1)", () => {
    test.each(colorScales)("define la escala de color '%s'", (scale) => {
      expect(extend.colors).toBeDefined();
      expect(extend.colors[scale]).toBeDefined();
    });
  });

  describe("claves de sombra (R1.5)", () => {
    test("define boxShadow.card", () => {
      expect(extend.boxShadow).toBeDefined();
      expect(extend.boxShadow.card).toBeDefined();
    });

    test("define boxShadow.modal", () => {
      expect(extend.boxShadow).toBeDefined();
      expect(extend.boxShadow.modal).toBeDefined();
    });
  });

  describe("tipografía (R1.5)", () => {
    test("define fontFamily.sans", () => {
      expect(extend.fontFamily).toBeDefined();
      expect(extend.fontFamily.sans).toBeDefined();
    });
  });
});
