# Red Batch — Batch Containment Agent (UiPath Coded Agent)

This folder is a **UiPath coded agent** (Python) that is **packed and published to the live UiPath
Automation Cloud tenant** with the [UiPath CLI](https://docs.uipath.com/uipath-cli). It is the same
containment policy the Red Batch web app runs (`../app/lib/policy.ts`), expressed as a UiPath coded-agent
entry point so it appears as a real, runnable package in Orchestrator.

It is deliberately a **second, native expression** of the agent: the product's live human-in-the-loop
checkpoint is the **UiPath Action Center task** the web app creates (see the root `README.md` →
*Where to see the UiPath usage*); this package makes the agent itself visible in the tenant as a published
coded agent.

## What it does

Given a product-safety signal on a manufacturing lot, `main(ContainmentIn) -> ContainmentOut`:

- scopes the in-scope Ready-to-Ship orders (`ready_to_ship_orders − out_of_scope_orders`),
- applies the action-confidence floor (`0.70`): `>=` floor → `stop_ship_full`; below → `human_review_required`,
- estimates the value held and the number of zones,
- always sets `requires_approval = true` — the hold is gated behind a human QA approval, so the agent
  never changes order state on its own.

## Run it locally

```bash
# from the repo root, with the uipath CLI available (see below)
uipath run main '{"case_code":"RB-2049","lot_id":"LOT-7741","sku":"SKU-RED-7741","warehouse":"WH-APAC-3","confidence":0.92,"ready_to_ship_orders":48,"out_of_scope_orders":11}'
# -> decision: stop_ship_full | orders_to_hold: 37 | orders_excluded: 11 | est_value_held: 360491.0 | zones: 3
```

## How it was published to the tenant

```bash
# 1. install the UiPath CLI (Python 3.11+)
uv venv --python 3.12 .venv && uv pip install uipath

# 2. authenticate to the tenant with the External Application (client credentials)
uipath auth --base-url https://cloud.uipath.com/<org>/<tenant> \
  --client-id <external-app-id> --client-secret <external-app-secret>

# 3. initialize, pack, and publish to the tenant package feed
uipath init
uipath pack
uipath publish -t          # -> visible under Orchestrator → Tenant → Packages
```

The published package `red-batch-containment` (Type: Function, Runtime: python) is visible in the tenant —
see `../docs/uipath-orchestrator-package.png` and `../docs/uipath-proof.md`.

## Files

- `main.py` — the coded-agent entry point (`ContainmentIn` → `ContainmentOut`).
- `uipath.json` — function map + project id.
- `entry-points.json` — generated input/output JSON schema for the entry point.
- `bindings.json`, `project.uiproj`, `main.mermaid` — generated project metadata + diagram.
