import "server-only";
import { q } from "./db";
import { EVENT } from "./event";

/**
 * 자리 세기.
 *
 * 🔴 **자리는 「입금완료 상태인 신청의 수」다**(`CONTEXT.md` 「자리」). 신청은 자리가
 *    아니다 — 신청만으로 자리가 찬다면 안 낼 사람이 자리를 붙들고, 그 자리를 되돌리는
 *    장치(자동 만료)가 다시 필요해진다. 그 장치를 없애려고 이 규칙을 골랐다.
 *
 * 🔴 **잠그지 않는다.** 옛 구조는 `gender_slot`을 조건부 UPDATE로 잠갔는데, 자리가
 *    운영자의 손(입금 확인)으로만 차게 된 지금 **방어할 동시성이 존재하지 않는다.**
 *    사람 손은 동시에 두 번 눌리지 않는다.
 *
 * 🔴 **세는 자리는 여기 하나다.** 공개 모집 현황과 대기자 판정이 같은 함수를 쓴다 —
 *    두 곳에서 따로 세면 홈은 「자리 있음」인데 신청은 대기로 접수되는 일이 생긴다.
 */

export type SeatCount = { M: number; F: number };

/** 성별로 따로 센다. 전체로 세면 남자만 스무 명인 상태도 「만석」이 된다. */
export async function paidSeats(eventId: number = EVENT.id): Promise<SeatCount> {
  const rows = await q<{ gender: "M" | "F"; n: number }>(
    `select p.gender, count(*)::int as n
       from application a
       join applicant   p on p.id = a.applicant_id
      where a.event_id = $1 and a.status = '입금완료'
      group by p.gender`,
    [eventId],
  );
  const out: SeatCount = { M: 0, F: 0 };
  for (const r of rows) out[r.gender] = r.n;
  return out;
}

/** 남은 자리. 정원을 넘겨 확인해도 음수로 내려가지 않는다(운영자가 넘겨 받을 수 있다). */
export function remainingSeats(taken: SeatCount): SeatCount {
  const cap: number = EVENT.capacityPerGender;
  return {
    M: Math.max(0, cap - taken.M),
    F: Math.max(0, cap - taken.F),
  };
}

/**
 * 이 성별로 지금 신청하면 대기자인가.
 *
 * 🔴 **대기자는 저장하는 상태가 아니다**(`CONTEXT.md`). 그때그때 세어서 판단한다 —
 *    앞의 누군가가 취소해 자리가 나면 그 사람은 저절로 대기자가 아니게 된다.
 *    상태로 저장하면 취소가 날 때마다 대기자 명단을 손으로 되돌려야 한다.
 */
export function isWaitlisted(taken: SeatCount, gender: "M" | "F"): boolean {
  return taken[gender] >= EVENT.capacityPerGender;
}
