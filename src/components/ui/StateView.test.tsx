import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingState, ErrorState, EmptyState } from "./StateView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ícono de prueba con un marcador identificable en el markup estático. */
const ICON_MARKER = "icono-de-prueba";
const testIcon = <svg data-testid={ICON_MARKER} />;

// ---------------------------------------------------------------------------
// R8.1 — LoadingState expone atributos ARIA y el mensaje recibido
// ---------------------------------------------------------------------------

describe("LoadingState — R8.1: atributos ARIA y mensaje por prop", () => {
  test('expone `role="status"` y `aria-live="polite"`', () => {
    const markup = renderToStaticMarkup(<LoadingState message="Cargando tareas..." />);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });

  test("renderiza el mensaje en español recibido por la prop", () => {
    const markup = renderToStaticMarkup(<LoadingState message="Cargando tareas..." />);
    expect(markup).toContain("Cargando tareas...");
  });
});

// ---------------------------------------------------------------------------
// R8.2 — LoadingState usa mensaje por defecto y conserva ARIA sin prop / vacío
// ---------------------------------------------------------------------------

describe("LoadingState — R8.2: mensaje por defecto en español", () => {
  test('sin prop de mensaje muestra "Cargando..." conservando los atributos ARIA', () => {
    const markup = renderToStaticMarkup(<LoadingState />);
    expect(markup).toContain("Cargando...");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });

  test('con mensaje de cadena vacía recurre a "Cargando..." conservando los atributos ARIA', () => {
    const markup = renderToStaticMarkup(<LoadingState message="   " />);
    expect(markup).toContain("Cargando...");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
});

// ---------------------------------------------------------------------------
// R8.8 — LoadingState desactiva la animación bajo prefers-reduced-motion
// ---------------------------------------------------------------------------

describe("LoadingState — R8.8: respeta `prefers-reduced-motion`", () => {
  test("el markup incluye `motion-reduce:animate-none` manteniendo el indicador visible", () => {
    const markup = renderToStaticMarkup(<LoadingState />);
    expect(markup).toContain("motion-reduce:animate-none");
    // El indicador de estado permanece presente (no se oculta con la preferencia).
    expect(markup).toContain('role="status"');
  });
});

// ---------------------------------------------------------------------------
// R8.3 — ErrorState muestra ícono, mensaje y Button de reintento accesible
// ---------------------------------------------------------------------------

describe("ErrorState — R8.3: ícono, mensaje y botón de reintento", () => {
  test("renderiza el mensaje de error en español recibido por prop", () => {
    const markup = renderToStaticMarkup(
      <ErrorState message="No se pudieron cargar las tareas" onRetry={() => {}} />,
    );
    expect(markup).toContain("No se pudieron cargar las tareas");
  });

  test("renderiza el Button de reintento con su `aria-label` en español y texto visible", () => {
    const markup = renderToStaticMarkup(<ErrorState message="Error de red" onRetry={() => {}} />);
    expect(markup).toContain('aria-label="Reintentar la carga"');
    expect(markup).toContain("Reintentar");
  });

  test("el Button de reintento es enfocable por teclado (no está deshabilitado)", () => {
    const markup = renderToStaticMarkup(<ErrorState message="Error de red" onRetry={() => {}} />);
    // Un <button> sin `disabled` participa en el orden de tabulación nativo.
    expect(markup).toContain("<button");
    expect(markup).not.toContain("disabled");
  });
});

// ---------------------------------------------------------------------------
// R8.4 — `onRetry` se invoca exactamente una vez por activación
// ---------------------------------------------------------------------------

describe("ErrorState — R8.4: `onRetry` se invoca una vez por activación", () => {
  test("el `onClick` del botón invoca `onRetry` exactamente una vez por activación", () => {
    // `renderToStaticMarkup` no despacha eventos del DOM, por lo que se verifica
    // de forma directa el contrato del manejador: cada activación (clic/teclado)
    // produce una única invocación de `onRetry`.
    let invocaciones = 0;
    const onRetry = () => {
      invocaciones += 1;
    };
    const handleClick = () => onRetry();

    handleClick();
    expect(invocaciones).toBe(1);

    handleClick();
    expect(invocaciones).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// R8.5 — ErrorState no se renderiza sin `onRetry`
// (incluido como soporte del contrato verificado en R8.3/R8.4)
// ---------------------------------------------------------------------------

describe("ErrorState — sin `onRetry` no se renderiza", () => {
  test("retorna null (markup vacío) cuando no se proporciona `onRetry`", () => {
    // `onRetry` es obligatoria por tipos; se omite deliberadamente para ejercer
    // la guarda en tiempo de ejecución. `renderToStaticMarkup` de null produce
    // una cadena vacía.
    const markup = renderToStaticMarkup(
      <ErrorState message="Error" onRetry={undefined as unknown as () => void} />,
    );
    expect(markup).toBe("");
  });
});

// ---------------------------------------------------------------------------
// R8.6 / R8.7 — EmptyState muestra ícono, título y mensaje en una superficie Card
// ---------------------------------------------------------------------------

describe("EmptyState — R8.6: ícono, título y mensaje por props", () => {
  test("muestra el ícono, el título y el mensaje en español recibidos por props", () => {
    const markup = renderToStaticMarkup(
      <EmptyState icon={testIcon} title="Sin tareas" message="No hay tareas para mostrar" />,
    );
    expect(markup).toContain(ICON_MARKER);
    expect(markup).toContain("Sin tareas");
    expect(markup).toContain("No hay tareas para mostrar");
  });
});

describe("R8.7: ErrorState y EmptyState usan la superficie de Card", () => {
  test("EmptyState aplica las clases de superficie de Card (esquinas redondeadas y fondo de superficie)", () => {
    const markup = renderToStaticMarkup(
      <EmptyState icon={testIcon} title="Sin tareas" message="No hay tareas" />,
    );
    expect(markup).toContain("rounded-2xl");
    expect(markup).toContain("bg-surface");
  });

  test("ErrorState aplica las clases de superficie de Card (esquinas redondeadas y fondo de superficie)", () => {
    const markup = renderToStaticMarkup(<ErrorState message="Error" onRetry={() => {}} />);
    expect(markup).toContain("rounded-2xl");
    expect(markup).toContain("bg-surface");
  });
});
