import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { assignNicknames, loadApplications } from "@/lib/admin-data";

/**
 * `/api/admin/nicknames` — 닉네임 일괄 배정 (이슈 #39).
 *
 * 🔴 `src/proxy.ts`가 `/api/admin/:path*`를 이미 막지만, 다른 운영자 API와 같은
 *    이중 방어로 여기서도 `isAdmin()`을 다시 확인한다(`CLAUDE.md` "화면에서 한 번,
 *    API 하나하나에서 또 한 번").
 *
 * GET  — 지금 입금완료 상태인 신청 목록(닉네임 포함). 화면의 첫 데이터·30초 갱신
 *        둘 다 `admin-data.ts`의 `loadApplications` 하나를 그대로 쓴다 — 신청
 *        목록 화면과 같은 이유로, 조회를 두 곳에 두면 새로고침 전후로 달라 보인다.
 * POST — 그 시점의 입금완료 신청 전체에 번호를 붙인다(`assignNicknames`).
 *        body: `{ actor }`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const items = await loadApplications({ status: "입금완료" });
  return NextResponse.json({ ok: true, data: { items } });
}

type Body = { actor?: unknown };

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const actor = normalizeActor(body.actor);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "invalid_actor", message: "조작하는 사람을 목록에서 골라주세요." },
      { status: 400 },
    );
  }

  const result = await assignNicknames(actor);
  const items = await loadApplications({ status: "입금완료" });
  return NextResponse.json({
    ok: true,
    data: { assignedCount: result.assignedCount, overCapacityCount: result.overCapacityCount, items },
  });
}
