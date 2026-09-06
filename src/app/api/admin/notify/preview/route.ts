import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { q } from "@/lib/db";
import { parseNotifyRequest, previewNotify } from "@/lib/admin-notify";

/**
 * POST /api/admin/notify/preview — 보내기 전에 그 사람에게 갈 문구 그대로 미리보기
 * (이슈 #37 AC).
 *
 * body: `{ applicationIds: string[], templateId: string }`.
 *
 * 🔴 **실제 발송(`send`)과 같은 변수 채우기**(`admin-notify.ts`의 `previewNotify` →
 *    `notification.ts`의 `fillTemplate`)를 그대로 쓴다 — 미리 본 문구와 실제로
 *    나간 문구가 한 글자라도 다르면 이 화면의 존재 이유가 없어진다.
 * 🔴 **채우지 못한 변수가 있으면 각 항목의 `missing`에 담긴다.** 잠그는 동작(버튼
 *    비활성화) 자체는 화면(`NotifyBoard.tsx`)이 하지만, 그 판단 재료는 여기서 만든다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { applicationIds?: unknown; templateId?: unknown };

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const parsed = parseNotifyRequest(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, ...parsed }, { status: 400 });
  }
  const { applicationIds, templateId } = parsed;

  // 🔴 꺼진(비활성) 문구는 미리보기도 못 만든다 — 목록에서 이미 뺀 문구를
  //    주소를 직접 두드려 부르는 경우까지 막는다(`CLAUDE.md` "화면 검증을 믿지 않는다").
  const tpl = await q<{ body: string }>(
    `select body from notification_template where id = $1 and active`,
    [templateId],
  );
  if (tpl.length === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_template", message: "문구가 없거나 꺼져 있습니다." },
      { status: 400 },
    );
  }

  const result = await previewNotify({ applicationIds, templateBody: tpl[0].body });
  return NextResponse.json({ ok: true, data: result });
}
