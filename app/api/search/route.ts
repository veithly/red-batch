import { NextResponse } from "next/server";
import { ensureSeeded, search } from "@/app/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ ok: true, query: q, results: await search(q) });
}
