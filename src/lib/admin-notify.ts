import "server-only";
import { q } from "./db";
import { EVENT, eventDayStart } from "./event";
import { myPageUrl } from "./site";
import { formatDeadline } from "./deadline";
import { isDueSoon, type AdminStatus } from "./admin-list";
import { isEventImminent } from "./notify-list";
import { fillTemplate, TEMPLATE, type TemplateVars } from "./notification";

/**
 * 알림톡 발송 화면(이슈 #37)이 읽고 쓰는 데이터.
 *
 * 🔴 **자동화는 신청 직후 둘뿐**(`notification.ts`)이라 나머지 일곱 문구는 운영자가
 *    잊으면 아무 일도 안 일어난다(`docs/decisions/003…` §8). 이 파일의
 *    `loadNotifyTodo` · `loadNotifyFailed`가 그 안전장치 — 화면 위쪽의
 *    「오늘 보낼 것」·「보내다 실패한 것」을 만든다.
 *
 * 🔴 **DB row를 통째로 펼쳐서 내려보내지 않는다**(§6과 같은 원칙) — 화면에 필요한
 *    값만 골라 담는다.
 */

/* ── 「오늘 보낼 것」 ─────────────────────────────────────────── */

export type NotifyTodoReason = "기한임박" | "확정후미발송" | "행사임박";

export type NotifyTodoRow = {
  id: string;
  seq: number;
  status: AdminStatus;
  name: string;
  gender: "M" | "F";
  phone: string;
  dueAt: string | null;
  reasons: NotifyTodoReason[];
};

type TodoRawRow = {
  id: string;
  seq: string;
  status: AdminStatus;
  due_at: Date | null;
  name: string;
  gender: "M" | "F";
  phone: string;
  confirmed_sent: boolean;
  predday_sent: boolean;
};

/**
 * 「오늘 보낼 것」 — 세 가지 이유 중 하나라도 걸리는 사람만 담는다.
 *
 * - **기한임박** — 신청 목록의 강조와 같은 기준(`admin-list.ts`의 `isDueSoon`,
 *   12시간 미만). 문구 ③(`기한임박`)을 아직 안 보냈어도, 보냈어도 계속 뜬다 —
 *   손님이 실제로 입금할 때까지는 매번 다시 챙길 일이라서다.
 * - **확정후미발송** — 상태가 `입금완료`인데 문구 ④(`자리확정`)가 **성공/문자대체로
 *   나간 적이 없다.** 자동화가 없는 문구라 운영자가 입금 확인 버튼을 누른 뒤
 *   깜빡하면 손님은 자리가 확정된 줄도, 사전질문을 내야 하는지도 모른다.
 * - **행사임박** — `notify-list.ts`의 `isEventImminent` 참고. 문구 ⑥(`전날안내`)이
 *   아직 안 나간 확정자에게만 뜬다.
 */
export async function loadNotifyTodo(
  now: Date = new Date(),
  eventId: number = EVENT.id,
): Promise<NotifyTodoRow[]> {
  const rows = await q<TodoRawRow>(
    `select a.id, a.seq::text as seq, a.status, a.due_at,
            p.name, p.gender, p.phone,
            exists (
              select 1 from notification n
               where n.application_id = a.id and n.template_id = $2
                 and n.status in ('성공', '문자대체')
            ) as confirmed_sent,
            exists (
              select 1 from notification n
               where n.application_id = a.id and n.template_id = $3
                 and n.status in ('성공', '문자대체')
            ) as predday_sent
       from application a
       join applicant p on p.id = a.applicant_id
      where a.event_id = $1 and a.status <> '취소됨'
      order by a.seq`,
    [eventId, TEMPLATE.자리확정, TEMPLATE.전날안내],
  );

  const imminent = isEventImminent(now, eventDayStart());

  const items: NotifyTodoRow[] = rows.map((r) => {
    const dueAt = r.due_at ? new Date(r.due_at) : null;
    const reasons: NotifyTodoReason[] = [];
    if (isDueSoon(r.status, dueAt, now)) reasons.push("기한임박");
    if (r.status === "입금완료" && !r.confirmed_sent) reasons.push("확정후미발송");
    if (r.status === "입금완료" && imminent && !r.predday_sent) reasons.push("행사임박");
    return {
      id: r.id,
      seq: Number(r.seq),
      status: r.status,
      name: r.name,
      gender: r.gender,
      phone: r.phone,
      dueAt: dueAt ? dueAt.toISOString() : null,
      reasons,
    };
  });

  return items.filter((r) => r.reasons.length > 0);
}

