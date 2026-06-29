// Verify the real UiPath Action Center (OR.Tasks) tasks created by the app.
// Robot-free human checkpoint: tasks are created on agent run and completed on
// human approval, all via the Orchestrator GenericTasks API on a live tenant.
import { readFileSync } from "node:fs";

const c = JSON.parse(
  readFileSync(new URL("../.hunter/uipath-creds.json", import.meta.url), "utf8"),
);
const ORG = c.UIPATH_ORG_URL;
const TENANT = c.UIPATH_TENANT_NAME;
const FOLDER = String(c.UIPATH_FOLDER_ID);

async function token() {
  const r = await fetch(`${ORG}/identity_/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.UIPATH_CLIENT_ID,
      client_secret: c.UIPATH_CLIENT_SECRET,
      scope: "OR.Tasks OR.Folders",
    }),
  });
  const j = await r.json();
  return j.access_token;
}

const STATUS = { 0: "Unassigned", 1: "Pending", 2: "Completed" };

const tok = await token();
const H = {
  Authorization: `Bearer ${tok}`,
  "X-UIPATH-OrganizationUnitId": FOLDER,
  "Content-Type": "application/json",
};

console.log("=== UiPath Action Center (OR.Tasks) live verification ===");
console.log("org:", ORG, "tenant:", TENANT, "folder:", FOLDER);
console.log("token:", tok ? `OK (len ${tok.length})` : "FAILED");

// List recent GenericTasks in the folder (proves they live on the tenant).
const listUrl = `${ORG}/${TENANT}/orchestrator_/odata/Tasks?$top=10&$orderby=CreationTime desc&$select=Id,Title,Status,Action,CreationTime`;
const list = await fetch(listUrl, { headers: H });
const lj = await list.json();
console.log(`\nTasks list HTTP ${list.status} — ${lj.value?.length ?? 0} task(s):`);
for (const t of lj.value ?? []) {
  console.log(
    `  TASK ${t.Id} | ${STATUS[t.Status] ?? t.Status} | action=${t.Action ?? "-"} | ${t.Title}`,
  );
}

// Deep-verify the specific tasks the app created/completed.
for (const id of [4392236, 4392284]) {
  const r = await fetch(
    `${ORG}/${TENANT}/orchestrator_/tasks/GenericTasks/GetTaskDataById?taskId=${id}`,
    { headers: H },
  );
  if (r.status !== 200) {
    console.log(`\nTASK ${id}: HTTP ${r.status} (may be outside window)`);
    continue;
  }
  const g = await r.json();
  console.log(
    `\nTASK ${id}: status=${g.status} (${STATUS[g.status] ?? "?"}) action=${g.action} title="${g.title}"`,
  );
}
