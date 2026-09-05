import "server-only";
import { q, tx } from "./db";
import { EVENT } from "./event";
import { ageOn } from "./age";
import { isWaitlisted, paidSeats, remainingSeats, type SeatCount } from "./seats";
import {
  filterApplications,
  isDueSoon,
  type AdminApplicationRow,
  type AdminListFilter,
  type AdminStatus,
} from "./admin-list";
import { isMeScreenName, type MeScreenName } from "./me-screen";
import { EXPECTED_DEPOSIT_KRW, isAmountMismatch, netPaid } from "./payment";

/**
 * 운영자 신청 목록·상세가 읽는 데이터 한 벌 (이슈 #34).
 *
 * 서버 컴포넌트(첫 화면)와 API(30초 갱신)가 **같은 함수를 쓴다** — 옛
 * `admin-data.ts`의 `loadBoard()`와 같은 이유다. 두 곳에 따로 질의를 두면
 * 새로고침 전후로 화면이 달라 보인다.
 *
 * 🔴 **DB row를 통째로 펼쳐서 내려보내지 않는다**(`docs/decisions/003…` §6).
 *    아래 각 타입이 화면에 필요한 값만 골라 담는다 — 컬럼을 추가할 때 조용히
 *    새는 유일한 경로이기 때문이다.
 *
 * #35(입금확인)·#37(알림톡 발송)이 상세 서랍의 같은 데이터(돈 줄·발송 이력)를
 * 다시 그리게 되므로, 조회는 여기 한 곳에 모아 두고 그쪽에서 그대로 이어 쓴다.
 */

type Row = {
  id: string;
  seq: string; // bigserial → pg가 문자열로 준다
  status: AdminStatus;
  view_override: string | null;
  name: string;
  gender: "M" | "F";
  birth: string;
  phone: string;
  created_at: Date;
  due_at: Date | null;
  last_notified_at: Date | null;
  last_notified_label: string | null;
  last_notified_status: string | null;
  amount_mismatch: boolean;
};

/** 신청 목록. `filter`는 검색어·상태·성별 — 실제로 거르는 규칙은 `admin-list.ts`에 있다. */
export async function loadApplications(
  filter: AdminListFilter = {},
  eventId: number = EVENT.id,
  now: Date = new Date(),
): Promise<AdminApplicationRow[]> {
  const rows = await q<Row>(
    `select a.id, a.seq::text as seq, a.status, a.view_override,
            p.name, p.gender, p.birth::text as birth, p.phone,
            a.created_at, a.due_at,
            ln.created_at as last_notified_at,
            coalesce(nt.label, ln.template_id) as last_notified_label,
            ln.status as last_notified_status,
            exists (
              select 1 from money m
               where m.application_id = a.id and m.kind = '입금' and m.amount <> $2
            ) as amount_mismatch
       from application a
       join applicant p on p.id = a.applicant_id
       left join lateral (
         select n.created_at, n.template_id, n.status
           from notification n
          where n.application_id = a.id
          order by n.created_at desc
          limit 1
       ) ln on true
       left join notification_template nt on nt.id = ln.template_id
      where a.event_id = $1
      order by a.seq`,
    [eventId, EXPECTED_DEPOSIT_KRW],
  );

  // 🔴 대기자 판정과 공개 모집 현황이 같은 함수를 쓴다(`seats.ts`) — 목록 하나를
  //    보려고 성별마다 다시 세지 않고 이 화면 전체에서 한 번만 센다.
  const taken = await paidSeats(eventId);

  const items: AdminApplicationRow[] = rows.map((r) => {
    const dueAt = r.due_at ? new Date(r.due_at) : null;
    // 🔴 코드리뷰(2026-09-06)에서 잡힌 실제 버그 — `screenLocked`와 `viewOverride`가
    //    서로 다른 값(원본 컬럼 vs `isMeScreenName`으로 걸러진 값)에서 나오면,
    //    DB에 지금 화면 어휘에 없는 문자열이 들어 있는 순간(화면 이름이 바뀌었거나
    //    SQL로 직접 건드린 경우) 목록엔 "화면 고정됨"이 영원히 뜨는데 상세 서랍의
    //    "고정 해제" 버튼은 `viewOverride`가 null이라 나타나지 않는다 — 운영자가
    //    SQL 없이는 풀 수 없는 상태가 된다. 반드시 **같은 값**에서 파생시킨다.
    const viewOverride = isMeScreenName(r.view_override) ? r.view_override : null;
    return {
      id: r.id,
      seq: Number(r.seq),
      status: r.status,
      waitlisted: r.status === "신청함" && isWaitlisted(taken, r.gender),
      name: r.name,
      gender: r.gender,
      age: ageOn(r.birth, now),
      phone: r.phone,
      appliedAt: r.created_at.toISOString(),
      dueAt: dueAt ? dueAt.toISOString() : null,
      dueSoon: isDueSoon(r.status, dueAt, now),
      lastNotifiedAt: r.last_notified_at ? r.last_notified_at.toISOString() : null,
      lastNotifiedLabel: r.last_notified_label,
      lastNotifiedStatus: r.last_notified_status,
      screenLocked: viewOverride !== null,
      viewOverride,
      amountMismatch: r.amount_mismatch,
    };
  });

  return filterApplications(items, filter);
}

