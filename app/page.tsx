"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/app/components/Logo";
import { ROLES, type Role } from "@/app/lib/types";
import { setSession } from "@/app/lib/session";

interface Status {
  db: { ok: boolean; detail: string };
  uipath: { mode: string; connected: boolean; detail: string };
  llm: { available: boolean; detail: string };
}

export default function EntryPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Quality Ops Lead");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/integration-status")
      .then((r) => r.json() as Promise<Status>)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  function open() {
    setSession(role);
    router.push("/cases/RB-2049");
  }

  async function resetDemo() {
    setBusy(true);
    await fetch("/api/demo/reset", { method: "POST" }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <Wordmark size={28} />
          <div className="hidden items-center gap-2 text-xs text-stone-500 sm:flex">
            <span className="rounded-full bg-stone-200/70 px-2.5 py-1">UiPath Maestro Case</span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">Product-safety containment</span>
          </div>
        </div>

        <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-2">
          {/* Left: value */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">Live containment case</p>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-stone-900 sm:text-5xl">
              Stop the right shipments before one bad product becomes dozens of bad customer moments.
            </h1>
            <p className="mt-5 max-w-md text-lg text-stone-600">
              A battery-overheat complaint just landed while matching orders are still{" "}
              <span className="font-semibold text-stone-800">Ready to Ship</span>. Red Batch traces the bad lot, gets QA
              approval, and freezes exactly the right orders — with a saved Stop-Ship Packet to prove it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <Step n="1" label="Run containment" />
              <Arrow />
              <Step n="2" label="QA approves" />
              <Arrow />
              <Step n="3" label="Orders quarantined" />
            </div>
          </div>

          {/* Right: entry card */}
          <div className="rb-panel p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-stone-900">Operate the demo</h2>
            <p className="mt-1 text-sm text-stone-500">
              Pick a role to enter the prepared sandbox. No setup, no builder console.
            </p>

            <div className="mt-5">
              <label className="text-xs font-medium uppercase tracking-wide text-stone-500">Demo role</label>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Demo role">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                      role === r
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={open}
              className="mt-6 w-full rounded-lg bg-red-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-red-700 active:translate-y-px"
            >
              Open active case →
            </button>

            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <Link href="/cases" className="text-stone-500 hover:text-stone-800">
                All cases
              </Link>
              <span className="text-stone-300">•</span>
              <Link href="/reopen" className="text-stone-500 hover:text-stone-800">
                Reopen a packet
              </Link>
            </div>
          </div>
        </div>

        {/* Footer: honest integration status */}
        <div className="mt-auto border-t border-stone-200 pt-4">
          <div className="flex flex-col gap-2 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Pill ok={status?.db.ok} label="Owned SQL store" detail={status?.db.detail} />
              <Pill
                ok={status?.uipath.connected}
                neutral={status?.uipath.mode === "local-governed"}
                label={status?.uipath.mode === "cloud" ? "UiPath Cloud" : "UiPath governance (local)"}
                detail={status?.uipath.detail}
              />
              <Pill ok={status?.llm.available} neutral label="Agent narration" detail={status?.llm.detail} />
            </div>
            <button onClick={resetDemo} disabled={busy} className="self-start text-stone-400 underline hover:text-stone-700 sm:self-auto">
              {busy ? "Resetting…" : "Reset demo workspace"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-stone-200">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
        {n}
      </span>
      {label}
    </span>
  );
}
function Arrow() {
  return <span className="text-stone-300">→</span>;
}
function Pill({ ok, neutral, label, detail }: { ok?: boolean; neutral?: boolean; label: string; detail?: string }) {
  const color = neutral ? "bg-stone-400" : ok ? "bg-emerald-500" : "bg-stone-300";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1" title={detail}>
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
