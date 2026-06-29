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

export async function getCaseDetail(code: string): Promise<CaseDetail | null> {
  await ensureSeeded();
  const c = await getCase(code);
  if (!c) return null;
  const [orders, signal, evidence, approvals, timeline, evidenceTasks, governedRuns, packet, integration] =
    await Promise.all([
      getCaseOrders(c.id),
      getSignal(c.id),
      getEvidence(c.id),
      getApprovals(c.id),
      getTimeline(c.id),
      getEvidenceTasks(c.id),
      getGovernedRuns(c.id),
      getPacketByCase(c.id),
      getIntegrationStatus(),
    ]);
  const included = orders.filter((r) => r.included === 1);
  const excluded = orders.filter((r) => r.included !== 1);
  return {
    case: c,
    signal,
    evidence,
    orders,
    included,
    excluded,
    approvals,
    timeline,
    evidenceTasks,
    governedRuns,
    packetCode: c.packet_code ?? packet?.code ?? null,
    includedValueCents: included.reduce((s, r) => s + (r.value_cents || 0), 0),
    integration,
  };
}
