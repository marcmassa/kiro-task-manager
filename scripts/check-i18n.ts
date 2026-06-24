import es from "../src/i18n/locales/es.json";
import en from "../src/i18n/locales/en.json";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null
      ? flatKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

const esKeys = new Set(flatKeys(es));
const enKeys = new Set(flatKeys(en));

const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));

let hasErrors = false;

if (missingInEn.length > 0) {
  console.error("Keys in es.json but missing in en.json:");
  missingInEn.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (missingInEs.length > 0) {
  console.error("Keys in en.json but missing in es.json:");
  missingInEs.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (!hasErrors) {
  console.log(`✓ Catalogues in parity — ${esKeys.size} keys each`);
  process.exit(0);
} else {
  process.exit(1);
}
