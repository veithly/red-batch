import { NextResponse } from "next/server";
import { ensureSeeded, getPacketByCode, addTimeline, getCaseById } from "@/app/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await ensureSeeded();
  const packet = await getPacketByCode(code);
  if (!packet) return NextResponse.json({ ok: false, error: "Packet not found" }, { status: 404 });
  const c = await getCaseById(packet.case_id);
  if (c) await addTimeline(c.id, "Customer Ops", "Packet reopened", `Packet ${code} reopened for inspection.`, { phase: "reopen" });
  return NextResponse.json({
    ok: true,
    code: packet.code,
    status: packet.status,
    caseCode: c?.code ?? null,
    summary: JSON.parse(packet.summary_json),
    createdAt: packet.created_at,
  });
}
