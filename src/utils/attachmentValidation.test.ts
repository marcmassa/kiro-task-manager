import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { MAX_ATTACHMENT_BYTES, ALLOWED_MIME, validateAttachment } from "./attachmentValidation";

// ---------------------------------------------------------------------------
// Property 4 — size > MAX ó mime ∉ ALLOWED ⇒ rechazo (R14)
// ---------------------------------------------------------------------------
describe("attachmentValidation — Property 4: rechazo por tamaño o tipo", () => {
  test("∀ size > MAX ⇒ ok === false (con mime válido)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_ATTACHMENT_BYTES + 1, max: MAX_ATTACHMENT_BYTES * 4 }),
        fc.constantFrom(...ALLOWED_MIME),
        (size, mime) => {
          expect(validateAttachment({ mime, size }).ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("∀ mime ∉ ALLOWED ⇒ ok === false (con tamaño válido)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !ALLOWED_MIME.includes(s)),
        fc.integer({ min: 1, max: MAX_ATTACHMENT_BYTES }),
        (mime, size) => {
          expect(validateAttachment({ mime, size }).ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("∀ mime ∈ ALLOWED y 0 < size ≤ MAX ⇒ ok === true", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_MIME),
        fc.integer({ min: 1, max: MAX_ATTACHMENT_BYTES }),
        (mime, size) => {
          expect(validateAttachment({ mime, size })).toEqual({ ok: true });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Units — límites exactos y tipos
// ---------------------------------------------------------------------------
describe("attachmentValidation — límites (units)", () => {
  test("tamaño exacto en el límite es válido", () => {
    expect(validateAttachment({ mime: "image/png", size: MAX_ATTACHMENT_BYTES })).toEqual({
      ok: true,
    });
  });

  test("un byte por encima del límite se rechaza", () => {
    expect(validateAttachment({ mime: "image/png", size: MAX_ATTACHMENT_BYTES + 1 }).ok).toBe(
      false,
    );
  });

  test("tamaño 0 se rechaza", () => {
    expect(validateAttachment({ mime: "image/png", size: 0 }).ok).toBe(false);
  });

  test("tamaño negativo se rechaza", () => {
    expect(validateAttachment({ mime: "image/png", size: -10 }).ok).toBe(false);
  });

  test("PDF permitido", () => {
    expect(validateAttachment({ mime: "application/pdf", size: 1024 })).toEqual({ ok: true });
  });

  test("ejecutable denegado", () => {
    expect(validateAttachment({ mime: "application/x-msdownload", size: 1024 }).ok).toBe(false);
  });
});
