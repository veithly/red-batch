import type { ContainmentPlan, Severity } from "@/app/lib/types";

export const FULL_STOP_THRESHOLD = 0.7;
export const MONITOR_FLOOR = 0.35;

export interface PolicyDecision {
  plan: ContainmentPlan;
  approvalRequired: boolean;
  rationale: string;
}

export function decidePlan(confidence: number, severity: Severity, eligibleCount: number): PolicyDecision {
  if (eligibleCount === 0) {
    return {
      plan: "monitor",
      approvalRequired: false,
      rationale: "No eligible Ready to Ship orders found in the declared lot and warehouse scope.",
    };
  }
  const severe = severity === "High" || severity === "Critical";
  if (confidence >= FULL_STOP_THRESHOLD && severe) {
    return {
      plan: "full_stop",
      approvalRequired: true,
      rationale: `Confidence ${confidence.toFixed(2)} ≥ ${FULL_STOP_THRESHOLD.toFixed(
        2,
      )} threshold and severity ${severity}. Propose a full stop-ship for QA approval.`,
    };
  }
  if (confidence >= MONITOR_FLOOR) {
    return {
      plan: "human_review",
      approvalRequired: true,
      rationale: `Confidence ${confidence.toFixed(2)} is below the full-stop threshold ${FULL_STOP_THRESHOLD.toFixed(
        2,
      )}. Route to human review with a partial scope and an evidence task instead of an automatic stop-ship.`,
    };
  }
  return {
    plan: "monitor",
    approvalRequired: false,
    rationale: `Confidence ${confidence.toFixed(2)} is below the monitor floor ${MONITOR_FLOOR.toFixed(
      2,
    )}. Monitor only; no stop-ship proposed.`,
  };
}

export function scopeHashOf(orderCodes: string[]): string {
  const s = [...orderCodes].sort().join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return "scope_" + (h >>> 0).toString(16) + "_" + orderCodes.length;
}
