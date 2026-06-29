# Red Batch

A safety complaint about a bad lot becomes a human-approved stop-ship on the exact right orders, with
a saved record to prove it.

Red Batch is a governed product-safety containment workspace built on the UiPath Maestro Case shape:
a durable case, an agent that does the work through governed actions, a human approval on the
state-changing step, and a reopenable outcome artifact.

## Try it

- Run locally (see below), then open `http://localhost:4387`.
- Demo path: pick a role on the entry screen, open case **RB-2049**, click **Run Containment**,
  approve the stop-ship, then open the saved **Stop-Ship Packet**.
- Reopen path: go to `/reopen` and search `O-1042` to find the order and the case that froze it.

## What it does

- **Input:** a product-safety signal on a lot (RB-2049: battery overheating, confidence 0.92).
- **Action:** the Batch Containment Agent traces the lot to its SKU and warehouse and fans out to
  every Ready-to-Ship order in scope (37 to hold, 11 excluded with a reason each). A QA manager
  approves before anything changes.
- **Result artifact:** 37 order rows move to Quarantined - QA Review, the agent verifies the change
  (37 of 37), and a Final Stop-Ship Packet is saved with the diff, evidence, approver, and exclusions.
- **How to inspect:** open `/cases/RB-2049`, `/packets/RB-PKT-2049`, or `/reopen`; or run
  `npm run smoke` and `node scripts/db-stats.mjs`.

## The two paths

- **RB-2049 (confident):** full stop-ship of 37 orders, about $360,480 held across 3 zones.
- **RB-7712 (ambiguous, confidence 0.54):** below the 0.70 action floor, so the agent does not act
  alone. It routes to Human Review Required, proposes a partial 5-order hold, and opens an evidence
  task.

## How it works

- **Real persisted state:** `node:sqlite` file store at `.data/redbatch.sqlite`. Cases, orders,
  approvals, packets, timeline, and governed runs are real rows that survive a restart. The schema
  ports to Postgres.
- **The agent loop** (`app/lib/agent/containmentAgent.ts`): observe the signal, map lot to SKU and
  warehouse, fan out to affected orders, classify exclusions, gate on QA approval, mutate order state,
  verify by reading it back, save the packet. Every step writes a governed run and a timeline event.
- **The decision** (`app/lib/policy.ts`): confidence against a threshold and severity decides full
  stop-ship versus human review. This is deterministic, not a model guess.
- **UiPath governance** (`app/lib/uipath/orchestrator.ts`): records each Maestro-Case step. With
  `UIPATH_*` credentials it runs in **cloud mode** against a live UiPath Automation Cloud tenant, and
  the QA approval step becomes a **real UiPath Action Center task**: the agent creates the task
  (`CreateTask`) when it stops at the human gate, and completing the approval completes the task
  (`CompleteTask`). Without credentials it falls back to an honest local-governed record.
- **LLM narration** (`app/lib/llm.ts`): optional and additive. It narrates the agent's reasoning when
  an OpenAI-compatible key is present and falls back to deterministic text otherwise.

### Key implementation files

- `app/lib/agent/containmentAgent.ts` — the containment loop and verification.
- `app/lib/policy.ts` — the containment decision.
- `app/lib/uipath/orchestrator.ts` — UiPath governance adapter (cloud Action Center tasks +
  local-governed fallback): `createApprovalTask`, `completeApprovalTask`, `startCloudProcess`.
- `app/lib/repo.ts`, `app/lib/db/client.ts` — the owned store and schema.
- `app/components/CaseWorkbench.tsx` — the case workbench UI and its stages.
- `app/packets/[code]/page.tsx` — the Stop-Ship Packet artifact.

### Limits and honest failures

- With UiPath credentials the demo runs in **cloud mode** against a live Automation Cloud tenant, and
  the approval step is a real Action Center task with an inspectable task id. The live proof is the
  human-checkpoint task (`OR.Tasks`), not a published-process unattended robot run: a full `StartJobs`
  run needs a published process and an unattended robot, which a Community plan does not provide. The
  `startCloudProcess` path is wired for an environment that has them. Without credentials the app falls
  back to a clearly labeled local-governed record and never fakes a cloud call.
- The store is `node:sqlite` because no managed Postgres URL was available. It is real and persistent;
  the schema is Postgres-portable.

## Run locally

```bash
npm install
npm run build
npm run start          # serves http://localhost:4387
# optional checks:
npm run smoke          # runs the full loop, prints 14 checks
node scripts/db-stats.mjs
```

Node 22+ is required for the built-in `node:sqlite` module (developed on Node 26).

## License

MIT (see `LICENSE`).
