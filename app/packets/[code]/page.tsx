import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { StatusChip } from "@/app/components/StatusChip";
import { GovernancePanel } from "@/app/components/GovernancePanel";
import {
  addTimeline,
  ensureSeeded,
  getCaseById,
  getGovernedRuns,
  getPacketByCode,
} from "@/app/lib/repo";
import { dateTime, orderChip, usd } from "@/app/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PacketSummary {
  packetCode: string;
  caseCode: string;
  title: string;
  outcome: string;
  verifiedAt: string;
  approver: { name: string; role: string };
  scope: { lot: string; sku: string; warehouse: string; severity: string; confidence: number };
  signal: { id: string; summary: string; source: string; receivedAt: string } | null;
  evidence: { kind: string; label: string; detail: string }[];
  diff: { before: string; after: string; count: number };
  verification: { expected: number; changed: number };
  exclusions: { order: string; reason: string; status: string }[];
  valueCents: number;
}

export default async function PacketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await ensureSeeded();
  const packet = await getPacketByCode(code);

  if (!packet) {
    return (
      <AppShell active="reopen">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-stone-900">Packet {code} not found</h1>
          <p className="mt-2 text-stone-500">Search by case ID, lot ID, or order ID to find a saved packet.</p>
          <Link href="/reopen" className="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-700">
            Go to reopen / search →
          </Link>
        </div>
      </AppShell>
    );
  }

  const c = await getCaseById(packet.case_id);
  const s = JSON.parse(packet.summary_json) as PacketSummary;
  if (c) await addTimeline(c.id, "Customer Ops", "Packet reopened", `Packet ${code} reopened for inspection.`, { phase: "reopen" });
  const runs = c ? await getGovernedRuns(c.id) : [];

  return (
    <AppShell active="reopen">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <Link href={`/cases/${s.caseCode}`} className="text-sm text-stone-500 hover:text-stone-800">
          ← Back to case {s.caseCode}
        </Link>

        {/* header */}
        <div className="mt-3 rb-panel p-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <span className="text-base font-semibold text-red-600">RED BATCH</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Stop-Ship Packet</span>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 tnum">{s.packetCode}</h1>
              <p className="mt-1 text-stone-600">{s.outcome}</p>
            </div>
            <StatusChip
              label={packet.status === "Final" ? "Final" : packet.status}
              style={
                packet.status === "Final"
                  ? { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" }
                  : { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }
              }
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta label="Case ID" value={s.caseCode} />
            <Meta label="Verified" value={dateTime(s.verifiedAt)} />
            <Meta label="Approver" value={`${s.approver.name}`} />
            <Meta label="Order value held" value={usd(s.valueCents)} />
          </div>
        </div>

        {/* diff */}
        <Section title="Order-state change">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Box label="Before" tone="neutral">
              <StatusChip label={s.diff.before} style={orderChip("Ready to Ship")} />
              <div className="mt-2 text-2xl font-bold text-stone-900 tnum">{s.diff.count}</div>
            </Box>
            <span className="text-xl text-stone-300">→</span>
            <Box label="After" tone="red">
              <StatusChip label={s.diff.after} style={orderChip("Quarantined - QA Review")} />
              <div className="mt-2 text-2xl font-bold text-red-700 tnum">{s.verification.changed}</div>
            </Box>
          </div>
          <p className="mt-3 text-sm text-stone-500 tnum">
            Verification: {s.verification.changed} of {s.verification.expected} orders verified as {s.diff.after}.
          </p>
        </Section>

        {/* risk signal */}
        {s.signal && (
          <Section title="Risk signal">
            <dl className="space-y-2 text-sm">
              <DRow k="signal" v={s.signal.id} />
              <DRow k="summary" v={s.signal.summary} />
              <DRow k="source" v={s.signal.source} />
              <DRow k="lot / SKU" v={`${s.scope.lot} • ${s.scope.sku}`} />
              <DRow k="warehouse" v={s.scope.warehouse} />
              <DRow k="severity / confidence" v={`${s.scope.severity} • ${s.scope.confidence.toFixed(2)}`} />
            </dl>
          </Section>
        )}

        {/* evidence */}
        <Section title={`Evidence (${s.evidence.length})`}>
          <ul className="space-y-2">
            {s.evidence.map((e, i) => (
              <li key={i} className="rounded-lg border border-stone-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">{e.label}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                    {e.kind}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{e.detail}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* approval */}
        <Section title="QA approval">
          <dl className="space-y-2 text-sm">
            <DRow k="approver" v={`${s.approver.name} (${s.approver.role})`} />
            <DRow k="decision" v="Approve stop-ship" />
            <DRow k="scope" v={`${s.diff.count} orders`} />
            <DRow k="timestamp" v={dateTime(s.verifiedAt)} />
          </dl>
        </Section>

        {/* exclusions */}
        {s.exclusions.length > 0 && (
          <Section title={`Exclusions (${s.exclusions.length})`}>
            <ul className="space-y-1 text-xs text-stone-500">
              {s.exclusions.map((x, i) => (
                <li key={i} className="flex justify-between gap-3 tnum">
                  <span className="font-medium text-stone-600">{x.order}</span>
                  <span className="text-right">{x.reason}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-6">
          <GovernancePanel caseCode={s.caseCode} runs={runs} integration={{ db: { ok: true, detail: "" }, uipath: { mode: runs[0]?.mode === "cloud" ? "cloud" : "local-governed", connected: runs[0]?.mode === "cloud", detail: "Replay metadata for this packet." }, llm: { available: false, detail: "" } }} />
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rb-panel p-5">
      <h2 className="mb-3 text-sm font-semibold text-stone-800">{title}</h2>
      {children}
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="truncate text-sm font-medium text-stone-800 tnum">{value}</div>
    </div>
  );
}
function Box({ label, tone, children }: { label: string; tone: "neutral" | "red"; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${tone === "red" ? "border-red-200 bg-red-50" : "border-stone-200 bg-stone-50"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      <div className="mt-2 flex flex-col items-center">{children}</div>
    </div>
  );
}
function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-stone-400">{k}</dt>
      <dd className="text-right font-medium text-stone-700">{v}</dd>
    </div>
  );
}
