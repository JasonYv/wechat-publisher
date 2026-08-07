import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    getDatabase().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, service: "wechat-publisher" });
  } catch {
    return NextResponse.json(
      { ok: false, service: "wechat-publisher" },
      { status: 503 },
    );
  }
}
