"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusChip } from "@/app/components/StatusChip";
import { GovernancePanel } from "@/app/components/GovernancePanel";
import { ConfidenceMeter } from "@/app/components/ConfidenceMeter";
import { caseChip, dateTime, orderChip, severityChip, usd } from "@/app/lib/format";
import { getSession } from "@/app/lib/session";
import type {
  ApprovalRow,
  CaseOrderRow,
  CaseRow,
  EvidenceRow,
  EvidenceTaskRow,
  GovernedRunRow,
  OrderStatus,
  TimelineEventRow,
} from "@/app/lib/types";

interface IntegrationLite {
  db: { ok: boolean; detail: string };
  uipath: { mode: string; connected: boolean; detail: string };
  llm: { available: boolean; detail: string };
}
interface TraceStep {
  phase: string;
  title: string;
  detail: string;
}
export interface WorkbenchData {
  case: CaseRow;
  signal: { id: string; summary: string; source: string; received_at: string } | null;
  evidence: Pick<EvidenceRow, "kind" | "label" | "detail">[];
  included: CaseOrderRow[];
  excluded: CaseOrderRow[];
  approvals: ApprovalRow[];
  timeline: TimelineEventRow[];
  evidenceTasks: EvidenceTaskRow[];
  governedRuns: GovernedRunRow[];
  packetCode: string | null;
  includedValueCents: number;
  integration: IntegrationLite;
  orderHighlight: string | null;
}

const PREVIEW_ORDERS = 37; // consequence preview shown before the run for the hero case

