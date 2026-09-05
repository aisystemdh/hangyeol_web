import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { loadApplicationDetail } from "@/lib/admin-data";

/**
 * GET /api/admin/applications/[id] — 상세 서랍 (운영자 전용).
 *
 * 답변·돈 줄·발송 이력·조작 로그를 한 번에 내려준다(이슈 #34 AC). #35(입금확인)·
 * #37(알림톡 발송)이 같은 사람의 같은 자료를 다시 그리게 되므로, 조회는
 * `admin-data.ts` 한 곳에 모아 두고 여기서는 인증만 다시 확인한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const detail = await loadApplicationDetail(id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: detail });
}
