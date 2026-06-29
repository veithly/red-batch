// Test: create a real UiPath Action Center External Task (no robot needed).
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync(new URL("../.hunter/uipath-creds.json", import.meta.url), "utf8"));
const ORG = c.UIPATH_ORG_URL;
const TENANT = c.UIPATH_TENANT_NAME;
const FOLDER = String(c.UIPATH_FOLDER_ID);

async function token() {
  const res = await fetch(`${ORG}/identity_/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.UIPATH_CLIENT_ID,
      client_secret: c.UIPATH_CLIENT_SECRET,
      scope: "OR.Jobs OR.Folders OR.Execution OR.Tasks",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

const tok = await token();
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "X-UIPATH-OrganizationUnitId": FOLDER };

const attempts = [
  { type: "ExternalTask", externalTag: "RedBatch-RB-2049", title: "Red Batch — Approve Stop-Ship for lot RB-2049 (37 orders)", priority: "High", data: { caseCode: "RB-2049", lot: "RB-2049", affected: 37, decision_required: "approve_full | approve_partial" }, taskCatalogName: "Red Batch Containment" },
  { type: "ExternalTask", externalTag: "RedBatch-RB-2049", title: "Red Batch — Approve Stop-Ship for lot RB-2049 (37 orders)", priority: "High", data: { caseCode: "RB-2049" } },
];

for (let i = 0; i < attempts.length; i++) {
  const res = await fetch(`${ORG}/${TENANT}/orchestrator_/tasks/GenericTasks/CreateTask`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(attempts[i]),
  });
  const txt = await res.text();
  console.log(`CREATE attempt ${i + 1}:`, res.status);
  console.log("  ", txt.slice(0, 400));
  if (res.status >= 200 && res.status < 300) {
    const j = JSON.parse(txt);
    const id = j.Id ?? j.id;
    console.log("  TASK_ID =", id);
    const g = await fetch(`${ORG}/${TENANT}/orchestrator_/tasks/GenericTasks/GetTaskDataById?taskId=${id}`, { headers: H });
    console.log("  GET task:", g.status, (await g.text()).slice(0, 300));
    console.log(JSON.stringify({ created: true, taskId: id }));
    break;
  }
}