export function CaseWorkbench({ data }: { data: WorkbenchData }) {
  const router = useRouter();
  const c = data.case;
  const [phase, setPhase] = useState<"idle" | "running" | "mutating">("idle");
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [mutStep, setMutStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSuccess = c.status === "Verified" || c.status === "Packet Saved";
  const isReview = c.status === "Awaiting QA Approval";
  const isHumanReview = c.status === "Human Review Required" || c.status === "Evidence Requested";
  const isReady = c.status === "Ready for Containment";

  async function runContainment() {
    setError(null);
    setPhase("running");
    setRevealed(0);
    try {
      const res = await fetch(`/api/cases/${c.code}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Run failed");
      const steps: TraceStep[] = json.trace?.length ? json.trace : DEFAULT_TRACE;
      setTrace(steps);
      await revealSequentially(steps.length, setRevealed, 720);
      await wait(650);
      router.refresh();
      setPhase("idle");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  async function approve(decision: "approve_full" | "approve_partial" | "request_evidence") {
    setError(null);
    const s = getSession();
    if (decision === "request_evidence") {
      try {
        const res = await fetch(`/api/cases/${c.code}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, role: s.role, name: s.name, reason: "QA requested additional evidence." }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    setPhase("mutating");
    setMutStep(0);
    try {
      const res = await fetch(`/api/cases/${c.code}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, role: s.role, name: s.name }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Approval failed");
      await revealSequentially(MUT_STEPS.length, setMutStep, 780);
      await wait(650);
      router.refresh();
      setPhase("idle");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  if (phase === "running") return <AgentRunningView c={c} trace={trace.length ? trace : DEFAULT_TRACE} revealed={revealed} />;
  if (phase === "mutating") return <MutatingView c={c} step={mutStep} />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isReady && <ReadyStage data={data} onRun={runContainment} />}
      {isReview && <ReviewStage data={data} onApprove={approve} />}
      {isHumanReview && <HumanReviewStage data={data} onApprove={approve} />}
      {isSuccess && <SuccessStage data={data} />}
      {(c.status === "Mutation Exception" || c.status === "No Containment Needed") && <SuccessStage data={data} />}

      <div className="mt-6">
        <GovernancePanel caseCode={c.code} runs={data.governedRuns} integration={data.integration} />
      </div>
    </div>
  );
}

/* ============================ READY STAGE ============================ */
function ReadyStage({ data, onRun }: { data: WorkbenchData; onRun: () => void }) {
  const c = data.case;
  const preview = c.lot === "RB-2049" ? PREVIEW_ORDERS : null;
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Active case</p>
      <h1 className="mt-1 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-stone-900 sm:text-5xl">
        Bad product is still shipping. Stop the right orders.
      </h1>

      <CaseHeaderCard data={data} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <RiskSummary data={data} />
          <CaseDetails data={data} />
          <EvidenceList evidence={data.evidence} />
        </div>
        <div className="space-y-5">
          <ConsequencePreview preview={preview} c={c} />
          <ScopePanel data={data} preview={preview} />
          <div className="rb-panel p-5">
            <h3 className="text-sm font-semibold text-stone-800">Recommended action</h3>
            <p className="mt-1 text-sm text-stone-500">
              Run containment to trace the bad lot and stop the right orders before they ship. Nothing changes until QA
              approves.
            </p>
            <button
              data-cta-primary
              onClick={onRun}
              className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-red-700 active:translate-y-px"
            >
              Run Containment
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================ AGENT RUNNING ============================ */
function AgentRunningView({ c, trace, revealed }: { c: CaseRow; trace: TraceStep[]; revealed: number }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
        <span className="h-2 w-2 rounded-full bg-blue-500 rb-pulse" />
        Batch Containment Agent · {c.code}
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Analyzing containment…</h2>
      <p className="mt-1 text-sm text-stone-500">Reading the signal and order graph from owned operational data.</p>

      <ol className="mt-6 space-y-3">
        {trace.map((step, i) => {
          const shown = i < revealed;
          const active = i === revealed;
          return (
            <li
              key={i}
              className={`rb-panel flex items-start gap-3 p-4 transition ${shown ? "rb-step opacity-100" : "opacity-35"}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  shown ? "bg-emerald-100 text-emerald-700" : active ? "bg-blue-100 text-blue-700 rb-pulse" : "bg-stone-100 text-stone-400"
                }`}
              >
                {shown ? "✓" : i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-stone-800">{step.title}</div>
                {shown && <div className="mt-0.5 text-sm text-stone-500">{step.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ============================ REVIEW / APPROVAL ============================ */
function ReviewStage({ data, onApprove }: { data: WorkbenchData; onApprove: (d: "approve_full" | "request_evidence") => void }) {
  const c = data.case;
  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Proposed containment · review before approval</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
        Hold {data.included.length} Ready to Ship orders?
      </h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        The agent proposes a full stop-ship. Nothing has changed yet — review the exact orders, then approve to mutate
        stored order state.
      </p>

      <CaseHeaderCard data={data} />

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <AffectedOrdersTable included={data.included} excluded={data.excluded} highlight={data.orderHighlight} />
        </div>
        <div className="space-y-5">
          <EvidenceList evidence={data.evidence} compact />
          <ApprovalCard data={data} onApprove={onApprove} />
        </div>
      </div>
    </>
  );
}

function ApprovalCard({ data, onApprove }: { data: WorkbenchData; onApprove: (d: "approve_full" | "request_evidence") => void }) {
  const [session, setSession] = useState<{ role: string; name: string }>({ role: "Quality Ops Lead", name: "Alex Morgan" });
  useEffect(() => setSession(getSession()), []);
  return (
    <div className="rb-panel border-orange-200 p-5" data-screen="qa-approval">
      <h3 className="text-sm font-semibold text-stone-800">QA approval checkpoint</h3>
      <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
        <Row label="Approver" value={`${session.name} · ${session.role}`} />
        <Row label="Scope" value={`${data.included.length} orders`} />
        <Row label="New status" value="Quarantined - QA Review" />
      </div>
      <p className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
        <span aria-hidden>⚠</span>
        Approving will mutate stored order states to Quarantined - QA Review. This is the governance line — the agent
        cannot bypass it.
      </p>
      <button
        data-approve-stop-ship
        onClick={() => onApprove("approve_full")}
        className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-red-700 active:translate-y-px"
      >
        Approve Stop-Ship
      </button>
      <button
        onClick={() => onApprove("request_evidence")}
        className="mt-2 w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
      >
        Request more evidence
      </button>
    </div>
  );
}

/* ============================ MUTATING ============================ */
const MUT_STEPS = ["Writing stored order states", "Reading back order statuses", "Saving Stop-Ship Packet"];
function MutatingView({ c, step }: { c: CaseRow; step: number }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
        <span className="h-2 w-2 rounded-full bg-red-500 rb-pulse" />
        Executing approved containment · {c.code}
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Mutating order state…</h2>
      <ol className="mt-6 space-y-3">
        {MUT_STEPS.map((label, i) => {
          const shown = i < step;
          const active = i === step;
          return (
            <li key={i} className={`rb-panel flex items-center gap-3 p-4 ${shown ? "rb-step" : "opacity-35"}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  shown ? "bg-emerald-100 text-emerald-700" : active ? "bg-red-100 text-red-700 rb-pulse" : "bg-stone-100 text-stone-400"
                }`}
              >
                {shown ? "✓" : i + 1}
              </span>
              <span className="text-sm font-medium text-stone-800">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ============================ SUCCESS ============================ */
function SuccessStage({ data }: { data: WorkbenchData }) {
  const c = data.case;
  const verified = data.included.filter((r) => r.verified === 1).length;
  const exception = c.status === "Mutation Exception";
  const monitor = c.status === "No Containment Needed";
  const zones = new Set(data.included.map((r) => r.zone)).size;
  const approval = data.approvals.find((a) => a.decision === "approve_full" || a.decision === "approve_partial");
  const verifiedAt = data.timeline.find((t) => t.event_type === "Stop-Ship Packet saved")?.created_at;

  if (monitor) {
    return (
      <div className="rb-panel p-8 text-center">
        <h1 className="text-2xl font-bold text-stone-900">No containment needed</h1>
        <p className="mt-2 text-stone-600">No eligible Ready to Ship orders, or confidence below the action floor.</p>
      </div>
    );
  }

  return (
    <div data-screen="mutation-result">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
            exception ? "bg-red-100" : "bg-emerald-100"
          }`}
        >
          {exception ? (
            <span className="text-2xl text-red-600">!</span>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-red-600 tnum">Case {c.code}</p>
          <h1 className="mt-0.5 text-3xl font-bold leading-tight tracking-tight text-stone-900 sm:text-4xl">
            {verified} orders quarantined for QA review.
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <span aria-hidden>✓</span> {verified} expected, {verified} verified.
          </p>
        </div>
      </div>

      <CaseHeaderCard data={data} />

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <BeforeAfterDiff count={verified} executedAt={verifiedAt} approver={approval} />
          <AffectedOrdersTable included={data.included} excluded={data.excluded} highlight={data.orderHighlight} />
          <ContainmentSummary
            orders={verified}
            valueCents={data.includedValueCents}
            zones={zones}
            verifiedAt={verifiedAt}
          />
        </div>
        <div className="space-y-5">
          {data.packetCode && <PacketPreview data={data} />}
          <ReopenHint />
        </div>
      </div>
    </div>
  );
}

function BeforeAfterDiff({
  count,
  executedAt,
  approver,
}: {
  count: number;
  executedAt?: string;
  approver?: ApprovalRow;
}) {
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Affected orders</h3>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Before</div>
          <StatusChip className="mx-auto mt-2" label="Ready to Ship" style={orderChip("Ready to Ship")} />
          <div className="mt-3 text-3xl font-bold text-stone-900 tnum">{count}</div>
          <div className="text-xs text-stone-500">orders</div>
        </div>
        <div className="text-2xl text-stone-300">→</div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-red-400">After</div>
          <StatusChip className="mx-auto mt-2" label="Quarantined - QA Review" style={orderChip("Quarantined - QA Review")} />
          <div className="mt-3 text-3xl font-bold text-red-700 tnum">{count}</div>
          <div className="text-xs text-red-500">orders</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
        {executedAt && (
          <span>
            Containment executed: <span className="font-medium text-stone-700">{dateTime(executedAt)}</span>
          </span>
        )}
        {approver && (
          <span>
            Executed by: <span className="font-medium text-stone-700">{approver.approver_name} ({approver.approver_role})</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ContainmentSummary({
  orders,
  valueCents,
  zones,
  verifiedAt,
}: {
  orders: number;
  valueCents: number;
  zones: number;
  verifiedAt?: string;
}) {
  return (
    <div className="rb-panel grid grid-cols-2 gap-px overflow-hidden bg-stone-200 sm:grid-cols-4">
      <Stat label="Scope" value="1 warehouse" />
      <Stat label="Orders" value={String(orders)} />
      <Stat label="Order value held" value={usd(valueCents)} />
      <Stat label="Zones" value={String(zones)} />
    </div>
  );
}

function PacketPreview({ data }: { data: WorkbenchData }) {
  const c = data.case;
  return (
    <div className="rb-panel p-5" data-packet-preview>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-800">Stop-Ship Packet</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          {c.status === "Mutation Exception" ? "Pending" : "Saved"}
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <span className="text-xs font-semibold text-red-600">RED BATCH</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Stop-Ship Packet</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <Mini label="Packet ID" value={data.packetCode ?? ""} />
          <Mini label="Case ID" value={c.code} />
          <Mini label="Orders quarantined" value={String(data.included.filter((r) => r.verified === 1).length)} />
          <Mini label="Warehouse" value={c.warehouse} />
        </div>
      </div>
      <Link
        href={`/packets/${data.packetCode}`}
        className="mt-4 flex w-full items-center justify-center rounded-lg bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
      >
        Open Stop-Ship Packet →
      </Link>
    </div>
  );
}

function ReopenHint() {
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Reopen later</h3>
      <p className="mt-1 text-sm text-stone-500">
        Anyone can reopen this case by order, lot, case, or packet ID — without rerunning containment.
      </p>
      <Link href="/reopen" className="mt-3 inline-block text-sm font-medium text-red-600 hover:text-red-700">
        Open reopen / search →
      </Link>
    </div>
  );
}

/* ============================ HUMAN REVIEW ============================ */
function HumanReviewStage({ data, onApprove }: { data: WorkbenchData; onApprove: (d: "approve_partial" | "request_evidence") => void }) {
  const c = data.case;
  const byZone = useMemo(() => {
    const all = [...data.included, ...data.excluded.filter((r) => r.mutation_result !== "excluded")];
    const candidates = [...data.included]; // included = proposed partial hold
    const map = new Map<string, { candidates: number; proposed: number }>();
    for (const r of [...data.included, ...data.excluded]) {
      if (r.before_status !== "Ready to Ship") continue;
      const cur = map.get(r.zone) ?? { candidates: 0, proposed: 0 };
      cur.candidates += 1;
      if (r.included === 1) cur.proposed += 1;
      map.set(r.zone, cur);
    }
    void all;
    void candidates;
    return [...map.entries()].sort((a, b) => b[1].candidates - a[1].candidates);
  }, [data.included, data.excluded]);

  const task = data.evidenceTasks[0];

  return (
    <>
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 tnum">
        Active case / {c.code}
      </p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">Human Review Required</h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        The system is not confident enough to act automatically. Review the ambiguity and complete the evidence task to
        continue.
      </p>

      <CaseHeaderCard data={data} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rb-panel p-5">
            <h3 className="text-sm font-semibold text-stone-800">Risk summary</h3>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Field label="lot" value={c.lot} mono />
              <Field label="warehouse" value={c.warehouse} mono />
              <Field label="severity" value={c.severity} />
              <Field label="confidence" value={c.confidence.toFixed(2)} mono />
            </div>
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-stone-500">Confidence below full-stop threshold</div>
              <ConfidenceMeter value={c.confidence} threshold={c.threshold} />
            </div>
          </div>

          <div className="rb-panel p-5">
            <h3 className="text-sm font-semibold text-stone-800">Ambiguity reason</h3>
            <p className="mt-2 text-sm text-stone-600">{data.signal?.summary}</p>
          </div>

          {task && (
            <div className="rb-panel p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-800">Evidence task</h3>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                  {data.evidenceTasks.length} {data.evidenceTasks.length === 1 ? "task" : "tasks"} · {task.status}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-stone-200 p-3">
                <div className="text-sm font-medium text-stone-800">{task.label}</div>
                <div className="mt-0.5 text-xs text-stone-500">{task.detail}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rb-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">Partial scope</h3>
              <span className="text-xs text-stone-400">limited affected scope</span>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 text-right font-medium">Candidate orders</th>
                  <th className="pb-2 text-right font-medium">Proposed hold</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {byZone.map(([zone, v]) => (
                  <tr key={zone} className="border-b border-stone-100">
                    <td className="py-2 font-medium text-stone-700">{zone}</td>
                    <td className="py-2 text-right text-stone-600">{v.candidates}</td>
                    <td className="py-2 text-right font-semibold text-red-700">{v.proposed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rb-panel border-amber-200 p-5">
            <h3 className="text-sm font-semibold text-stone-800">Recommended next step</h3>
            <p className="mt-1 text-sm text-stone-500">
              Complete the evidence task to refine confidence, or approve a partial hold of the highest-confidence zone
              now. The case resumes once confidence meets the threshold.
            </p>
            <button
              onClick={() => onApprove("approve_partial")}
              className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Approve partial hold ({data.included.length})
            </button>
            <button
              onClick={() => onApprove("request_evidence")}
              className="mt-2 w-full rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Open evidence task
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <MiniTimeline timeline={data.timeline} />
      </div>
    </>
  );
}

/* ============================ SHARED PIECES ============================ */
function CaseHeaderCard({ data }: { data: WorkbenchData }) {
  const c = data.case;
  const cc = caseChip(c.status);
  return (
    <div className="rb-panel mt-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>
        <div>
          <div className="text-base font-semibold text-stone-900">{c.title}</div>
          <div className="mt-0.5 text-xs text-stone-500 tnum">
            Case ID: {c.code} • Opened {dateTime(c.created_at)}
          </div>
        </div>
      </div>
      <StatusChip label={c.status} style={cc} />
    </div>
  );
}

function RiskSummary({ data }: { data: WorkbenchData }) {
  const c = data.case;
  const sc = severityChip(c.severity);
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Risk summary</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="lot" value={c.lot} mono />
        <Field label="warehouse" value={c.warehouse} mono />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-stone-400">severity</div>
          <StatusChip className="mt-1" label={c.severity} style={sc} />
        </div>
        <Field label="confidence" value={c.confidence.toFixed(2)} mono />
      </div>
    </div>
  );
}

function CaseDetails({ data }: { data: WorkbenchData }) {
  const c = data.case;
  const s = data.signal;
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Case details</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <DRow k="issue" v={s?.summary ?? c.title} />
        <DRow k="product" v={c.sku} />
        <DRow k="lot" v={c.lot} />
        <DRow k="reported on" v={s ? dateTime(s.received_at) : "—"} />
        <DRow k="source" v={s?.source ?? "—"} />
      </dl>
    </div>
  );
}

function EvidenceList({ evidence, compact }: { evidence: WorkbenchData["evidence"]; compact?: boolean }) {
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Evidence ({evidence.length})</h3>
      <ul className="mt-3 space-y-2">
        {evidence.map((e, i) => (
          <li key={i} className="rounded-lg border border-stone-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700">{e.label}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                {e.kind}
              </span>
            </div>
            {!compact && <p className="mt-1 text-xs text-stone-500">{e.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsequencePreview({ preview, c }: { preview: number | null; c: CaseRow }) {
  return (
    <div className="rb-panel border-red-200 bg-red-50/40 p-5">
      <h3 className="text-sm font-semibold text-stone-800">Consequence preview</h3>
      <div className="mt-3 flex items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-red-200">
        <span className="mt-0.5 text-red-600" aria-hidden>
          ⚠
        </span>
        <p className="text-sm text-stone-700">
          {preview != null ? (
            <>
              <span className="font-semibold text-red-700 tnum">{preview} Ready to Ship orders</span> may be affected if
              lot {c.lot} is confirmed.
            </>
          ) : (
            <>Orders for lot {c.lot} may be affected. Run containment to see the exact scope.</>
          )}
        </p>
      </div>
    </div>
  );
}

function ScopePanel({ data, preview }: { data: WorkbenchData; preview: number | null }) {
  const c = data.case;
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Scope</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <DRow k="warehouse" v={c.warehouse} />
        <DRow k="related lot" v={c.lot} />
        <DRow k="ready to ship orders" v={preview != null ? `${preview} orders` : "run to compute"} />
      </dl>
    </div>
  );
}

function AffectedOrdersTable({
  included,
  excluded,
  highlight,
}: {
  included: CaseOrderRow[];
  excluded: CaseOrderRow[];
  highlight: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const rows = showAll ? included : included.slice(0, 8);
  const isFinal = included.some((r) => r.final_status === "Quarantined - QA Review");
  return (
    <div className="rb-panel overflow-hidden" data-affected-order-table>
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-stone-800">
          {isFinal ? "Quarantined orders" : "Proposed orders"} ({included.length})
        </h3>
        <span className="text-xs text-stone-400">{excluded.length} excluded</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="px-5 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Zone</th>
              <th className="px-3 py-2 font-medium">Before</th>
              <th className="px-3 py-2 font-medium">{isFinal ? "Now" : "Proposed"}</th>
              <th className="px-5 py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((r) => {
              const hot = highlight && r.order_code === highlight;
              const after = (r.final_status ?? r.proposed_status) as OrderStatus;
              return (
                <tr key={r.id} className={`border-b border-stone-100 ${hot ? "bg-amber-50" : ""}`} data-order-row={r.order_code}>
                  <td className="px-5 py-2.5 font-medium text-stone-700">
                    {r.order_code}
                    {hot && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] text-amber-800">searched</span>}
                  </td>
                  <td className="px-3 py-2.5 text-stone-500">{r.zone}</td>
                  <td className="px-3 py-2.5">
                    <StatusChip label={r.before_status} style={orderChip(r.before_status)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip label={after} style={orderChip(after)} />
                  </td>
                  <td className="px-5 py-2.5 text-right text-stone-600">{usd(r.value_cents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {included.length > 8 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-500 hover:bg-stone-50"
        >
          {showAll ? "Show fewer" : `Show all ${included.length} orders`}
        </button>
      )}
      {excluded.length > 0 && (
        <div className="border-t border-stone-200">
          <button
            onClick={() => setShowExcluded((v) => !v)}
            className="w-full px-5 py-2.5 text-left text-sm font-medium text-stone-500 hover:bg-stone-50"
          >
            {showExcluded ? "▲" : "▼"} Excluded orders ({excluded.length}) — why they were not held
          </button>
          {showExcluded && (
            <ul className="space-y-1 px-5 pb-4 text-xs text-stone-500">
              {excluded.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 tnum">
                  <span className="font-medium text-stone-600">{r.order_code}</span>
                  <span className="text-right">{r.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MiniTimeline({ timeline }: { timeline: TimelineEventRow[] }) {
  return (
    <div className="rb-panel p-5">
      <h3 className="text-sm font-semibold text-stone-800">Case timeline</h3>
      <ol className="mt-3 space-y-3">
        {timeline.map((t) => (
          <li key={t.id} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-stone-700">{t.event_type}</div>
              <div className="text-xs text-stone-500">
                {t.actor} • {dateTime(t.created_at)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* small atoms */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`mt-1 font-semibold text-stone-800 ${mono ? "tnum" : ""}`}>{value}</div>
    </div>
  );
}
function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-400">{k}</dt>
      <dd className="text-right font-medium text-stone-700">{v}</dd>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-800 tnum">{value}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-stone-900 tnum">{value}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="font-semibold text-stone-800 tnum">{value}</div>
    </div>
  );
}

/* helpers */
const DEFAULT_TRACE: TraceStep[] = [
  { phase: "observe", title: "Observe signal", detail: "Reading complaint, severity, and confidence." },
  { phase: "map", title: "Map lot / SKU / warehouse", detail: "Resolving the suspected lot to SKU and warehouse." },
  { phase: "fanout", title: "Fan out affected orders", detail: "Finding Ready to Ship orders in scope." },
  { phase: "classify", title: "Classify exclusions", detail: "Separating eligible orders from excluded ones." },
  { phase: "approval", title: "Prepare QA approval", detail: "Staging the human checkpoint." },
];
function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function revealSequentially(total: number, setter: (n: number) => void, perMs: number): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    setter(0);
    const id = setInterval(() => {
      i += 1;
      setter(i);
      if (i >= total) {
        clearInterval(id);
        resolve();
      }
    }, perMs);
  });
}
