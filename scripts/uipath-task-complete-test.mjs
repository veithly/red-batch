import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync(new URL("../.hunter/uipath-creds.json", import.meta.url), "utf8"));
const ORG = c.UIPATH_ORG_URL, TENANT = c.UIPATH_TENANT_NAME, FOLDER = String(c.UIPATH_FOLDER_ID);
const taskId = Number(process.argv[2]);
const action = process.argv[3] || "approve_full";

async function token() {
  const res = await fetch(`${ORG}/identity_/connect/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.UIPATH_CLIENT_ID, client_secret: c.UIPATH_CLIENT_SECRET, scope: "OR.Jobs OR.Folders OR.Execution OR.Tasks" }),
  });
  return (await res.json()).access_token;
}
const tok = await token();
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "X-UIPATH-OrganizationUnitId": FOLDER };
const res = await fetch(`${ORG}/${TENANT}/orchestrator_/tasks/GenericTasks/CompleteTask`, {
  method: "POST", headers: H, body: JSON.stringify({ taskId, data: { approvedBy: "Priya Shah", role: "QA Manager" }, action }),
});
console.log("COMPLETE", res.status, (await res.text()).slice(0, 300));
const g = await fetch(`${ORG}/${TENANT}/orchestrator_/tasks/GenericTasks/GetTaskDataById?taskId=${taskId}`, { headers: H });
const gj = await g.json();
console.log("STATUS now:", gj.status, "action:", gj.action, "completedByUser:", gj.completedByUser);
