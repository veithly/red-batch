// Live UiPath Automation Cloud smoke: client_credentials token + Orchestrator API reads.
// Reads creds from .hunter/uipath-creds.json (gitignored). No shell expansion of the secret.
import { readFileSync } from "node:fs";

const c = JSON.parse(readFileSync(new URL("../.hunter/uipath-creds.json", import.meta.url), "utf8"));
const ORG = c.UIPATH_ORG_URL;
const TENANT = c.UIPATH_TENANT_NAME;

async function token() {
  const url = `${ORG}/identity_/connect/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: c.UIPATH_CLIENT_ID,
    client_secret: c.UIPATH_CLIENT_SECRET,
    scope: "OR.Jobs OR.Folders OR.Execution OR.Tasks",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt).access_token;
}

async function get(path, tok, extraHeaders = {}) {
  const res = await fetch(`${ORG}/${TENANT}/orchestrator_/${path}`, {
    headers: { Authorization: `Bearer ${tok}`, ...extraHeaders },
  });
  const txt = await res.text();
  return { status: res.status, body: txt };
}

const tok = await token();
console.log("TOKEN_OK len=", tok.length);

const folders = await get("odata/Folders", tok);
console.log("FOLDERS", folders.status);
let folderId = null,
  folderName = null;
if (folders.status === 200) {
  const j = JSON.parse(folders.body);
  for (const f of j.value ?? []) console.log("  folder:", f.Id, f.FullyQualifiedName ?? f.DisplayName);
  if (j.value?.[0]) {
    folderId = j.value[0].Id;
    folderName = j.value[0].FullyQualifiedName ?? j.value[0].DisplayName;
  }
} else {
  console.log("  ", folders.body.slice(0, 300));
}

if (folderId != null) {
  const releases = await get("odata/Releases", tok, { "X-UIPATH-OrganizationUnitId": String(folderId) });
  console.log("RELEASES", releases.status);
  if (releases.status === 200) {
    const j = JSON.parse(releases.body);
    console.log("  release_count:", j.value?.length ?? 0);
    for (const r of j.value ?? []) console.log("  release:", r.Key, r.Name, r.ProcessKey, "v" + r.ProcessVersion);
  } else {
    console.log("  ", releases.body.slice(0, 300));
  }
}

console.log(JSON.stringify({ result: "ok", folderId, folderName }));
