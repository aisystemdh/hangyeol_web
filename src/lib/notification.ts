import "server-only";
import { q } from "./db";
import { alimtalk, type AlimtalkButton, type AlimtalkResult } from "./alimtalk";

/**
 * 알림톡 문구를 채워 보내고, 보낸 것을 기록한다.
 *
 * 🔴 **이 파일은 절대 던지지 않는다.** 신청 직후 입금 안내는 신청 저장이 끝난 **뒤에**
 *    불리는데, 여기서 예외가 새어 나가면 저장된 신청이 실패로 보인다.
 *    **알림이 안 가는 것보다 신청이 사라지는 것이 훨씬 나쁘다**(`notify.ts`와 같은 원칙).
 *
 * 🔴 **채우지 못한 변수가 하나라도 남으면 보내지 않는다.** 뿌리오는 `#{}`를 대신
 *    채워주지 않는다 — 막지 않으면 `#{계좌}`가 그대로 박힌 문구가 손님에게 간다.
 *    거부한 것도 **기록에 남긴다**(상태 「실패」 + 사유). 안 남기면 운영자 화면의
 *    「보내다 실패한 것」에 아무것도 안 뜨고, 아무도 안 보낸 줄을 모른다.
 */

/**
 * 문구를 코드에서 부를 때 쓰는 이름. 🔴 **`auto_send` 깃발로 고르지 않는다** —
 * 자동으로 나가는 것이 둘(입금 안내·대기 등록)이라 깃발만으로는 어느 쪽인지 못 가린다.
 * 깃발은 「문구 관리」 화면이 자동/수동을 **표시**하는 데 쓴다.
 */
export const TEMPLATE = {
  입금안내: "입금안내",
  대기등록: "대기등록",
  기한임박: "기한임박",
  자리확정: "자리확정",
  사전질문독촉: "사전질문독촉",
  전날안내: "전날안내",
  후기안내: "후기안내",
  환불완료: "환불완료",
  리포트안내: "리포트안내",
} as const;

/**
 * 문구에 쓸 수 있는 변수 아홉 개(`docs/alimtalk-templates.md`).
 * 🔴 목록에 없는 변수를 문구에 쓰면 채울 값이 없어 발송이 거부된다 —
 *    그게 의도다. 새 변수가 필요하면 여기와 문서를 함께 고친다.
 */
export type TemplateVars = Partial<
  Record<
    "이름" | "입금액" | "입금기한" | "링크" | "행사일" | "시간" | "장소" | "환불액" | "처리일",
    string | null
  >
>;

const VAR_PATTERN = /#\{([^}]*)\}/g;

/**
 * `#{이름}` 자리를 값으로 바꾼다.
 *
 * 돌려주는 `missing`은 **끝까지 못 채운 변수 이름**이다. 비어 있지 않으면 부르는 쪽이
 * 발송을 거부한다. 🔴 값이 빈 문자열인 것도 「못 채웠다」로 센다 — `#{입금기한}`이
 * 빈칸으로 나간 문구는 변수가 그대로 박힌 것만큼이나 손님을 헷갈리게 한다.
 */
export function fillTemplate(
  body: string,
  vars: TemplateVars,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = body.replace(VAR_PATTERN, (whole, name: string) => {
    const v = (vars as Record<string, string | null | undefined>)[name];
    if (v == null || v === "") {
      if (!missing.includes(name)) missing.push(name);
      return whole; // 못 채운 자리는 그대로 남긴다 — 기록에 무엇이 비었는지 보인다.
    }
    return v;
  });
  return { text, missing };
}

type TemplateRow = {
  id: string;
  body: string;
  template_code: string | null;
  buttons: AlimtalkButton[] | null;
  sms_body: string | null;
};

export type SendOutcome =
  | { ok: true; notificationId: string }
  | { ok: false; reason: string; notificationId: string | null };

/**
 * 문구 하나를 한 사람에게 보낸다.
 *
 * @param sentBy `'system'`(자동) 또는 운영자 이름. 🔴 운영자 셋이 비밀번호를 공유하므로
 *               쿠키로는 누가 눌렀는지 알 수 없다 — 화면에서 고른 이름이 여기로 온다.
 */
