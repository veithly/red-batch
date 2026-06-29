"use client";

import { useState } from "react";
import type { GovernedRunRow } from "@/app/lib/types";

interface IntegrationLite {
  db: { ok: boolean; detail: string };
  uipath: { mode: string; connected: boolean; detail: string };
  llm: { available: boolean; detail: string };
}

const STEP_LABELS: Record<string, string> = {
  containment: "Maestro Case · Agent run",
  order_mutation: "Order Mutation Workflow",
  approval_task: "QA Approval Task",
  verification: "Verification Readback",
  packet: "Stop-Ship Packet",
};

export function GovernancePanel({
  caseCode,
  runs,
  integration,
}: {
  caseCode: string;
  runs: GovernedRunRow[];
  integration: IntegrationLite;
}) {
  const [open, setOpen] = useState(false);
  const mode = integration.uipath.mode;

  return (
    <div className="rb-panel overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l8 3v5c0 4.5-3.2 8-8 10-4.8-2-8-5.5-8-10V6l8-3z" strokeLinejoin="round" />
          </svg>
          Governance proof
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              mode === "cloud" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
            }`}
          >
            {mode === "cloud" ? "UiPath Cloud" : "UiPath governance · local"}
          </span>
        </span>
        <span className="text-stone-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-stone-200 px-5 py-4">
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Meta label="Maestro Case" value={caseCode} />
            <Meta label="Agent" value="Batch Containment Agent" />
            <Meta label="Mode" value={mode === "cloud" ? "Automation Cloud" : "Local governed"} />
          </div>
          <p className="mb-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">{integration.uipath.detail}</p>
          <ol className="space-y-2">
            {runs.length === 0 && <li className="text-sm text-stone-400">No governed runs yet.</li>}
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-800">{STEP_LABELS[r.kind] ?? r.kind}</div>
                  <div className="truncate text-[11px] text-stone-500 tnum">{r.run_ref}</div>
                  {r.detail?.startsWith("http") && (
                    <a
                      href={r.detail}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                    >
                      View in UiPath Action Center →
                    </a>
                  )}
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    r.status === "final" || r.status === "verified" || r.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
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
