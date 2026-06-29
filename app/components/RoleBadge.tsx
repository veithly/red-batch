"use client";

import { useEffect, useState } from "react";
import { getSession, type Session } from "@/app/lib/session";

export function RoleBadge({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<Session | null>(null);
  useEffect(() => {
    setS(getSession());
  }, []);
  const initials = (s?.name ?? "AM")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
        {initials}
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-medium text-stone-800">{s?.name ?? "—"}</div>
          <div className="text-xs text-stone-500">{s?.role ?? "—"}</div>
        </div>
      )}
    </div>
  );
}
