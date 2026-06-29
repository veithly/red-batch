import { NextResponse } from "next/server";
import { resetWorkspace } from "@/app/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await resetWorkspace();
  return NextResponse.json({ ok: true, message: "Demo workspace reset and reseeded." });
}
