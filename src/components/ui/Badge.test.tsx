import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "./Badge";
import type { BadgeVariant } from "../../utils/uiVariants";

// ---------------------------------------------------------------------------
// Helpers
//
// Este repositorio no tiene una librería de testing de DOM, por lo que se
// reutiliza el patrón de `Card.test.tsx`: renderizar a un string de HTML con
// `renderToStaticMarkup` y verificar el markup con regex/checks de string.
// ---------------------------------------------------------------------------

/** Las cinco variantes válidas que acepta el Badge (R3.2). */
const VALID_VARIANTS: BadgeVariant[] = ["neutral", "accent", "success", "warning", "danger"];

/**
 * Extrae el valor del atributo `class` del elemento raíz del markup estático
 * (p. ej. `<span class="badge whitespace-normal ...">...</span>`).
 */
function rootClassName(markup: string): string {
  const match = /^<span class="([^"]*)"/.exec(markup);
  return match ? match[1] : "";
}

// ---------------------------------------------------------------------------
// R3.1 — La clase base `badge` está SIEMPRE presente
// ---------------------------------------------------------------------------

describe("Badge — clase base `badge` (R3.1)", () => {
  test("la clase base `badge` está presente en cada una de las cinco variantes", () => {
    for (const variant of VALID_VARIANTS) {
      const markup = renderToStaticMarkup(<Badge variant={variant}>etiqueta</Badge>);
      const classes = rootClassName(markup).split(/\s+/);
      expect(classes).toContain("badge");
    }
  });

  test("la clase base `badge` está presente cuando no se proporciona `variant`", () => {
    const markup = renderToStaticMarkup(<Badge>etiqueta</Badge>);
    const classes = rootClassName(markup).split(/\s+/);
    expect(classes).toContain("badge");
  });
});

// ---------------------------------------------------------------------------
// R3.4 — Contenido textual completo, sin truncar
// ---------------------------------------------------------------------------

describe("Badge — contenido textual completo sin truncar (R3.4)", () => {
  const longText =
    "Esta es una etiqueta con un texto deliberadamente largo que debería " +
    "renderizarse completo y ajustarse en varias líneas sin recortarse ni " +
    "mostrar puntos suspensivos";

  test("renderiza el texto largo completo, sin recortarlo", () => {
    const markup = renderToStaticMarkup(<Badge>{longText}</Badge>);
    expect(markup).toContain(longText);
  });

  test("no aplica clases de truncado (`truncate` ni `text-ellipsis`)", () => {
    const markup = renderToStaticMarkup(<Badge>{longText}</Badge>);
    const classes = rootClassName(markup).split(/\s+/);
    expect(classes).not.toContain("truncate");
    expect(classes).not.toContain("text-ellipsis");
  });

  test("aplica `whitespace-normal` para permitir el ajuste multilínea", () => {
    const markup = renderToStaticMarkup(<Badge>{longText}</Badge>);
    const classes = rootClassName(markup).split(/\s+/);
    expect(classes).toContain("whitespace-normal");
  });
});

// ---------------------------------------------------------------------------
// R3.2 / R3.7 — Default neutral y reserva ante variante inválida
// ---------------------------------------------------------------------------

describe("Badge — variante por defecto y reserva (R3.2, R3.7)", () => {
  // Clases de color de cada variante con color propio. `neutral` se trata por
  // separado porque es justamente el comportamiento de reserva.
  const COLORED_VARIANT_CLASSES = [
    "bg-accent/15",
    "text-accent-300",
    "bg-success/15",
    "text-success-300",
    "bg-warning/15",
    "text-warning-300",
    "bg-danger/15",
    "text-danger-300",
  ];

  test("sin prop `variant`, aplica el estilo neutral (`bg-white/5 text-muted-300`)", () => {
    const markup = renderToStaticMarkup(<Badge>etiqueta</Badge>);
    const classes = rootClassName(markup).split(/\s+/);
    expect(classes).toContain("bg-white/5");
    expect(classes).toContain("text-muted-300");
  });

  test("la variante explícita `neutral` produce el mismo estilo que el default", () => {
    const conProp = rootClassName(renderToStaticMarkup(<Badge variant="neutral">x</Badge>));
    const sinProp = rootClassName(renderToStaticMarkup(<Badge>x</Badge>));
    expect(conProp).toBe(sinProp);
  });

  // Para probar un valor de variante no admitido respetando TypeScript, se
  // castea una cadena arbitraria a `BadgeVariant`. El cast documenta que es un
  // caso de uso indebido que el componente debe tolerar sin romperse.
  test("una variante no reconocida no rompe el render y conserva el contenido", () => {
    const invalid = "morado" as BadgeVariant;
    const markup = renderToStaticMarkup(<Badge variant={invalid}>contenido visible</Badge>);
    expect(markup).toContain("contenido visible");
    const classes = rootClassName(markup).split(/\s+/);
    expect(classes).toContain("badge");
  });

  test("una variante no reconocida no aplica colores de otra variante (reserva al estilo base)", () => {
    const invalid = "morado" as BadgeVariant;
    const markup = renderToStaticMarkup(<Badge variant={invalid}>contenido</Badge>);
    const classes = rootClassName(markup).split(/\s+/);
    for (const colored of COLORED_VARIANT_CLASSES) {
      expect(classes).not.toContain(colored);
    }
  });
});