/* ── 「보내다 실패한 것」 ─────────────────────────────────────── */

export type NotifyFailedRow = {
  id: string; // notification.id
  applicationId: string;
  name: string;
  phone: string;
  templateId: string | null;
  templateLabel: string | null;
  error: string | null;
  sentBy: string | null;
  createdAt: string;
};

/**
 * 실패 기록 전부(성공/재시도 여부와 무관하게 그 시도 자체). 🔴 **자동 재시도가
 * 없으므로**(`docs/decisions/003…` §3 "지켜야 할 것 넷") 여기 뜬 것을 운영자가
 * 다시 골라 눌러야만 다음 시도가 생긴다 — 그래서 최근 것을 지우지 않고 전부 보여준다.
 */
export async function loadNotifyFailed(
  eventId: number = EVENT.id,
): Promise<NotifyFailedRow[]> {
  const rows = await q<{
    id: string;
    application_id: string;
    name: string;
    phone: string;
    template_id: string | null;
    template_label: string | null;
    error: string | null;
    sent_by: string | null;
    created_at: Date;
  }>(
    `select n.id, n.application_id, p.name, p.phone,
            n.template_id, nt.label as template_label, n.error, n.sent_by, n.created_at
       from notification n
       join application a on a.id = n.application_id
       join applicant p on p.id = a.applicant_id
       left join notification_template nt on nt.id = n.template_id
      where a.event_id = $1 and n.status = '실패'
      order by n.created_at desc`,
    [eventId],
  );
  return rows.map((r) => ({
    id: r.id,
    applicationId: r.application_id,
    name: r.name,
    phone: r.phone,
    templateId: r.template_id,
    templateLabel: r.template_label,
    error: r.error,
    sentBy: r.sent_by,
    createdAt: r.created_at.toISOString(),
  }));
}

/* ── 문구 목록 ─────────────────────────────────────────────────── */

export type NotifyTemplateOption = {
  id: string;
  label: string;
  whenHint: string | null;
  autoSend: boolean;
};

/** 발송 화면에서 고를 수 있는 문구 — `active`인 것만(꺼둔 문구는 목록에서도 뺀다). */
export async function loadNotifyTemplates(): Promise<NotifyTemplateOption[]> {
  const rows = await q<{
    id: string;
    label: string;
    when_hint: string | null;
    auto_send: boolean;
  }>(
    `select id, label, when_hint, auto_send
       from notification_template
      where active
      order by sort_order`,
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    whenHint: r.when_hint,
    autoSend: r.auto_send,
  }));
}

/* ── 받는 사람 정보 + 변수 채우기 (미리보기·발송이 함께 쓴다) ─────── */

export type NotifyRecipient = {
  id: string; // application.id
  name: string;
  phone: string;
};

type RecipientRawRow = {
  id: string;
  token: string;
  due_at: Date | null;
  name: string;
  phone: string;
  refund_amount: number | null;
  refund_at: Date | null;
};

/**
 * 골라 놓은 신청 id들의 발송용 정보. 🔴 **id로만 받고 이름·전화를 클라이언트가
 * 다시 보내게 하지 않는다** — 화면이 보낸 값을 믿지 않는다는 원칙(`CLAUDE.md`
 * "화면 검증을 믿지 않는다")이 여기서도 같다. 존재하지 않거나 다른 회차의
 * id는 조용히 빠진다 — 부르는 쪽이 "몇 명이 빠졌는지"를 알아야 하면
 * `recipients.length`를 요청한 id 개수와 비교한다.
 */
async function loadRecipients(
  ids: readonly string[],
  eventId: number = EVENT.id,
): Promise<RecipientRawRow[]> {
  if (ids.length === 0) return [];
  return q<RecipientRawRow>(
    `select a.id, a.token, a.due_at, p.name, p.phone,
            (select amount from money m
              where m.application_id = a.id and m.kind = '환불'
              order by m.occurred_at desc limit 1) as refund_amount,
            (select occurred_at from money m
              where m.application_id = a.id and m.kind = '환불'
              order by m.occurred_at desc limit 1) as refund_at
       from application a
       join applicant p on p.id = a.applicant_id
      where a.event_id = $2 and a.id = any($1::uuid[])`,
    [ids, eventId],
  );
}