/**
 * 자리 현황 — 성별로 남은 자리(이슈 #35 AC). 목록 화면 상단과 GET 응답에 함께 실린다.
 * `seats.ts`를 그대로 이어 쓴다 — 세는 자리가 둘로 갈리면 공개 모집 현황과 어긋난다.
 */
export type SeatsSummary = { taken: SeatCount; remaining: SeatCount; capacityPerGender: number };

export async function loadSeats(eventId: number = EVENT.id): Promise<SeatsSummary> {
  const taken = await paidSeats(eventId);
  return { taken, remaining: remainingSeats(taken), capacityPerGender: EVENT.capacityPerGender };
}

export type AdminApplicationDetail = {
  application: {
    id: string;
    seq: number;
    status: AdminStatus;
    name: string;
    gender: "M" | "F";
    birth: string;
    age: number;
    phone: string;
    appliedAt: string;
    dueAt: string | null;
    registeredAt: string | null;
    marital: string | null;
    job: string | null;
    email: string | null;
    depositorName: string | null;
    paidAt: string | null;
    nick: number | null;
    viewOverride: MeScreenName | null;
    memo: string | null;
  };
  answers: {
    form: string;
    round: number | null;
    formVersion: string;
    a: unknown;
    createdAt: string;
  }[];
  money: {
    id: number;
    kind: "입금" | "환불";
    amount: number;
    occurredAt: string;
    depositorName: string | null;
    note: string | null;
    recordedBy: string;
    createdAt: string;
    /** 🔴 기대 금액(39,000원)과 다르면 true — 상세에도 표시만 남긴다(이슈 #35). */
    amountMismatch: boolean;
  }[];
  /** 그 사람이 실제로 낸 돈 — 「입금 합 − 환불 합」(`CONTEXT.md` "돈 줄", `payment.ts`). */
  netPaid: number;
  notifications: {
    id: string;
    templateId: string | null;
    templateLabel: string | null;
    status: string;
    error: string | null;
    sentBy: string | null;
    createdAt: string;
    deliveredAt: string | null;
  }[];
  eventLog: {
    id: number;
    kind: string;
    actor: string;
    meta: unknown;
    at: string;
  }[];
};

