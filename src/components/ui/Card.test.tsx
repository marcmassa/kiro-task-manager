import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { Card } from "./Card";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Conjunto de elementos HTML válidos que un consumidor puede pasar a `as`. */
const VALID_TAGS = ["div", "section", "article", "aside", "main", "header", "footer"] as const;

type ValidTag = (typeof VALID_TAGS)[number];

/**
 * Extrae el nombre de etiqueta del elemento raíz del markup estático generado
 * por `renderToStaticMarkup` (p. ej. `<section class="...">...</section>` → `"section"`).
 */
function rootTagName(markup: string): string | null {
  const match = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(markup);
  return match ? match[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Property 7: Card respeta el elemento `as`
// Validates: Requirements 4.3, 4.4
// ---------------------------------------------------------------------------

describe("Card — Property 7: respeta el elemento `as`", () => {
  test("para cualquier etiqueta válida, el elemento raíz coincide con `as`", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_TAGS), (tag: ValidTag) => {
        const markup = renderToStaticMarkup(<Card as={tag}>contenido</Card>);
        expect(rootTagName(markup)).toBe(tag);
      }),
      { numRuns: 100 },
    );
  });

  test("cuando `as` se omite, el elemento raíz es un `div`", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const markup = renderToStaticMarkup(<Card>contenido</Card>);
        expect(rootTagName(markup)).toBe("div");
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Ejemplos: padding (R4.1, R4.2, R4.3)
// ---------------------------------------------------------------------------

describe("Card — padding", () => {
  test('padding="compacto" aplica la clase p-4', () => {
    const markup = renderToStaticMarkup(<Card padding="compacto">contenido</Card>);
    expect(markup).toContain("p-4");
    expect(markup).not.toContain("p-6");
  });

  test('padding="estandar" aplica la clase p-6', () => {
    const markup = renderToStaticMarkup(<Card padding="estandar">contenido</Card>);
    expect(markup).toContain("p-6");
    expect(markup).not.toContain("p-4");
  });

  test("sin prop padding (default) aplica la clase p-6", () => {
    const markup = renderToStaticMarkup(<Card>contenido</Card>);
    expect(markup).toContain("p-6");
    expect(markup).not.toContain("p-4");
  });
});

// ---------------------------------------------------------------------------
// Ejemplos: superficie y hover de borde (R4.1, R4.7)
// ---------------------------------------------------------------------------

describe("Card — superficie y hover de borde", () => {
  test("aplica el borde sutil inicial white/5", () => {
    const markup = renderToStaticMarkup(<Card>contenido</Card>);
    expect(markup).toContain("border-white/5");
  });

  test("aplica la clase de hover de borde hover:border-white/10", () => {
    const markup = renderToStaticMarkup(<Card>contenido</Card>);
    expect(markup).toContain("hover:border-white/10");
  });
});

// ---------------------------------------------------------------------------
// Ejemplos: orden de hijos preservado (R4.8)
// ---------------------------------------------------------------------------

describe("Card — orden de hijos", () => {
  test("renderiza múltiples hijos en el mismo orden recibido", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <span>uno</span>
        <span>dos</span>
        <span>tres</span>
      </Card>,
    );
    const posUno = markup.indexOf("uno");
    const posDos = markup.indexOf("dos");
    const posTres = markup.indexOf("tres");

    expect(posUno).toBeGreaterThanOrEqual(0);
    expect(posDos).toBeGreaterThan(posUno);
    expect(posTres).toBeGreaterThan(posDos);
  });
});
