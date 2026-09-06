import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { parseNotifyRequest, recipientsForSend } from "@/lib/admin-notify";
import { sendTemplate } from "@/lib/notification";
import { SITE } from "@/lib/site";

/**
 * POST /api/admin/notify/send — 여러 명에게 문구 하나를 실제로 보낸다 (이슈 #37).
 *
 * body: `{ applicationIds: string[], templateId: string, actor: string }`.
 *
 * 🔴 **누가 보냈는지가 기록에 남아야 한다** — 운영자 셋이 비밀번호를 공유해 쿠키로는
 *    알 수 없다(`CONTEXT.md`). `actor`가 `SITE.operators`(운영자 명단의 정본)에
 *    없으면 거절한다 — `.../screen`과 같은 규칙(`src/app/api/admin/applications/
 *    [id]/screen/route.ts`).
 *
 * 🔴 **미치환 변수 검사를 여기서 다시 하지 않는다.** `sendTemplate`(`notification.ts`)
 *    이 이미 "채우지 못한 변수가 남으면 보내지 않고 실패로 기록한다"를 지킨다 —
 *    화면이 미리보기로 미리 걸러도, 화면을 거치지 않고 이 API를 직접 두드리는
 *    경우까지 그 통로 하나가 막는다. 검사를 두 곳에 베끼면 한쪽만 규칙이 바뀌었을
 *    때 새는 문이 된다.
 * 🔴 **자동 재시도가 없다.** 이 라우트는 한 번 부르면 한 번만 보낸다 — 실패한 사람은
 *    운영자가 「보내다 실패한 것」 목록에서 다시 골라 이 라우트를 다시 불러야 한다.
 *
 * 발송은 **순서대로**(`for` + `await`) 부른다. 병렬로 부르면 뿌리오 토큰 캐시
 * (`alimtalk.ts`)가 비어 있는 순간 여러 요청이 동시에 토큰을 새로 받으러 가는
 * 낭비가 생기고, 결과 순서도 요청 순서와 어긋나 화면이 "누가 성공했는지"를
 * 잘못 짝지을 위험이 생긴다.
 *
 * ⚠️ **이중 클릭·다중 탭에 대한 서버 쪽 잠금은 없다.** 화면이 발송 중 버튼을
 *    비활성화하는 것이 유일한 방어다. `seats.ts`가 자리 세기를 잠그지 않은 것과
 *    같은 판단이다 — 운영자가 셋뿐이고(`CONTEXT.md`) 같은 사람에게 같은 문구를
 *    몇 초 안에 두 번 누를 확률보다, 잠금을 넣었을 때 생기는 새 실패 모드(잠금이
 *    풀리지 않아 아무도 못 보내는 상태)가 이 정도 규모에서는 더 크다고 봤다.
 *    실제로 중복 발송 사고가 나면 그때 `notification`에 짧은 시간창 내 중복
 *    (application_id, template_id) 방지 유니크 인덱스를 추가한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATOR_NAMES: readonly string[] = SITE.operators.map((o) => o.name);

type Body = { applicationIds?: unknown; templateId?: unknown; actor?: unknown };

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const actor = typeof body.actor === "string" ? body.actor.trim() : "";
  if (!OPERATOR_NAMES.includes(actor)) {
    return NextResponse.json(
      { ok: false, error: "invalid_actor", message: "보내는 사람을 목록에서 골라주세요." },
      { status: 400 },
    );
  }

  const parsed = parseNotifyRequest(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, ...parsed }, { status: 400 });
  }
  const { applicationIds, templateId } = parsed;

  const recipients = await recipientsForSend(applicationIds);
  const found = new Set(recipients.map((r) => r.id));
  const notFoundIds = applicationIds.filter((id) => !found.has(id));

  const results: { applicationId: string; ok: boolean; notificationId: string | null; reason?: string }[] =
    [];
  for (const r of recipients) {
    const outcome = await sendTemplate({
      applicationId: r.id,
      templateId,
      phone: r.phone,
      vars: r.vars,
      sentBy: actor,
    });
    results.push(
      outcome.ok
        ? { applicationId: r.id, ok: true, notificationId: outcome.notificationId }
        : { applicationId: r.id, ok: false, notificationId: outcome.notificationId, reason: outcome.reason },
    );
  }

  return NextResponse.json({ ok: true, data: { results, notFoundIds } });
}
