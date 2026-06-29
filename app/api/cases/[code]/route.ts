import { NextResponse } from "next/server";
import { getCaseDetail } from "@/app/lib/caseDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getCaseDetail(code);
  if (!detail) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...detail });
}
