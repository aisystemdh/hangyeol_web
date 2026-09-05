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

/** 유입 경로별 신청 수. 값이 없는 신청(옛 데이터·직접 API 호출)은 「미상」으로 묶는다. */
export async function loadSourceCounts(eventId: number = EVENT.id): Promise<SourceCount[]> {
  const rows = await q<{ source: string; count: string }>(
    `select coalesce(source, '미상') as source, count(*)::text as count
       from application
      where event_id = $1
      group by coalesce(source, '미상')
      order by count(*) desc, source asc`,
    [eventId],
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
 */
export async function loadFunnel(eventId: number = EVENT.id): Promise<FunnelStage[]> {
  const rows = await q<{ applied: string; registered: string; paid: string; answered: string }>(
    `select
        count(*)::text as applied,
        count(*) filter (where registered_at is not null)::text as registered,
        count(*) filter (where status = '입금완료')::text as paid,
        count(*) filter (
          where exists (
            select 1 from answer ans
             where ans.application_id = application.id and ans.form = $2
          )
        )::text as answered
       from application
      where event_id = $1`,
    [eventId, PRE_QUESTION_FORM],
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
