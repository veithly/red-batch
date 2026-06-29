import type { CaseStatus, OrderStatus } from "@/app/lib/types";

export function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export interface ChipStyle {
  bg: string;
  text: string;
  dot: string;
}

export function caseChip(status: CaseStatus): ChipStyle {
  switch (status) {
    case "Ready for Containment":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    case "Analyzing":
    case "Mutating Orders":
    case "Verifying":
      return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
    case "Awaiting QA Approval":
      return { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" };
    case "Verified":
    case "Packet Saved":
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "Human Review Required":
    case "Evidence Requested":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    case "Mutation Exception":
      return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-600" };
    case "No Containment Needed":
      return { bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-400" };
    default:
      return { bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-400" };
  }
}

export function orderChip(status: OrderStatus): ChipStyle {
  switch (status) {
    case "Ready to Ship":
      return { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" };
    case "Quarantined - QA Review":
      return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-600" };
    case "Shipped":
      return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
    case "Delivered":
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "Cancelled":
      return { bg: "bg-stone-100", text: "text-stone-500", dot: "bg-stone-400" };
    case "On Hold":
      return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
    default:
      return { bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-400" };
  }
}

export function severityChip(sev: string): ChipStyle {
  if (sev === "Critical" || sev === "High") return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-600" };
  if (sev === "Medium") return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
  return { bg: "bg-stone-100", text: "text-stone-600", dot: "bg-stone-400" };
}
