import "server-only";
import { q } from "./db";
import { EVENT } from "./event";
import { PRE_QUESTION_FORM } from "./form9-copy";

/**
 * 마케팅 탭이 읽는 데이터 (이슈 #41) — 어디서 들어와서 어디서 빠져나가는지.
 *
 * `admin-data.ts`와 같은 이유로 조회를 여기 한 곳에 모은다: 서버 컴포넌트(첫 화면)와
 * API(30초 갱신)가 **같은 함수**를 써야 새로고침 전후로 숫자가 달라 보이지 않는다.
 *
 * 🔴 여기서 내려주는 것은 **집계된 숫자뿐**이다(`docs/decisions/003…` §6 "DB row를
 *    통째로 펼쳐서 내려보내지 않는다"와 같은 원칙) — 신청 한 건 한 건의 유입 값을
 *    목록으로 늘어놓지 않는다. 유입 경로별로 몇 명인지가 궁금한 것이지, 누가 어디서
 *    왔는지를 이 화면에서 캐낼 이유는 없다.
 */

export type SourceCount = { source: string; count: number };

/**
 * 유입 경로별 신청 수. 값이 없는 신청(옛 데이터·직접 API 호출)은 「미상」으로 묶는다.
 *
 * 🔴 (이슈 #54) 기본은 **취소된 신청을 뺀다** — 등록·입금까지 갔다가 취소한 사람이
 *    채널 성과를 부풀리지 않도록. `includeCancelled: true`를 주면 취소 포함 전체를
 *    센다(운영자가 "원래 몇 명이 왔었나"를 보고 싶을 때). 화면의 토글이 이 값을 고른다.
 */
export async function loadSourceCounts(
  eventId: number = EVENT.id,
  includeCancelled: boolean = false,
): Promise<SourceCount[]> {
  const rows = await q<{ source: string; count: string }>(
    `select coalesce(source, '미상') as source, count(*)::text as count
       from application
      where event_id = $1
        and ($2 or status <> '취소됨')
      group by coalesce(source, '미상')
      order by count(*) desc, source asc`,
    [eventId, includeCancelled],
  );
  return rows.map((r) => ({ source: r.source, count: Number(r.count) }));
}

export type FunnelStageKey = "신청" | "정식등록" | "입금" | "사전질문";

export type FunnelStage = {
  key: FunnelStageKey;
  count: number;
  /** 1단계(신청) 대비 비율 — 소수점 첫째 자리까지. 1단계 자신은 항상 100이다. */
  rate: number;
};

/**
 * 퍼널 네 단계: 신청 → 정식등록 → 입금 → 사전질문.
 *
 * 🔴 각 단계의 판정 기준은 `CONTEXT.md`·`docs/decisions/003…`가 정한 것 그대로다 —
 *    새로 지어내지 않는다.
 *    - 신청     `application` 행이 있으면(이 event의 신청 전부)
 *    - 정식등록 `registered_at is not null`
 *    - 입금     `status = '입금완료'`(자리가 실제로 찬 순간)
 *    - 사전질문 `answer`에 그 신청의 사전질문 폼 행이 있는가
 *
 * 한 질의로 네 단계를 함께 센다 — 네 번 따로 세면 그사이 신청이 들어와 분모가
 * 흔들릴 수 있고(운영 중에는 실제로 초 단위로 들어온다), 같은 순간의 스냅샷이
 * 아니게 된다.
 *
 * 🔴 (이슈 #54) 「입금」 단계는 `status = '입금완료'`라 취소된 신청은 원래도 안 세지만,
 *    「신청」·「정식등록」은 조건 없이 모든 행을 세서 취소자까지 포함했었다 — 그래서
 *    입금까지 갔다가 취소한 사람이 "입금 단계에서 이탈"한 것처럼 보이는 버그가 있었다.
 *    `includeCancelled`가 기본값 `false`면 네 단계 모두에서 취소된 신청을 뺀다.
 *
 * ⚠️ **`includeCancelled`는 항상 `$2`다** — `loadSourceCounts`와 자리를 맞춰 둔다.
 *    두 함수가 같은 "취소 포함/제외" 조각(`and ($n or status <> '취소됨')`)을 따로
 *    들고 있는데, 자리표시자 번호가 서로 다르면 한쪽만 고칠 때 실수로 어긋나기 쉽다
 *    (코드리뷰 2026-09-06).
 */
export async function loadFunnel(
  eventId: number = EVENT.id,
  includeCancelled: boolean = false,
): Promise<FunnelStage[]> {
  const rows = await q<{ applied: string; registered: string; paid: string; answered: string }>(
    `select
        count(*)::text as applied,
        count(*) filter (where registered_at is not null)::text as registered,
        count(*) filter (where status = '입금완료')::text as paid,
        count(*) filter (
          where exists (
            select 1 from answer ans
             where ans.application_id = application.id and ans.form = $3
          )
        )::text as answered
       from application
      where event_id = $1
        and ($2 or status <> '취소됨')`,
    [eventId, includeCancelled, PRE_QUESTION_FORM],
  );
  const r = rows[0] ?? { applied: "0", registered: "0", paid: "0", answered: "0" };
  const applied = Number(r.applied);
  const registered = Number(r.registered);
  const paid = Number(r.paid);
  const answered = Number(r.answered);

  const rateOf = (n: number) => (applied === 0 ? 0 : Math.round((n / applied) * 1000) / 10);

  return [
    { key: "신청", count: applied, rate: applied === 0 ? 0 : 100 },
    { key: "정식등록", count: registered, rate: rateOf(registered) },
    { key: "입금", count: paid, rate: rateOf(paid) },
    { key: "사전질문", count: answered, rate: rateOf(answered) },
  ];
}
