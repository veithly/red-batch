import { NextResponse } from "next/server";
import { ensureSeeded } from "@/app/lib/repo";
import { getIntegrationStatus } from "@/app/lib/uipath/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  ensureSeeded();
  return NextResponse.json({ ok: true, ...getIntegrationStatus() });
}
