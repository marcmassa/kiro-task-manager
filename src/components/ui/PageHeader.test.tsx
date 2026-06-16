import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "./PageHeader";
import { SectionHeader } from "./SectionHeader";

// ---------------------------------------------------------------------------
// Helpers
//
// Este repositorio no tiene una librería de testing de DOM, por lo que se
// reutiliza el patrón de `Badge.test.tsx` / `StatCard.test.tsx`: renderizar a
// un string de HTML con `renderToStaticMarkup` y verificar el markup con
// checks de string/regex.
// ---------------------------------------------------------------------------

/** Extrae el valor del atributo `class` del primer elemento que coincide con `tag`. */
function classNameOf(markup: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*\\bclass="([^"]*)"`).exec(markup);
  return match ? match[1] : "";
}

// ===========================================================================
// PageHeader — R9.3 / R9.4
// ===========================================================================

describe("PageHeader — R9.3: `<header>` sticky con desenfoque de superficie", () => {
  test("renderiza un elemento `<header>` como raíz", () => {
    const markup = renderToStaticMarkup(<PageHeader title="Estadísticas" subtitle="Resumen" />);
    expect(markup).toMatch(/^<header/);
  });

  test("el `<header>` aplica clases sticky y de desenfoque", () => {
    const markup = renderToStaticMarkup(<PageHeader title="Estadísticas" subtitle="Resumen" />);
    const classes = classNameOf(markup, "header").split(/\s+/);
    expect(classes).toContain("sticky");
    expect(classes).toContain("backdrop-blur-xl");
  });
});

describe("PageHeader — R9.4: título `<h1>` y subtítulo `<p>` en español", () => {
  test("renderiza el título dentro de un `<h1>`", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Estadísticas" subtitle="Resumen de tareas" />,
    );
    expect(markup).toMatch(/<h1[^>]*>Estadísticas<\/h1>/);
  });

  test("renderiza el subtítulo dentro de un `<p>`", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Estadísticas" subtitle="Resumen de tareas" />,
    );
    expect(markup).toMatch(/<p[^>]*>Resumen de tareas<\/p>/);
  });
});

// ===========================================================================
// SectionHeader — R9.2 / R9.5
// ===========================================================================

describe("SectionHeader — R9.2: `<h2>` con etiqueta en mayúsculas", () => {
  test("renderiza la etiqueta dentro de un `<h2>`", () => {
    const markup = renderToStaticMarkup(<SectionHeader label="Distribución" />);
    expect(markup).toMatch(/<h2[^>]*>Distribución<\/h2>/);
  });

  test("el `<h2>` aplica la clase `uppercase`", () => {
    const markup = renderToStaticMarkup(<SectionHeader label="Distribución" />);
    const classes = classNameOf(markup, "h2").split(/\s+/);
    expect(classes).toContain("uppercase");
  });
});

describe("SectionHeader — R9.5: punto de color con default `bg-accent`", () => {
  test("sin `dotColor`, el punto usa `bg-accent` por defecto", () => {
    const markup = renderToStaticMarkup(<SectionHeader label="Distribución" />);
    const classes = classNameOf(markup, "span").split(/\s+/);
    expect(classes).toContain("bg-accent");
  });

  test("un `dotColor` personalizado se aplica al punto", () => {
    const markup = renderToStaticMarkup(
      <SectionHeader label="Distribución" dotColor="bg-success" />,
    );
    const classes = classNameOf(markup, "span").split(/\s+/);
    expect(classes).toContain("bg-success");
    expect(classes).not.toContain("bg-accent");
  });
});
