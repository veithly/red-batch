"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";

interface Result {
  kind: "order" | "case" | "packet" | "lot";
  code: string;
  label: string;
  href: string;
  detail: string;
}

const EXAMPLES = ["O-1042", "RB-2049", "RB-PKT-2049", "RB-7712"];

export default function ReopenPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pre = params.get("order") || params.get("q");
    if (pre) {
      setQ(pre);
      void doSearch(pre);
    }
  }, [doSearch]);

  return (
    <AppShell active="reopen">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Reopen / search</h1>
        <p className="mt-1 text-sm text-stone-500">
          Find a saved case or Stop-Ship Packet by order, lot, case, or packet ID. Reopening never reruns containment.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doSearch(q);
          }}
          className="mt-5 flex gap-2"
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order, lot, case, or packet…"
            className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          />
          <button className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
            Search
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQ(ex);
                void doSearch(ex);
              }}
              className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 hover:bg-stone-200 tnum"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading && <p className="text-sm text-stone-400">Searching saved cases…</p>}
          {!loading && results && results.length === 0 && (
            <div className="rb-panel p-8 text-center text-sm text-stone-500">
              No saved case or packet found for “{q}”.
            </div>
          )}
          {!loading && results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={i}>
                  <Link
                    href={r.href}
                    className="rb-panel flex items-center justify-between p-4 transition hover:border-stone-300 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                          {r.kind}
                        </span>
                        <span className="truncate text-sm font-semibold text-stone-800">{r.label}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-stone-500 tnum">{r.detail}</div>
                    </div>
                    <span className="text-stone-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
