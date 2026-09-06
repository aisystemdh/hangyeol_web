import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { loadNotifyFailed, loadNotifyTemplates, loadNotifyTodo } from "@/lib/admin-notify";

/**
 * GET /api/admin/notify — 알림톡 발송 화면 상단 두 목록 + 고를 수 있는 문구 (이슈 #37).
 *
 * 🔴 `src/proxy.ts`가 `/api/admin/:path*`를 이미 막지만, 다른 운영자 라우트와 같이
 *    여기서 **다시 한 번** `isAdmin()`을 확인한다(`CLAUDE.md` "화면에서 한 번,
 *    API 하나하나에서 또 한 번").
 *
 * 서버 컴포넌트(`/admin/notify` 첫 렌더)와 이 라우트(폴링)가 **같은 조회 함수**를
 * 쓴다 — `admin-data.ts`의 신청 목록과 같은 이유다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [todo, failed, templates] = await Promise.all([
    loadNotifyTodo(),
    loadNotifyFailed(),
    loadNotifyTemplates(),
  ]);

  return NextResponse.json({ ok: true, data: { todo, failed, templates } });
}
