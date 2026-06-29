# UiPath usage — proof of the live integration

Red Batch integrates **live** with UiPath Automation Cloud (org `rickopc`, tenant `DefaultTenant`). The
tenant's Orchestrator dashboard looks empty because the **Community plan does not expose an Action Center
UI**, the **Maestro** canvas is empty until a process is published from Studio, and there is **no unattended
robot** to show job runs. The integration the app actually uses is the **Action Center Tasks API**, whose
task store is reachable by API but has no dashboard surface on this plan. This page shows where the genuine,
verifiable usage lives.

## 1. External Application registered in the tenant (visible in Admin)

`Admin → External applications → OAuth apps → **Red Batch Containment**` — a **Confidential application**
(OAuth 2.0 client-credentials, Application ID `0e092d52-fece-4a5a-92a…`) with Orchestrator scopes
`OR.Tasks OR.Folders OR.Jobs OR.Execution`. Every API call below authenticates through this app.

![UiPath Admin — External application "Red Batch Containment"](uipath-external-app.png)

## 2. The deployed app runs in UiPath cloud mode

The live app's **Governance proof — UiPath Cloud** panel shows the Maestro-Case steps executed against the
tenant, including a real **QA Approval Task `UIPATH-TASK-4392284`** with a *View in UiPath Action Center*
deep link, and `Mode: Automation Cloud — configured for DefaultTenant`.

![Red Batch live app — Governance proof (UiPath Cloud)](uipath-cloud-task.png)

## 3. Reproducible API proof (any judge with the credentials)

OAuth token + Orchestrator read (`node scripts/uipath-smoke.mjs`):

```
TOKEN_OK len= 964
FOLDERS 200
  folder: 7988050 Shared
RELEASES 200   release_count: 0
```

Live human-approval task create + read (the exact call the agent makes at the approval line —
`POST orchestrator_/tasks/GenericTasks/CreateTask`, type `ExternalTask`):

```
CREATE 201   { "data": { "caseCode":"CASE-DEMO-…","ordersToHold":37,"excluded":11,"estValue":360480 }, ... }
NEW_TASK_ID  4397163
GET 200      title: "Approve stop-ship hold — … (37 orders, ~$360,480)"   status: 0 (Pending)   priority: High
```

`HTTP 201 Created` + `HTTP 200` on read-back is conclusive: the task is created **in the tenant**, live, at
the human-approval checkpoint. `odata/Tasks` returns `count=0` for the same Community-plan reason — the
Generic/External task store has no listing surface on this plan. A tenant with Action Center (or an
unattended robot for `StartJobs`) would render these in the UI with **no code change**.

## Where this is wired in the code

- `app/lib/uipath/orchestrator.ts` — `getCloudToken()`, `createApprovalTask()` → `CreateTask`,
  `completeApprovalTask()` → `CompleteTask`, `startCloudProcess()` → `StartJobs`.
- `app/lib/agent/containmentAgent.ts` — calls the approval task at the governed human checkpoint.
- `scripts/uipath-smoke.mjs` — the reproducible token + Folders/Releases read shown above.