export async function sendTemplate(opts: {
  applicationId: string;
  templateId: string;
  phone: string;
  vars: TemplateVars;
  sentBy: string;
}): Promise<SendOutcome> {
  try {
    const rows = await q<TemplateRow>(
      `select id, body, template_code, buttons, sms_body
         from notification_template
        where id = $1 and active`,
      [opts.templateId],
    );
    const tpl = rows[0];
    if (!tpl) {
      // 문구 행이 없으면 참조할 id도 없다. `template_id`를 비운 채로 기록만 남긴다.
      return await recordFailure(opts, null, `문구 「${opts.templateId}」가 없거나 꺼져 있습니다.`);
    }

    const { text, missing } = fillTemplate(tpl.body, opts.vars);
    if (missing.length > 0) {
      return await recordFailure(
        opts,
        tpl.id,
        `채우지 못한 변수: ${missing.join(", ")}`,
        text,
      );
    }

    // 🔴 버튼 주소에는 `#{}`를 못 쓴다. 그 사람의 주소를 통째로 만들어 넣는다.
    // 🔴 **버튼은 있는데 넣을 주소가 없으면 보내지 않는다.** 문구는 운영자가 고칠 수
    //    있고(#38) 부르는 자리도 여럿이 되므로, 본문에 `#{링크}`가 없으면서 부르는 쪽도
    //    링크를 안 넘기는 짝이 실제로 생긴다. 그러면 「못 채운 변수」로는 안 걸리고
    //    주소 없는 버튼이 나가 **대행사가 요청 전체를 거절한다** — 한 사람이 아니라
    //    그 발송이 통째로 죽는다. 변수 검사와 **나란히, 기록을 세우기 전에** 막는다.
    const link = opts.vars.링크 || null;
    if ((tpl.buttons ?? []).length > 0 && !link) {
      return await recordFailure(opts, tpl.id, "버튼이 있는데 넣을 링크가 없습니다.", text);
    }

    // 🔴 발송 **전에** 기록을 세운다. 이 행의 id가 곧 뿌리오에 보내는 `refkey`이고,
    //    도달 웹훅이 그 값을 그대로 돌려주므로 짝이 맞는다.
    const made = await q<{ id: string }>(
      `insert into notification (application_id, template_id, body, status, sent_by)
       values ($1, $2, $3, '대기', $4)
       returning id`,
      [opts.applicationId, tpl.id, text, opts.sentBy],
    );
    const id = made[0].id;

    const buttons = (tpl.buttons ?? []).map((b) => ({
      ...b,
      url_mobile: b.url_mobile || link!,
      url_pc: b.url_pc || link!,
    }));

    // 🔴 **기록을 세운 뒤의 실패는 반드시 그 기록에 적는다.** `alimtalk()`은 통로를
    //    안 고르면(`ALIMTALK_PROVIDER` 누락) **부르는 그 자리에서 던진다.** 그대로
    //    바깥 catch로 새면 방금 만든 행이 「대기」인 채 영원히 남고, 운영자 화면의
    //    「보내다 실패한 것」에는 안 뜬다 — 아무도 안 보낸 줄을 모르게 되는 경로다.
    let result: AlimtalkResult;
    try {
      result = await alimtalk().send({
        phone: opts.phone,
        text,
        templateCode: tpl.template_code,
        refkey: id,
        buttons: buttons.length > 0 ? buttons : null,
        smsBody: tpl.sms_body,
      });
    } catch (err) {
      result = { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }

    if (result.status === "failed") {
      await q(
        `update notification
            set status = '실패', error = $2, accept_code = $3, accepted_at = now()
          where id = $1`,
        [id, result.error, result.acceptCode ?? null],
      );
      return { ok: false, reason: result.error, notificationId: id };
    }

    await q(
      `update notification
          set status = $2, accept_code = $3, accepted_at = now(), message_key = $4
        where id = $1`,
      [
        id,
        result.status === "sms_fallback" ? "문자대체" : "성공",
        result.acceptCode ?? null,
        result.providerMessageId,
      ],
    );
    return { ok: true, notificationId: id };
  } catch (err) {
    // 🔴 여기서 던지면 신청이 실패한 것처럼 보인다. 삼키고 로그만 남긴다.
    console.error("[notification] 발송 실패", opts.templateId, err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      notificationId: null,
    };
  }
}

/** 보내지 못한 것도 기록한다 — 안 남기면 「보내다 실패한 것」 목록이 비어 보인다. */
async function recordFailure(
  opts: { applicationId: string; sentBy: string },
  templateId: string | null,
  reason: string,
  body = "",
): Promise<SendOutcome> {
  try {
    const rows = await q<{ id: string }>(
      `insert into notification (application_id, template_id, body, status, error, sent_by)
       values ($1, $2, $3, '실패', $4, $5)
       returning id`,
      [opts.applicationId, templateId, body, reason, opts.sentBy],
    );
    return { ok: false, reason, notificationId: rows[0].id };
  } catch (err) {
    console.error("[notification] 실패 기록조차 못 남겼다", err);
    return { ok: false, reason, notificationId: null };
  }
}
