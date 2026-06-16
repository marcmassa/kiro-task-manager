import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Guardas estáticos / smoke de la biblioteca de componentes UI
//
// Estos tests leen los archivos fuente desde disco y verifican invariantes
// estructurales del Sistema de Diseño que no se pueden comprobar renderizando:
//  - Sin literales hexadecimales en los componentes (R1.3)
//  - Independencia del dominio: sin imports de tipos de dominio (R11.6, R13.3)
//  - Sin dependencias de librerías de UI externas en package.json (R13.5)
//  - La Guía de Estilos cubre el 100% de los componentes (R11)
// ---------------------------------------------------------------------------

/** Directorio de la biblioteca (este archivo vive dentro de `ui/`). */
const UI_DIR = import.meta.dir;
/** Raíz del paquete `task-manager/` (tres niveles arriba de `ui/`). */
const PACKAGE_ROOT = join(UI_DIR, "..", "..", "..");

/**
 * Devuelve los archivos `.tsx` de la biblioteca excluyendo los de test
 * (`*.test.tsx`). Se globa dinámicamente para que nuevos componentes queden
 * cubiertos automáticamente.
 */
function listComponentFiles(): string[] {
  return readdirSync(UI_DIR)
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .sort();
}

function readComponent(name: string): string {
  return readFileSync(join(UI_DIR, name), "utf8");
}

describe("Guardas estáticos de la biblioteca UI", () => {
  test("existe al menos un componente .tsx para escanear", () => {
    expect(listComponentFiles().length).toBeGreaterThan(0);
  });

  describe("R1.3 — sin literales hexadecimales de color en ui/*.tsx", () => {
    // `#` seguido de 3 a 8 dígitos hex, con límite de palabra al final para no
    // capturar identificadores más largos.
    const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;

    for (const name of listComponentFiles()) {
      test(`${name} no contiene literales hex`, () => {
        const source = readComponent(name);
        const match = source.match(HEX_LITERAL);
        expect(match).toBeNull();
      });
    }
  });

  describe("R11.6 / R13.3 — independencia del dominio en ui/*.tsx", () => {
    // Imports que acoplarían un componente al dominio de tareas.
    const DOMAIN_IMPORT = /import[^;]*from\s*["'](?:\.\.\/)+types["']/;
    const TASK_TYPE_IMPORT = /import\s*(?:type\s*)?\{[^}]*\bTask\b[^}]*\}/;

    for (const name of listComponentFiles()) {
      test(`${name} no importa tipos de dominio`, () => {
        const source = readComponent(name);
        expect(DOMAIN_IMPORT.test(source)).toBe(false);
        expect(TASK_TYPE_IMPORT.test(source)).toBe(false);
      });
    }
  });

  test("R13.5 — package.json sin dependencias de UI externas", () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = Object.keys({
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    });

    // Patrones de librerías de UI prohibidas (R13.5: solo React + Tailwind + SVG nativo).
    const forbidden = [
      /^@mui\//,
      /^@material-ui\//,
      /^antd$/,
      /^chakra-ui$/,
      /^@chakra-ui\//,
      /^bootstrap$/,
      /^react-bootstrap$/,
      /^styled-components$/,
      /^@emotion\//,
      /^flowbite/,
      /^daisyui$/,
    ];

    const offending = allDeps.filter((dep) => forbidden.some((re) => re.test(dep)));
    expect(offending).toEqual([]);
  });

  test("R11 — STYLEGUIDE.md cubre todos los componentes de la biblioteca", () => {
    const styleguide = readFileSync(join(UI_DIR, "STYLEGUIDE.md"), "utf8");

    // Cada componente exportado por la biblioteca debe tener una entrada propia.
    // StateView agrupa tres componentes en un archivo, por lo que la cobertura
    // se mide por componente, no por archivo.
    const requiredComponents = [
      "Button",
      "Badge",
      "Card",
      "StatCard",
      "ProgressBar",
      "DataTable",
      "LoadingState",
      "ErrorState",
      "EmptyState",
      "PageHeader",
      "SectionHeader",
    ];

    const missing = requiredComponents.filter((component) => {
      const heading = new RegExp(`^##\\s+${component}\\s*$`, "m");
      return !heading.test(styleguide);
    });

    expect(missing).toEqual([]);
  });
});
