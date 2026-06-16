import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { encryptApiKey, decryptApiKey } from "./crypto";

describe("crypto round-trip", () => {
  test("ASCII", async () => {
    const x = "lin_api_abcdef1234567890";
    expect(await decryptApiKey(await encryptApiKey(x))).toBe(x);
  });

  test("UTF-8 multibyte", async () => {
    const x = "lín_äpí_tëst_ñ_🤖";
    expect(await decryptApiKey(await encryptApiKey(x))).toBe(x);
  });

  test("empty string is a no-op", async () => {
    const x = "";
    expect(await encryptApiKey(x)).toBe("");
    expect(await decryptApiKey(x)).toBe("");
  });

  test("property: any string round-trips", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (s) => {
        const cipher = await encryptApiKey(s);
        const plain = await decryptApiKey(cipher);
        return plain === s;
      }),
      { numRuns: 100 },
    );
  });

  test("ciphertext does not contain plaintext for non-empty input", async () => {
    const x = "lin_api_very_secret_1234567890";
    const c = await encryptApiKey(x);
    expect(c).not.toContain(x);
  });

  test("tampered ciphertext is rejected by the auth tag", async () => {
    const x = "lin_api_tamper_test_abcdef";
    const c = await encryptApiKey(x);
    // Flip a single character in the payload segment.
    const parts = c.split(":");
    const payload = parts[1];
    const flipped = payload.slice(0, 5) + (payload[5] === "A" ? "B" : "A") + payload.slice(6);
    const tampered = parts[0] + ":" + flipped;
    await expect(decryptApiKey(tampered)).rejects.toBeDefined();
  });
});
