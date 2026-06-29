# Red Batch — UiPath AgentHack Submission

Track: **UiPath Maestro Case**. Event: UiPath AgentHack (https://uipath-agenthack.devpost.com/).

## Tagline (one line)

A safety complaint becomes a human-approved stop-ship on the exact right orders, with a saved record
to prove it.

## Elevator pitch (≈ 60 words)

When a product-safety complaint lands on a lot you might still be shipping, you have minutes, not
days. Red Batch is a governed containment workspace: an agent traces the bad lot to the exact
Ready-to-Ship orders, a QA manager approves the stop-ship, and the system freezes real order state
and saves a Stop-Ship Packet. Confident cases act; ambiguous ones route to a human.

## What it does

Red Batch turns one safety signal into a contained, approved, auditable stop-ship.

- The Batch Containment Agent reads the signal, maps the lot to its SKU and warehouse, and finds
  every Ready-to-Ship order in scope (37 to hold, 11 excluded with a reason each).
- Nothing changes until a QA manager approves. That approval is the governance line.
- On approval, 37 order rows move from Ready to Ship to Quarantined - QA Review, about $360,480 held
  across 3 zones. The agent verifies the change by reading it back, then saves a Final Stop-Ship
  Packet you can reopen by order, lot, case, or packet id.
- A second case (RB-7712, confidence 0.54) shows the recovery path: below the action floor the agent
  refuses to act alone and routes to Human Review with a partial scope and an evidence task.

## How we built it

- Next.js (App Router) with React Server Components and TypeScript.
- A real owned store using Node's built-in `node:sqlite`, with a Postgres-portable schema. Cases,
  orders, approvals, packets, timeline, and governed runs are real rows that survive a restart.
- A deterministic containment policy and a step-by-step agent loop (observe, map, fan out, classify,
  approve, mutate, verify, save packet). Each step writes a governed run and a timeline event.
- A UiPath governance adapter that records each Maestro-Case step and, with credentials, runs in cloud
  mode against a live UiPath Automation Cloud tenant. The QA approval step is a real UiPath Action
  Center task: the agent creates it (`CreateTask`) at the human gate and completing the approval
  completes it (`CompleteTask`), so the governance line is an actual platform action with an
  inspectable task id.
- Optional, additive LLM narration of the agent's reasoning, with a deterministic fallback.

## How it maps to the UiPath Maestro Case track

A durable case object with status; an agent acting through governed actions; a human approval task on
the state-changing step; explicit state mutation; verification; exception handling; and a saved
artifact. In cloud mode the human approval task is a live UiPath Action Center task (`OR.Tasks`),
created at the gate and completed on approval before any order changes. The Governance panel shows the
recorded run for each step and links to the Action Center task.

## Challenges we ran into

The hardest bug was structural. Node's `node:sqlite` returns rows with a null prototype, and React
Server Components refuse to pass null-prototype objects to client components, so every case and packet
page returned a 500 even though the JSON API worked. We traced it from the server logs, then
normalized every row into a plain object at the data layer. After that, every state rendered cleanly
on desktop and mobile.

## Accomplishments we're proud of

- A real state change behind a human approval, not a mock. Order rows actually move and are verified.
- A live UiPath platform integration: the approval gate creates and completes a real Action Center
  task on a live Automation Cloud tenant, with an inspectable task id.
- An honest integration story: when a credential is missing, the UI says so instead of faking a call.
- A second, working recovery path for low-confidence cases.

## What we learned

Smoke tests that only hit JSON endpoints can pass while the rendered product is broken. We added a
screenshot pass over every real state to catch what the API checks could not.

## What's next

The approval gate already runs as a live UiPath Action Center task. Next is a published process plus an
unattended robot so the whole loop runs as a UiPath job, then managed Postgres for the store, the
warehouse and ERP connectors that feed real order data, and role-scoped queues and notifications for QA
teams. See `pitch/long_term_roadmap.md`.

## Built with

next.js, react, typescript, node:sqlite, tailwindcss, uipath (maestro case), openai-compatible llm.

## Try it / links

- Live app: https://red-batch.veithly.workers.dev (Cloudflare Workers + D1, UiPath cloud mode — the
  QA approval opens a real Action Center task). Deploy code on the `deploy/cloudflare` branch.
- Or run locally: `http://localhost:4387` (run steps in `README.md`).
- Public repo: https://github.com/veithly/red-batch
- Demo video: https://youtu.be/tABpObnVRIs
- Inspect: `/cases/RB-2049`, `/packets/RB-PKT-2049`, `/reopen`; or `npm run smoke`.
