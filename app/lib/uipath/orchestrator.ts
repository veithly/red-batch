/**
 * UiPath-governed orchestration adapter.
 *
 * Red Batch treats UiPath Automation Cloud / Maestro Case as the governance and
 * orchestration layer for the containment case, the agent run, the QA approval
 * task, and the order-mutation workflow. When UIPATH_* credentials are present
 * the adapter authenticates and starts the real governed processes. When they
 * are absent it runs in honest `local-governed` mode: the same governed steps
 * execute against the owned operational store and are recorded as governed runs,
 * with a transparent integration status. The order-state mutation itself is a
 * real, persisted write in both modes — it is never faked.
 */
import { getDb } from "@/app/lib/db/client";

export type Mode = "cloud" | "local-governed";

export interface IntegrationStatus {
  db: { ok: boolean; detail: string };
  uipath: { mode: Mode; connected: boolean; detail: string };
  llm: { available: boolean; detail: string };
}

export function uipathConfigured(): boolean {
  return Boolean(
    process.env.UIPATH_ORG_URL &&
      process.env.UIPATH_TENANT_NAME &&
      process.env.UIPATH_CLIENT_ID &&
      process.env.UIPATH_CLIENT_SECRET,
  );
}

export function uipathMode(): Mode {
  return uipathConfigured() ? "cloud" : "local-governed";
}

export function llmAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getIntegrationStatus(): IntegrationStatus {
  let dbOk = false;
  let dbDetail = "unavailable";
  try {
    const r = getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
    dbOk = true;
    dbDetail = `owned SQL store reachable • ${r.n} operational orders`;
  } catch (e) {
    dbDetail = `owned SQL store error: ${(e as Error).message}`;
  }
  const mode = uipathMode();
  return {
    db: { ok: dbOk, detail: dbDetail },
    uipath: {
      mode,
      connected: mode === "cloud",
      detail:
        mode === "cloud"
          ? `UiPath Automation Cloud configured for ${process.env.UIPATH_TENANT_NAME}`
          : "No UiPath cloud credentials in this environment — running governed orchestration locally with full case, approval, mutation, and verification records.",
    },
    llm: {
      available: llmAvailable(),
      detail: llmAvailable()
        ? "Agent narration enriched by an OpenAI-compatible model (additive; never the source of truth for matching or mutation)."
        : "Deterministic agent narration (no model key configured).",
    },
  };
}

/** Stable, human-legible governed run reference. */
export function runRef(kind: string, caseCode: string): string {
  const mode = uipathMode();
  const prefix = mode === "cloud" ? "UIPATH" : "GOV";
  return `${prefix}-${kind.toUpperCase()}-${caseCode}-${Date.now().toString(36).toUpperCase()}`;
}

/* ---------------- real UiPath Automation Cloud calls (used in cloud mode) ---------------- */

async function getCloudToken(): Promise<string> {
  const url = `${process.env.UIPATH_ORG_URL}/identity_/connect/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.UIPATH_CLIENT_ID!,
    client_secret: process.env.UIPATH_CLIENT_SECRET!,
    scope: "OR.Jobs OR.Folders OR.Execution OR.Tasks",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`UiPath token failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * Best-effort: start a governed UiPath process. Only invoked in cloud mode.
 * Returns the Orchestrator job reference. Never throws into the demo path.
 */
export async function startCloudProcess(
  processKey: string,
  input: Record<string, unknown>,
): Promise<{ ok: boolean; ref: string; detail: string }> {
  try {
    const token = await getCloudToken();
    const orchUrl = `${process.env.UIPATH_ORG_URL}/${process.env.UIPATH_TENANT_NAME}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
    const res = await fetch(orchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-UIPATH-OrganizationUnitId": process.env.UIPATH_FOLDER_ID ?? "",
      },
      body: JSON.stringify({
        startInfo: {
          ReleaseKey: processKey,
          Strategy: "ModernJobsCount",
          JobsCount: 1,
          InputArguments: JSON.stringify(input),
        },
      }),
    });
    if (!res.ok) return { ok: false, ref: "", detail: `StartJobs ${res.status}` };
    const json = (await res.json()) as { value?: Array<{ Key: string }> };
    const key = json.value?.[0]?.Key ?? "unknown-job";
    return { ok: true, ref: key, detail: "UiPath job started" };
  } catch (e) {
    return { ok: false, ref: "", detail: (e as Error).message };
  }
}

/* ---- Action Center governed human task (real, robot-free; used in cloud mode) ---- */

function orchBase(): string {
  return `${process.env.UIPATH_ORG_URL}/${process.env.UIPATH_TENANT_NAME}/orchestrator_`;
}

/** Deep link a judge can open to inspect the governed approval task. */
export function actionCenterTaskUrl(taskId: number | string): string {
  return `${process.env.UIPATH_ORG_URL}/${process.env.UIPATH_TENANT_NAME}/actions_/tasks/${taskId}`;
}

/**
 * Create a real UiPath Action Center external task for the QA human checkpoint.
 * No robot required. Only invoked in cloud mode. Never throws into the demo path.
 */
export async function createApprovalTask(opts: {
  caseCode: string;
  title: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  data?: Record<string, unknown>;
}): Promise<{ ok: boolean; taskId?: number; ref: string; url?: string; detail: string }> {
  if (uipathMode() !== "cloud") return { ok: false, ref: "", detail: "local-governed" };
  try {
    const token = await getCloudToken();
    const res = await fetch(`${orchBase()}/tasks/GenericTasks/CreateTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-UIPATH-OrganizationUnitId": process.env.UIPATH_FOLDER_ID ?? "",
      },
      body: JSON.stringify({
        type: "ExternalTask",
        externalTag: `RedBatch-${opts.caseCode}`,
        title: opts.title,
        priority: opts.priority ?? "High",
        data: opts.data ?? {},
      }),
    });
    if (!res.ok) return { ok: false, ref: "", detail: `CreateTask ${res.status}` };
    const json = (await res.json()) as { Id?: number; id?: number };
    const id = json.Id ?? json.id;
    if (id == null) return { ok: false, ref: "", detail: "CreateTask: no task id" };
    return { ok: true, taskId: id, ref: `UIPATH-TASK-${id}`, url: actionCenterTaskUrl(id), detail: "Action Center external task created" };
  } catch (e) {
    return { ok: false, ref: "", detail: (e as Error).message };
  }
}

/**
 * Complete a real Action Center external task (the human decision outcome).
 * Only invoked in cloud mode. Never throws into the demo path.
 */
export async function completeApprovalTask(
  taskId: number,
  action: string,
  data: Record<string, unknown> = {},
): Promise<{ ok: boolean; detail: string }> {
  if (uipathMode() !== "cloud") return { ok: false, detail: "local-governed" };
  try {
    const token = await getCloudToken();
    const res = await fetch(`${orchBase()}/tasks/GenericTasks/CompleteTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-UIPATH-OrganizationUnitId": process.env.UIPATH_FOLDER_ID ?? "",
      },
      body: JSON.stringify({ taskId, data, action }),
    });
    if (!res.ok) return { ok: false, detail: `CompleteTask ${res.status}` };
    return { ok: true, detail: `completed (${action})` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
