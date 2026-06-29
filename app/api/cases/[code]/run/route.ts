import { NextResponse } from "next/server";
import { runContainment } from "@/app/lib/agent/containmentAgent";
import { ensureSeeded } from "@/app/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    await ensureSeeded();
    const result = await runContainment(code);
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { code?: number };
    return NextResponse.json({ ok: false, error: err.message }, { status: err.code ?? 500 });
  }
}