/** 처리일(환불 완료일)을 사람이 읽는 짧은 날짜로. 시각 없이 날짜만 — 환불 안내는
 *  "언제 처리됐는지"만 알면 되고, 입금 기한처럼 분 단위 다툼이 생기지 않는다. */
function formatProcessedDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")} ${get("day")}일`;
}

/** 신청 하나의 변수 아홉 개. 값이 없으면 `undefined` — `fillTemplate`이 "못 채웠다"로 센다. */
function buildVars(row: RecipientRawRow): TemplateVars {
  const dueAt = row.due_at ? new Date(row.due_at) : null;
  return {
    이름: row.name,
    입금액: EVENT.priceLabel,
    입금기한: dueAt ? formatDeadline(dueAt) : null,
    링크: myPageUrl(row.token),
    행사일: EVENT.date,
    시간: EVENT.time,
    장소: EVENT.place,
    환불액: row.refund_amount != null ? `${Number(row.refund_amount).toLocaleString()}원` : null,
    처리일: row.refund_at ? formatProcessedDate(new Date(row.refund_at)) : null,
  };
}

export type NotifyPreviewItem = {
  id: string; // application.id
  name: string;
  phone: string;
  text: string;
  missing: string[];
};

export type NotifyPreviewResult = {
  items: NotifyPreviewItem[];
  /** 요청한 id 중 이 회차의 신청으로 찾지 못한 것 — 새로고침 사이 취소·삭제된 경우. */
  notFoundIds: string[];
};

/**
 * 미리보기 — 실제로 보낼 때와 **같은 변수 채우기**(`notification.ts`의 `fillTemplate`)를
 * 그대로 써서 "미리 본 문구"와 "실제로 나간 문구"가 다를 일이 없게 한다.
 */
export async function previewNotify(opts: {
  applicationIds: readonly string[];
  templateBody: string;
}): Promise<NotifyPreviewResult> {
  const recipients = await loadRecipients(opts.applicationIds);
  const found = new Set(recipients.map((r) => r.id));
  const items = recipients.map((r) => {
    const { text, missing } = fillTemplate(opts.templateBody, buildVars(r));
    return { id: r.id, name: r.name, phone: r.phone, text, missing };
  });
  const notFoundIds = opts.applicationIds.filter((id) => !found.has(id));
  return { items, notFoundIds };
}

export type NotifyRecipientForSend = NotifyRecipient & { vars: TemplateVars };

/** 발송 라우트가 쓴다 — id별로 `sendTemplate`에 넘길 전화번호·변수를 만든다. */
export async function recipientsForSend(
  applicationIds: readonly string[],
): Promise<NotifyRecipientForSend[]> {
  const rows = await loadRecipients(applicationIds);
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, vars: buildVars(r) }));
}

/* ── 요청 본문 검증 (미리보기·발송 라우트가 함께 쓴다) ───────────── */

export type NotifyRequestError = { error: "no_recipients" | "no_template"; message: string };

/**
 * `POST /api/admin/notify/preview`와 `.../send`가 받는 몸통이 같은 두 필드
 * (`applicationIds`·`templateId`)를 요구한다 — 검증도 한 곳에서 한다.
 * 🔴 여기 없는 `actor` 검증은 `send/route.ts`에만 있다 — 미리보기는 누가 볼지 남길
 *    필요가 없어서다(실제로 손님에게 나가는 것은 발송뿐이다).
 */
export function parseNotifyRequest(
  body: { applicationIds?: unknown; templateId?: unknown },
): { applicationIds: string[]; templateId: string } | NotifyRequestError {
  const applicationIds =
    Array.isArray(body.applicationIds) && body.applicationIds.every((v) => typeof v === "string")
      ? (body.applicationIds as string[])
      : null;
  if (!applicationIds || applicationIds.length === 0) {
    return { error: "no_recipients", message: "받을 사람을 한 명 이상 골라주세요." };
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!templateId) {
    return { error: "no_template", message: "문구를 골라주세요." };
  }

  return { applicationIds, templateId };
}
