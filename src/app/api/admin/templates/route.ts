import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { createTemplate, loadTemplates, parseTemplateInput, type RawTemplateBody } from "@/lib/admin-templates";

/**
 * `/api/admin/templates` — 알림톡 문구 관리 (이슈 #38).
 *
 * 🔴 `src/proxy.ts`가 `/api/admin/:path*`를 이미 막지만, 다른 운영자 API와 같은
 *    이중 방어로 여기서도 `isAdmin()`을 다시 확인한다(`CLAUDE.md` "화면에서 한 번,
 *    API 하나하나에서 또 한 번").
 *
 * GET  — 활성·비활성 전부. `admin-templates.ts`가 서버 컴포넌트(첫 화면)와 이 라우트
 *        (수정 뒤 새로고침) 양쪽에 같은 조회를 준다.
 * POST — 새 문구 추가. body: `{ id, label, body, whenHint?, templateCode?, approval,
 *        buttonName?, smsBody?, actor }`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const items = await loadTemplates();
  return NextResponse.json({ ok: true, data: { items } });
}

type Body = RawTemplateBody & { actor?: unknown };

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

  const parsed = parseTemplateInput(body, { requireId: true });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error, message: parsed.message }, { status: 400 });
  }

  const result = await createTemplate(parsed.id, parsed.input, actor);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status: 400 });
  }

  const items = await loadTemplates();
  return NextResponse.json({ ok: true, data: { items } });
}
