import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { loadTemplates, parseTemplateInput, updateTemplate, type RawTemplateBody } from "@/lib/admin-templates";

/**
 * `/api/admin/templates/[id]` — 문구 수정 · 활성/비활성 전환 (이슈 #38).
 *
 * 🔴 `id`는 주소에서만 온다 — 본문의 `id`는 무시한다. 수정 화면에서 코드를 바꿀 수
 *    없게 하려는 것이다(`admin-templates.ts` 상단 주석).
 *
 * body: `{ label, body, whenHint?, templateCode?, approval, buttonName?, smsBody?,
 *        active, actor }`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = RawTemplateBody & { actor?: unknown };

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

  const parsed = parseTemplateInput(body, { requireId: false });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error, message: parsed.message }, { status: 400 });
  }

  const result = await updateTemplate(id, parsed.input, actor);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status });
  }

  const items = await loadTemplates();
  return NextResponse.json({ ok: true, data: { items } });
}
