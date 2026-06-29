import {
  ensureSeeded,
  getApprovals,
  getCase,
  getCaseOrders,
  getEvidence,
  getEvidenceTasks,
  getGovernedRuns,
  getPacketByCase,
  getSignal,
  getTimeline,
} from "@/app/lib/repo";
import { getIntegrationStatus } from "@/app/lib/uipath/orchestrator";
import type {
  ApprovalRow,
  CaseOrderRow,
  CaseRow,
  EvidenceRow,
  EvidenceTaskRow,
  GovernedRunRow,
  RiskSignalRow,
  TimelineEventRow,
} from "@/app/lib/types";
import type { IntegrationStatus } from "@/app/lib/uipath/orchestrator";

export interface CaseDetail {
  case: CaseRow;
  signal: RiskSignalRow | undefined;
  evidence: EvidenceRow[];
  orders: CaseOrderRow[];
  included: CaseOrderRow[];
  excluded: CaseOrderRow[];
  approvals: ApprovalRow[];
  timeline: TimelineEventRow[];
  evidenceTasks: EvidenceTaskRow[];
  governedRuns: GovernedRunRow[];
  packetCode: string | null;
  includedValueCents: number;
  integration: IntegrationStatus;
}

export function getCaseDetail(code: string): CaseDetail | null {
  ensureSeeded();
  const c = getCase(code);
  if (!c) return null;
  const orders = getCaseOrders(c.id);
  const included = orders.filter((r) => r.included === 1);
  const excluded = orders.filter((r) => r.included !== 1);
  const packet = getPacketByCase(c.id);
  return {
    case: c,
    signal: getSignal(c.id),
    evidence: getEvidence(c.id),
    orders,
    included,
    excluded,
    approvals: getApprovals(c.id),
    timeline: getTimeline(c.id),
    evidenceTasks: getEvidenceTasks(c.id),
    governedRuns: getGovernedRuns(c.id),
    packetCode: c.packet_code ?? packet?.code ?? null,
    includedValueCents: included.reduce((s, r) => s + (r.value_cents || 0), 0),
    integration: getIntegrationStatus(),
  };
}
