import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";
import { StatusChip } from "@/app/components/StatusChip";
import { ensureSeeded, listCases } from "@/app/lib/repo";
import { caseChip, severityChip } from "@/app/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function CasesPage() {
  ensureSeeded();
  const cases = listCases();

  return (
    <AppShell active="cases">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Containment cases</h1>
          <p className="mt-1 text-sm text-stone-500">
            Active and resolved product-safety cases in this workspace.
          </p>
        </div>

        {cases.length === 0 ? (
          <div className="rb-panel p-10 text-center">
            <p className="text-stone-600">No demo cases are loaded for this workspace.</p>
            <Link href="/" className="mt-3 inline-block text-sm font-medium text-red-600 hover:text-red-700">
              Reset demo workspace →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {cases.map((c) => {
              const cc = caseChip(c.status);
              const sc = severityChip(c.severity);
              return (
                <Link
                  key={c.code}
                  href={`/cases/${c.code}`}
                  className="rb-panel group flex flex-col gap-3 p-5 transition hover:border-stone-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-red-600 tnum">{c.code}</span>
                      <StatusChip label={c.severity} style={sc} />
                    </div>
                    <div className="mt-1 truncate text-base font-semibold text-stone-900">{c.title}</div>
                    <div className="mt-1 text-sm text-stone-500 tnum">
                      lot {c.lot} • {c.warehouse} • confidence {c.confidence.toFixed(2)}
                      {c.affected_count > 0 ? ` • ${c.affected_count} in scope` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusChip label={c.status} style={cc} />
                    {c.packet_code && (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 tnum">
                        {c.packet_code}
                      </span>
                    )}
                    <span className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
