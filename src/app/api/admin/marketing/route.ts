import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { loadFunnel, loadSourceCounts } from "@/lib/admin-marketing";

/**
 * GET /api/admin/marketing — 유입 경로별 신청 수 + 퍼널 네 단계 (이슈 #41).
 *
 * 🔴 `src/proxy.ts`가 `/api/admin/:path*`를 이미 막고 있지만, 여기서 **다시 한 번**
 *    `isAdmin()`을 확인한다(`CLAUDE.md` "화면에서 한 번, API 하나하나에서 또 한 번").
 *
 * 서버 컴포넌트(`/admin/marketing` 첫 렌더)와 이 라우트(30초 갱신)가 **같은 조회
 * 함수**(`admin-marketing.ts`)를 쓴다 — `/admin`(#34)과 같은 이유다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [sources, funnel] = await Promise.all([loadSourceCounts(), loadFunnel()]);
  return NextResponse.json({ ok: true, data: { sources, funnel } });
}
