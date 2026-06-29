-- Red Batch operational store (Cloudflare D1).
-- Applied with: wrangler d1 migrations apply red-batch
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  lot TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  threshold REAL NOT NULL,
  plan TEXT,
  scope_hash TEXT,
  affected_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  packet_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_signals (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  received_at TEXT NOT NULL,
  product TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  workspace_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  lot TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  zone TEXT NOT NULL,
  status TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  customer_ref TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_orders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_code TEXT NOT NULL,
  before_status TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  final_status TEXT,
  included INTEGER NOT NULL,
  reason TEXT NOT NULL,
  mutation_result TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  zone TEXT NOT NULL DEFAULT '',
  value_cents INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL,
  confidence REAL
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approver_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  scope_count INTEGER NOT NULL,
  scope_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS packets (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  case_id TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  actor TEXT NOT NULL,
  phase TEXT,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence_tasks (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS governed_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  run_ref TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_lot_wh ON orders(lot, warehouse);
CREATE INDEX IF NOT EXISTS idx_case_orders_case ON case_orders(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_case ON timeline_events(case_id, seq);
