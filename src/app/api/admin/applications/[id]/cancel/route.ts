import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { cancelApplication } from "@/lib/admin-data";

/**
 * POST /api/admin/applications/[id]/cancel — 신청을 취소됨으로 바꾼다 (이슈 #35 AC).
 *
 * body: `{ actor, note? }`. 🔴 `actor` 필수 — 명단(`SITE.operators`)에 없는 이름은
 * 거절한다. 돈 줄은 건드리지 않는다 — 이미 쌓인 입금은 취소돼도 사실로 남고,
 * 돌려줄 돈은 `.../refund`로 따로 쌓는다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { actor?: unknown; note?: unknown };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const actor = normalizeActor(body.actor);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "invalid_actor", message: "조작하는 사람을 목록에서 골라주세요." },
      { status: 400 },
    );
  }

  const noteRaw = typeof body.note === "string" ? body.note.trim() : "";
  const ok = await cancelApplication(id, actor, noteRaw || null);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
