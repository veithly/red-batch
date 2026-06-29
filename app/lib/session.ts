"use client";

import type { Role } from "@/app/lib/types";

export interface Session {
  role: Role;
  name: string;
}

const KEY = "redbatch.session";

export const ROLE_NAMES: Record<Role, string> = {
  "Quality Ops Lead": "Alex Morgan",
  "QA Manager": "Priya Shah",
  "Customer Ops": "Jordan Lee",
  Auditor: "Sam Rivera",
};

export function getSession(): Session {
  if (typeof window === "undefined") return { role: "Quality Ops Lead", name: ROLE_NAMES["Quality Ops Lead"] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* ignore */
  }
  return { role: "Quality Ops Lead", name: ROLE_NAMES["Quality Ops Lead"] };
}

export function setSession(role: Role): Session {
  const s: Session = { role, name: ROLE_NAMES[role] };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}
