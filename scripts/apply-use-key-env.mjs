#!/usr/bin/env node
/**
 * Credential discovery for Red Batch.
 *
 * Reads $HOME/use_key.txt (or $HOME/user_key.txt) and writes ONLY the variables
 * Red Batch actually uses into .env.local:
 *   - OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_DEFAULT_MODEL (additive agent narration)
 *   - any UIPATH_* present (real governed orchestration)
 *
 * Secrets are never printed. The file is gitignored.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const candidates = [path.join(os.homedir(), "use_key.txt"), path.join(os.homedir(), "user_key.txt")];
const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.log("No use_key.txt / user_key.txt found. Red Batch runs with deterministic narration + local governance.");
  process.exit(0);
}

const raw = fs.readFileSync(src, "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const WANT = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_DEFAULT_MODEL",
  "OPENAI_MODEL_DEFAULT",
  "UIPATH_ORG_URL",
  "UIPATH_TENANT_NAME",
  "UIPATH_CLIENT_ID",
  "UIPATH_CLIENT_SECRET",
  "UIPATH_FOLDER_ID",
  "UIPATH_PROCESS_KEY_CONTAINMENT",
  "UIPATH_PROCESS_KEY_ORDER_MUTATION",
  "ORDER_QUARANTINE_STATUS",
];

const out = [];
const picked = [];
for (const k of WANT) {
  if (env[k]) {
    out.push(`${k}=${env[k]}`);
    picked.push(k);
  }
}

const target = path.join(process.cwd(), ".env.local");
fs.writeFileSync(target, out.join("\n") + "\n", { mode: 0o600 });
console.log(`Wrote ${picked.length} variable(s) to .env.local: ${picked.join(", ") || "(none matched)"}`);
console.log("Secret values were not printed.");