/** 상세 서랍 — 답변·돈 줄·발송 이력·조작 로그를 한 번에 모은다. 없으면 null. */
export async function loadApplicationDetail(
  id: string,
  now: Date = new Date(),
): Promise<AdminApplicationDetail | null> {
  const appRows = await q<{
    id: string;
    seq: string;
    status: AdminStatus;
    name: string;
    gender: "M" | "F";
    birth: string;
    phone: string;
    created_at: Date;
    due_at: Date | null;
    registered_at: Date | null;
    marital: string | null;
    job: string | null;
    email: string | null;
    depositor_name: string | null;
    paid_at: Date | null;
    nick: number | null;
    view_override: string | null;
    memo: string | null;
  }>(
    `select a.id, a.seq::text as seq, a.status, a.due_at, a.registered_at, a.marital,
            a.job, a.email, a.depositor_name, a.paid_at, a.nick, a.view_override, a.memo,
            a.created_at,
            p.name, p.gender, p.birth::text as birth, p.phone
       from application a
       join applicant p on p.id = a.applicant_id
      where a.id = $1`,
    [id],
  );
  const app = appRows[0];
  if (!app) return null;

  const [answers, money, notifications, eventLog] = await Promise.all([
    q<{ form: string; round: number | null; form_version: string; a: unknown; created_at: Date }>(
      `select form, round, form_version, a, created_at
         from answer where application_id = $1
        order by created_at`,
      [id],
    ),
    q<{
      id: string;
      kind: "입금" | "환불";
      amount: number;
      occurred_at: Date;
      depositor_name: string | null;
      note: string | null;
      recorded_by: string;
      created_at: Date;
    }>(
      `select id::text as id, kind, amount, occurred_at, depositor_name, note, recorded_by, created_at
         from money where application_id = $1
        order by occurred_at`,
      [id],
    ),
    q<{
      id: string;
      template_id: string | null;
      template_label: string | null;
      status: string;
      error: string | null;
      sent_by: string | null;
      created_at: Date;
      delivered_at: Date | null;
    }>(
      `select n.id, n.template_id, nt.label as template_label, n.status, n.error,
              n.sent_by, n.created_at, n.delivered_at
         from notification n
         left join notification_template nt on nt.id = n.template_id
        where n.application_id = $1
        order by n.created_at desc`,
      [id],
    ),
    q<{ id: string; kind: string; actor: string; meta: unknown; at: Date }>(
      `select id::text as id, kind, actor, meta, at
         from event_log where application_id = $1
        order by at desc`,
      [id],
    ),
  ]);

  return {
    application: {
      id: app.id,
      seq: Number(app.seq),
      status: app.status,
      name: app.name,
      gender: app.gender,
      birth: app.birth,
      age: ageOn(app.birth, now),
      phone: app.phone,
      appliedAt: app.created_at.toISOString(),
      dueAt: app.due_at ? app.due_at.toISOString() : null,
      registeredAt: app.registered_at ? app.registered_at.toISOString() : null,
      marital: app.marital,
      job: app.job,
      email: app.email,
      depositorName: app.depositor_name,
      paidAt: app.paid_at ? app.paid_at.toISOString() : null,
      nick: app.nick,
      viewOverride: isMeScreenName(app.view_override) ? app.view_override : null,
      memo: app.memo,
    },
    answers: answers.map((r) => ({
      form: r.form,
      round: r.round,
      formVersion: r.form_version,
      a: r.a,
      createdAt: r.created_at.toISOString(),
    })),
    money: money.map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      amount: r.amount,
      occurredAt: r.occurred_at.toISOString(),
      depositorName: r.depositor_name,
      note: r.note,
      recordedBy: r.recorded_by,
      createdAt: r.created_at.toISOString(),
      amountMismatch: r.kind === "입금" && isAmountMismatch(r.amount),
    })),
    netPaid: netPaid(money.map((r) => ({ kind: r.kind, amount: r.amount }))),
    notifications: notifications.map((r) => ({
      id: r.id,
      templateId: r.template_id,
      templateLabel: r.template_label,
      status: r.status,
      error: r.error,
      sentBy: r.sent_by,
      createdAt: r.created_at.toISOString(),
      deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null,
    })),
    eventLog: eventLog.map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      actor: r.actor,
      meta: r.meta,
      at: r.at.toISOString(),
    })),
  };
}

/**
 * 화면 고정 — 결정 13. `screen`이 `null`이면 고정을 풀어 자동 판정으로 되돌린다.
 *
 * 🔴 **누가 눌렀는지를 반드시 남긴다** — 운영자 셋이 비밀번호를 공유해 쿠키로는
 *    알 수 없다(`CONTEXT.md` 「운영자가 하는 일」). 화면(라우트)이 `actor`를
 *    검증해 넘기고, 여기서는 값을 그대로 기록만 한다.
 *
 * 신청이 없으면 `false` — 라우트가 404로 답할 신호다.
 */
