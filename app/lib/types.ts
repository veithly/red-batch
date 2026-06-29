export type Role =
  | "Quality Ops Lead"
  | "QA Manager"
  | "Customer Ops"
  | "Auditor";

export const ROLES: Role[] = [
  "Quality Ops Lead",
  "QA Manager",
  "Customer Ops",
  "Auditor",
];

export type CaseStatus =
  | "Ready for Containment"
  | "Analyzing"
  | "Awaiting QA Approval"
  | "Mutating Orders"
  | "Verifying"
  | "Verified"
  | "Packet Saved"
  | "Human Review Required"
  | "Evidence Requested"
  | "Mutation Exception"
  | "Packet Pending"
  | "No Containment Needed";

export type OrderStatus =
  | "Ready to Ship"
  | "Quarantined - QA Review"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "On Hold";

export type ContainmentPlan = "full_stop" | "partial" | "human_review" | "monitor";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type ApprovalDecision =
  | "approve_full"
  | "approve_partial"
  | "request_evidence"
  | "reject";

export interface CaseRow {
  id: string;
  code: string;
  workspace_id: string;
  title: string;
  status: CaseStatus;
  signal_id: string;
  sku: string;
  lot: string;
  warehouse: string;
  severity: Severity;
  confidence: number;
  threshold: number;
  plan: ContainmentPlan | null;
  scope_hash: string | null;
  affected_count: number;
  excluded_count: number;
  packet_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskSignalRow {
  id: string;
  case_id: string;
  summary: string;
  source: string;
  received_at: string;
  product: string;
}

export interface OrderRow {
  id: string;
  code: string;
  workspace_id: string;
  sku: string;
  lot: string;
  warehouse: string;
  zone: string;
  status: OrderStatus;
  value_cents: number;
  customer_ref: string;
  updated_at: string;
}

export interface CaseOrderRow {
  id: string;
  case_id: string;
  order_id: string;
  order_code: string;
  before_status: OrderStatus;
  proposed_status: OrderStatus;
  final_status: OrderStatus | null;
  included: number;
  reason: string;
  mutation_result: string | null;
  verified: number;
  zone: string;
  value_cents: number;
}

export interface EvidenceRow {
  id: string;
  case_id: string;
  kind: string;
  label: string;
  detail: string;
  confidence: number | null;
}

export interface ApprovalRow {
  id: string;
  case_id: string;
  approver_role: string;
  approver_name: string;
  decision: ApprovalDecision;
  reason: string | null;
  scope_count: number;
  scope_hash: string;
  created_at: string;
}

export interface PacketRow {
  id: string;
  code: string;
  case_id: string;
  status: "Final" | "Pending" | "Partial";
  summary_json: string;
  created_at: string;
}

export interface TimelineEventRow {
  id: string;
  case_id: string;
  seq: number;
  actor: string;
  phase: string | null;
  event_type: string;
  detail: string;
  from_state: string | null;
  to_state: string | null;
  created_at: string;
}

export interface EvidenceTaskRow {
  id: string;
  case_id: string;
  label: string;
  detail: string;
  status: "Queued" | "In Progress" | "Done";
  created_at: string;
}

export interface GovernedRunRow {
  id: string;
  case_id: string;
  kind: string;
  mode: "cloud" | "local-governed";
  run_ref: string;
  status: string;
  detail: string | null;
  created_at: string;
}
