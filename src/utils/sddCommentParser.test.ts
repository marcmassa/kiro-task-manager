import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { parseValidationComment, extractFeedback } from "./sddCommentParser";

const APPROVE_KEYWORDS = ["✅", "aprobado", "aprobada", "lgtm", "ok"];
const CHANGES_KEYWORDS = ["❌", "cambios:", "revisar:", "pedir cambios"];

describe("sddCommentParser — parseValidationComment", () => {
  // Property: strings that don't start with a keyword return null
  test("P: random strings without keyword return null", () => {
    // Filter out any accidental keyword starts
    const safeStr = fc.string({ minLength: 1 }).filter((s) => {
      const t = s.trim();
      return (
        !APPROVE_KEYWORDS.some((k) => t.toLowerCase().startsWith(k.toLowerCase())) &&
        !CHANGES_KEYWORDS.some((k) => t.toLowerCase().startsWith(k.toLowerCase()))
      );
    });
    fc.assert(
      fc.property(safeStr, (s) => parseValidationComment(s) === null),
      { numRuns: 100 },
    );
  });

  // Approval keywords
  for (const kw of APPROVE_KEYWORDS) {
    test(`"${kw}" → approve`, () => {
      expect(parseValidationComment(kw)).toBe("approve");
      expect(parseValidationComment(`${kw} some extra text`)).toBe("approve");
      expect(parseValidationComment(`  ${kw}  `)).toBe("approve"); // trimmed
    });
  }

  // Case-insensitive approval
  test("approval is case-insensitive", () => {
    expect(parseValidationComment("APROBADO")).toBe("approve");
    expect(parseValidationComment("LGTM")).toBe("approve");
    expect(parseValidationComment("OK")).toBe("approve");
  });

  // Changes keywords
  for (const kw of CHANGES_KEYWORDS) {
    test(`"${kw}" → request_changes`, () => {
      expect(parseValidationComment(`${kw} fix this`)).toBe("request_changes");
    });
  }

  // Null for unrelated text
  test("unrelated text → null", () => {
    expect(parseValidationComment("Hola, esto es un comentario normal")).toBe(null);
    expect(parseValidationComment("gracias por el trabajo")).toBe(null);
    expect(parseValidationComment("")).toBe(null);
  });
});

describe("sddCommentParser — extractFeedback", () => {
  test("extracts text after 'cambios:'", () => {
    expect(extractFeedback("cambios: añadir validación")).toBe("añadir validación");
  });

  test("extracts text after '❌'", () => {
    expect(extractFeedback("❌ el diseño no es correcto")).toBe("el diseño no es correcto");
  });

  test("extracts text after 'revisar:'", () => {
    expect(extractFeedback("revisar: la sección 3")).toBe("la sección 3");
  });

  test("returns empty string if no trailing text", () => {
    expect(extractFeedback("cambios:")).toBe("");
  });
});