export async function setViewOverride(
  id: string,
  screen: MeScreenName | null,
  actor: string,
): Promise<boolean> {
  return tx(async (client) => {
    const upd = await client.query(`update application set view_override = $2 where id = $1`, [
      id,
      screen,
    ]);
    if (upd.rowCount === 0) return false;

    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, $2, $3, $4)`,
      [id, screen ? "화면고정" : "화면고정해제", actor, JSON.stringify({ screen })],
    );
    return true;
  });
}

export type MoneyInput = {
  amount: number;
  occurredAt: Date;
  depositorName: string | null;
  note: string | null;
  actor: string;
};

export type RecordPaymentResult =
  | { ok: true; gender: "M" | "F"; amountMismatch: boolean }
  | { ok: false; reason: "not_found" | "cancelled" };

/**
 * 입금 확인 — **이 시스템에서 자리가 차는 유일한 순간**(이슈 #35).
 *
 * 🔴 「상태를 입금완료로 바꾸기」와 「돈 줄에 입금 한 줄 쌓기」가 **한 트랜잭션**으로
 *    함께 일어난다(`docs/decisions/003…` §7) — 따로 두면 운영자가 버튼을 한 번만
 *    누르고 둘 중 하나만 반영된 채 잊는다. 둘 중 하나라도 실패하면(예: `money.amount`
 *    체크 제약 위반) 트랜잭션 전체가 롤백돼 상태도 그대로 남는다.
 *
 * 🔴 **금액을 검증해 막지 않는다** — 39,000원이 아니어도 그대로 저장한다. 다르면
 *    호출한 쪽에 `amountMismatch`만 알려준다(목록·상세 표시용).
 *
 * 🔴 **재입금을 덧붙일 수 있다.** 이미 `입금완료`인 신청에 또 입금 확인을 눌러도
 *    막지 않는다 — `paid_at`(자리가 찬 시각)만 최초 확인 시각을 유지하고
 *    (`coalesce`), 돈 줄에는 매번 새 줄이 쌓인다(insert-only, 결정 15).
 *
 * `취소됨` 신청에는 입금을 확인할 수 없다 — 이미 빠지기로 한 사람의 자리를
 * 다시 채우면 「누가 자리에 있는가」가 상태만 봐서는 알 수 없게 된다.
 */
export async function recordPayment(
  id: string,
  input: MoneyInput,
  eventId: number = EVENT.id,
): Promise<RecordPaymentResult> {
  return tx(async (client) => {
    const found = await client.query<{ status: AdminStatus; gender: "M" | "F" }>(
      `select a.status, p.gender
         from application a
         join applicant p on p.id = a.applicant_id
        where a.id = $1`,
      [id],
    );
    const row = found.rows[0];
    if (!row) return { ok: false, reason: "not_found" };
    if (row.status === "취소됨") return { ok: false, reason: "cancelled" };

    // 🔴 최초 확인일 때만 `paid_at`을 채운다 — 재입금(이미 입금완료)에서 자리가
    //    찬 시각을 뒤로 미루면 안 된다.
    await client.query(
      `update application set status = '입금완료', paid_at = coalesce(paid_at, now())
        where id = $1`,
      [id],
    );

    const amountMismatch = isAmountMismatch(input.amount);
    await client.query(
      `insert into money (application_id, event_id, kind, amount, occurred_at, depositor_name, note, recorded_by)
       values ($1, $2, '입금', $3, $4, $5, $6, $7)`,
      [id, eventId, input.amount, input.occurredAt, input.depositorName, input.note, input.actor],
    );

    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, '입금확인', $2, $3)`,
      [
        id,
        input.actor,
        JSON.stringify({
          amount: input.amount,
          occurredAt: input.occurredAt.toISOString(),
          depositorName: input.depositorName,
          note: input.note,
          amountMismatch,
        }),
      ],
    );

    return { ok: true, gender: row.gender, amountMismatch };
  });
}

/**
 * 환불 — 돈 줄에 「−금액 환불」 한 줄을 쌓는다(결정 15).
 *
 * 🔴 상태를 바꾸지 않는다 — 취소와 환불은 각자 다른 버튼이다(이슈 #35 AC). 자리를
 *    비우려면(=취소로 바꾸려면) `cancelApplication`을 **따로** 부른다. 부분 환불처럼
 *    자리를 유지한 채 돈만 돌려주는 경우가 있어 둘을 묶으면 그 경우를 못 다룬다.
 */
export async function recordRefund(
  id: string,
  input: MoneyInput,
  eventId: number = EVENT.id,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  return tx(async (client) => {
    const found = await client.query(`select 1 from application where id = $1`, [id]);
    if (found.rowCount === 0) return { ok: false, reason: "not_found" };

    await client.query(
      `insert into money (application_id, event_id, kind, amount, occurred_at, depositor_name, note, recorded_by)
       values ($1, $2, '환불', $3, $4, $5, $6, $7)`,
      [id, eventId, input.amount, input.occurredAt, input.depositorName, input.note, input.actor],
    );
    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, '환불', $2, $3)`,
      [
        id,
        input.actor,
        JSON.stringify({
          amount: input.amount,
          occurredAt: input.occurredAt.toISOString(),
          depositorName: input.depositorName,
          note: input.note,
        }),
      ],
    );
    return { ok: true };
  });
}

/**
 * 신청을 취소됨으로 바꾼다(이슈 #35 AC). 🔴 `actor` 필수 — 화면(라우트)이 명단에서
 * 고른 이름을 검증해 넘긴다. 이미 취소된 신청도 다시 부를 수 있다(멱등) — 실수로
 * 두 번 눌러도 조작 로그만 한 줄 더 쌓일 뿐 상태는 그대로다.
 *
 * ⚠️ 돈 줄은 건드리지 않는다 — 이미 쌓인 입금 기록은 취소돼도 사실로 남는다.
 *    환불은 `recordRefund`로 따로 쌓는다.
 */
export async function cancelApplication(
  id: string,
  actor: string,
  note: string | null = null,
): Promise<boolean> {
  return tx(async (client) => {
    const found = await client.query<{ status: AdminStatus }>(
      `select status from application where id = $1`,
      [id],
    );
    const row = found.rows[0];
    if (!row) return false;

    await client.query(`update application set status = '취소됨' where id = $1`, [id]);
    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, '취소', $2, $3)`,
      [id, actor, JSON.stringify({ note, previousStatus: row.status })],
    );
    return true;
  });
}
