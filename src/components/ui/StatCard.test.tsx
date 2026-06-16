import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCard } from "./StatCard";

// ---------------------------------------------------------------------------
// Helpers
//
// Este repositorio no tiene una librería de testing de DOM, por lo que se
// reutiliza el patrón de `Badge.test.tsx` / `ProgressBar.test.tsx`: renderizar
// a un string de HTML con `renderToStaticMarkup` y verificar el markup con
// checks de string/regex.
// ---------------------------------------------------------------------------

/** Ícono de prueba con un marcador identificable en el markup estático. */
const ICON_MARKER = "icono";
const testIcon = <svg data-testid={ICON_MARKER} />;

// ---------------------------------------------------------------------------
// R5.1 / R5.6 — Muestra etiqueta, valor e ícono sobre la superficie
// ---------------------------------------------------------------------------

describe("StatCard — R5.1: muestra etiqueta, valor e ícono", () => {
  test("renderiza la etiqueta, el valor y el ícono provistos", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        value={42}
        label="Total de tareas"
        icon={testIcon}
        color="accent"
        aria-label="Total de tareas: 42"
      />,
    );

    expect(markup).toContain("42");
    expect(markup).toContain("Total de tareas");
    expect(markup).toContain(`data-testid="${ICON_MARKER}"`);
  });
});

describe("StatCard — R5.6: superficie `home-stat-card`", () => {
  test("aplica la clase `home-stat-card` al contenedor raíz", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        value={42}
        label="Total de tareas"
        icon={testIcon}
        color="accent"
        aria-label="Total de tareas: 42"
      />,
    );

    expect(markup).toContain("home-stat-card");
  });
});

// ---------------------------------------------------------------------------
// R5.4 — `aria-label` expone la métrica de forma legible
// ---------------------------------------------------------------------------

describe("StatCard — R5.4: `aria-label` legible de la métrica", () => {
  test("el `aria-label` recibido se expone en el elemento raíz", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        value={42}
        label="Total de tareas"
        icon={testIcon}
        color="accent"
        aria-label="Total de tareas: 42"
      />,
    );

    expect(markup).toContain('aria-label="Total de tareas: 42"');
  });
});

// ---------------------------------------------------------------------------
// R5.5 — `progressPercent` controla el render del ProgressBar
// ---------------------------------------------------------------------------

describe("StatCard — R5.5: render condicional del ProgressBar", () => {
  test("`progressPercent={0}` renderiza un ProgressBar vacío (0%)", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        value={0}
        label="Completadas"
        icon={testIcon}
        color="success"
        aria-label="Completadas: 0"
        progressPercent={0}
      />,
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain("width:0%");
  });

  test("sin `progressPercent` no se renderiza ningún ProgressBar", () => {
    const markup = renderToStaticMarkup(
      <StatCard
        value={42}
        label="Total de tareas"
        icon={testIcon}
        color="accent"
        aria-label="Total de tareas: 42"
      />,
    );

    expect(markup).not.toContain('role="progressbar"');
  });
});
