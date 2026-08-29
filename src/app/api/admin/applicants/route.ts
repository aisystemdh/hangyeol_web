import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { loadBoard } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 현황판 30초 갱신용. 첫 화면은 서버 컴포넌트가 직접 그린다. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const data = await loadBoard();
  return NextResponse.json({ ok: true, ...data });
}
