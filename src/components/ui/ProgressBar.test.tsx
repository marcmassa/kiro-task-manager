import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressBar } from "./ProgressBar";

// ---------------------------------------------------------------------------
// Helpers
//
// Este repositorio no tiene una librería de testing de DOM, por lo que se
// reutiliza el patrón de `Badge.test.tsx` / `Card.test.tsx`: renderizar a un
// string de HTML con `renderToStaticMarkup` y verificar el markup con
// regex/checks de string.
// ---------------------------------------------------------------------------

/** Extrae el valor numérico de `aria-valuenow` del markup estático. */
function ariaValueNow(markup: string): string | null {
  const match = /aria-valuenow="([^"]*)"/.exec(markup);
  return match ? match[1] : null;
}

/** Extrae el valor de `width` del estilo inline del relleno (p. ej. `42%`). */
function fillWidth(markup: string): string | null {
  const match = /width:\s*([^;"]+)/.exec(markup);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// R6.6 — Atributos ARIA de progressbar SIEMPRE presentes
// ---------------------------------------------------------------------------

describe("ProgressBar — atributos ARIA de progressbar (R6.6)", () => {
  test("expone `role=progressbar`, `aria-valuemin=0` y `aria-valuemax=100` siempre", () => {
    for (const value of [0, 25, 50, 75, 100, -10, 150, NaN]) {
      const markup = renderToStaticMarkup(<ProgressBar value={value} />);
      expect(markup).toContain('role="progressbar"');
      expect(markup).toContain('aria-valuemin="0"');
      expect(markup).toContain('aria-valuemax="100"');
    }
  });

  test("`aria-valuenow` refleja el valor limitado para un valor en rango", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={42} />);
    expect(ariaValueNow(markup)).toBe("42");
  });

  test("`aria-valuenow` coincide con el ancho del relleno", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={73} />);
    expect(ariaValueNow(markup)).toBe("73");
    expect(fillWidth(markup)).toBe("73%");
  });
});

// ---------------------------------------------------------------------------
// R6.7 / R6.8 — Transición desactivada bajo prefers-reduced-motion
// ---------------------------------------------------------------------------

describe("ProgressBar — respeto de prefers-reduced-motion (R6.7, R6.8)", () => {
  test("el relleno incluye la clase `motion-reduce:transition-none`", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={50} />);
    expect(markup).toContain("motion-reduce:transition-none");
  });

  test("la clase de transición de ancho de 300ms está presente", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={50} />);
    expect(markup).toContain("transition-[width]");
    expect(markup).toContain("duration-300");
  });
});

// ---------------------------------------------------------------------------
// R6.6 — Valores fuera de rango / NaN reflejados como 0 o 100
// ---------------------------------------------------------------------------

describe("ProgressBar — valores fuera de rango y NaN (R6.6)", () => {
  test("un valor negativo se limita a 0 en ancho y en `aria-valuenow`", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={-10} />);
    expect(fillWidth(markup)).toBe("0%");
    expect(ariaValueNow(markup)).toBe("0");
  });

  test("un valor mayor que 100 se limita a 100 en ancho y en `aria-valuenow`", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={150} />);
    expect(fillWidth(markup)).toBe("100%");
    expect(ariaValueNow(markup)).toBe("100");
  });

  test("`NaN` se refleja como 0 en ancho y en `aria-valuenow`", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={NaN} />);
    expect(fillWidth(markup)).toBe("0%");
    expect(ariaValueNow(markup)).toBe("0");
  });

  test("los límites exactos 0 y 100 se conservan", () => {
    const cero = renderToStaticMarkup(<ProgressBar value={0} />);
    expect(fillWidth(cero)).toBe("0%");
    expect(ariaValueNow(cero)).toBe("0");

    const cien = renderToStaticMarkup(<ProgressBar value={100} />);
    expect(fillWidth(cien)).toBe("100%");
    expect(ariaValueNow(cien)).toBe("100");
  });
});
