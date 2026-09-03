/*
 * Regenerates the PAYLOAD block in keys/keys.js from keys/.env.
 *
 *   node keys/encode.mjs
 *
 * keys/.env is gitignored and never deploys — GitHub Pages serves static files
 * only, so there is no server to read it at runtime. It is the local source of
 * truth; this script bakes an obfuscated copy into keys.js, which does deploy.
 *
 * XOR + base64 with the key stored alongside the data is obfuscation, not
 * encryption. It defeats scrapers and plain-source reading. It does not hide
 * anything from someone who opens devtools.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, ".env");
const targetPath = join(here, "keys.js");

const FIELDS = { name: "KEYS_NAME", phone: "KEYS_PHONE", room: "KEYS_ROOM" };

const parseEnv = (text) => {
  const out = {};
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  });
  return out;
};

const obfuscate = (value, key) => {
  const bytes = Buffer.from(value, "utf8");
  const keyBytes = Buffer.from(key, "utf8");
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out.toString("base64");
};

let env;
try {
  env = parseEnv(readFileSync(envPath, "utf8"));
} catch {
  console.error("Missing keys/.env — copy keys/.env.example to keys/.env and fill it in.");
  process.exit(1);
}

const missing = Object.values(FIELDS).filter((name) => !env[name]);
if (missing.length) {
  console.error(`keys/.env is missing: ${missing.join(", ")}`);
  process.exit(1);
}

const key = randomBytes(24).toString("base64");
const entries = Object.entries(FIELDS)
  .map(([field, envName]) => `    ${field}: "${obfuscate(env[envName], key)}",`)
  .join("\n");

const block = `/* payload:start */
const PAYLOAD = {
  v: 1,
  k: "${key}",
  d: {
${entries}
  },
};
/* payload:end */`;

const source = readFileSync(targetPath, "utf8");
const pattern = /\/\* payload:start \*\/[\s\S]*?\/\* payload:end \*\//;
if (!pattern.test(source)) {
  console.error("Could not find the payload markers in keys/keys.js.");
  process.exit(1);
}

writeFileSync(targetPath, source.replace(pattern, block), "utf8");
console.log("Wrote obfuscated payload into keys/keys.js");
