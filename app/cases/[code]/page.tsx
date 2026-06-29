import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { CaseWorkbench, type WorkbenchData } from "@/app/components/CaseWorkbench";
import { getCaseDetail } from "@/app/lib/caseDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { code } = await params;
  const { order } = await searchParams;
  const detail = await getCaseDetail(code);
  const active = code === "RB-2049" ? "active-case" : "cases";

  if (!detail) {
    return (
      <AppShell active="cases">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-stone-900">Case {code} not found</h1>
          <p className="mt-2 text-stone-500">This case is not in the demo workspace.</p>
          <Link href="/cases" className="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-700">
            ← Back to all cases
          </Link>
        </div>
      </AppShell>
    );
  }

  const data: WorkbenchData = {
    case: detail.case,
    signal: detail.signal
      ? {
          id: detail.signal.id,
          summary: detail.signal.summary,
          source: detail.signal.source,
          received_at: detail.signal.received_at,
        }
      : null,
    evidence: detail.evidence.map((e) => ({ kind: e.kind, label: e.label, detail: e.detail })),
    included: detail.included,
    excluded: detail.excluded,
    approvals: detail.approvals,
    timeline: detail.timeline,
    evidenceTasks: detail.evidenceTasks,
    governedRuns: detail.governedRuns,
    packetCode: detail.packetCode,
    includedValueCents: detail.includedValueCents,
    integration: detail.integration,
    orderHighlight: order ?? null,
  };

  return (
    <AppShell active={active}>
      <CaseWorkbench data={data} />
    </AppShell>
  );
}
