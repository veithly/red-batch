import { NextResponse } from "next/server";
import { approveAndExecute, type ApproveInput } from "@/app/lib/agent/containmentAgent";
import { ensureSeeded } from "@/app/lib/repo";
import type { ApprovalDecision } from "@/app/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS: ApprovalDecision[] = ["approve_full", "approve_partial", "request_evidence", "reject"];

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await ensureSeeded();
    const body = (await req.json().catch(() => ({}))) as Partial<ApproveInput>;
    const decision = body.decision;
    if (!decision || !DECISIONS.includes(decision)) {
      return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }
    const result = await approveAndExecute(code, {
      role: body.role || "QA Manager",
      name: body.name || "Demo Approver",
      decision,
      reason: body.reason,
    });
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { code?: number };
    return NextResponse.json({ ok: false, error: err.message }, { status: err.code ?? 500 });
  }
}
