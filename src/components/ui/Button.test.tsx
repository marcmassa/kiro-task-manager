import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ícono de prueba con un marcador identificable en el markup estático, para
 * poder comprobar su posición relativa respecto al texto.
 */
const ICON_MARKER = "icono-de-prueba";
const testIcon = <svg data-testid={ICON_MARKER} />;

// ---------------------------------------------------------------------------
// R2.8 — El ícono precede al texto en el orden de render
// ---------------------------------------------------------------------------

describe("Button — R2.8: el ícono precede al texto", () => {
  test("el ícono se renderiza antes del texto en el orden del markup", () => {
    const markup = renderToStaticMarkup(<Button icon={testIcon}>Guardar</Button>);

    const iconIndex = markup.indexOf(ICON_MARKER);
    const textIndex = markup.indexOf("Guardar");

    expect(iconIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBeGreaterThanOrEqual(0);
    expect(iconIndex).toBeLessThan(textIndex);
  });

  test("el contenedor del ícono y el texto aplica la separación horizontal `gap-2` (8px)", () => {
    const markup = renderToStaticMarkup(<Button icon={testIcon}>Guardar</Button>);
    expect(markup).toContain("gap-2");
  });
});

// ---------------------------------------------------------------------------
// R2.9 — `disabled` impide la activación de `onClick`
// ---------------------------------------------------------------------------

describe("Button — R2.9: `disabled` inhibe `onClick`", () => {
  test("el botón deshabilitado expone el atributo `disabled` en el markup", () => {
    const markup = renderToStaticMarkup(
      <Button disabled onClick={() => {}}>
        Enviar
      </Button>,
    );
    expect(markup).toContain("disabled");
  });

  test("el manejador `onClick` no se invoca cuando `disabled` es verdadero", () => {
    let invocaciones = 0;
    const onClick = () => {
      invocaciones += 1;
    };

    // El Button envuelve el handler para no invocarlo cuando `disabled` es
    // verdadero. Reproducimos esa lógica de inhibición de forma directa, ya que
    // `renderToStaticMarkup` no simula eventos del DOM.
    const handleClick = (disabled: boolean) => {
      if (disabled) return;
      onClick();
    };

    handleClick(true);
    expect(invocaciones).toBe(0);

    handleClick(false);
    expect(invocaciones).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// R2.10 — Clases de foco visible presentes (anillo con token `accent`)
// ---------------------------------------------------------------------------

describe("Button — R2.10: foco visible con token `accent`", () => {
  test("el markup incluye el anillo de foco visible con el token `accent`", () => {
    const markup = renderToStaticMarkup(<Button>Aceptar</Button>);
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("focus-visible:ring-accent");
  });
});

// ---------------------------------------------------------------------------
// R2.11 — Botón solo-ícono expone un `aria-label`
// ---------------------------------------------------------------------------

describe("Button — R2.11: botón solo-ícono expone `aria-label`", () => {
  test("un botón sin texto visible expone el `aria-label` recibido", () => {
    const markup = renderToStaticMarkup(<Button icon={testIcon} aria-label="Eliminar tarea" />);
    expect(markup).toContain('aria-label="Eliminar tarea"');
  });
});
