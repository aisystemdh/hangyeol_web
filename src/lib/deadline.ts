import { EVENT } from "./event";

/**
 * 기한 계산.
 *
 * 🔴 **절대 날짜를 코드 곳곳에 박지 않는다.** 전부 `EVENT.dateISO` 하나에서 나온다.
 *    행사일이 옮겨지면 그 한 줄만 고치면 된다 — 여러 곳에 적으면 반드시 하나가 빠진다.
 *
 * 🔴 **기한이 둘이고, 먼저 오는 쪽이 이긴다.**
 *      개인 기한 — 폼9를 제출해 자리를 잡은 시각 + 72시간
 *      전체 마감 — 행사 7일 전 23:59:59 (KST)
 *
 * ⚠️ 지식베이스 안에서 개인 기한의 기준이 두 가지로 적혀 있다 —
 *    개발명세 §1-1은 「제출 시각」, §3-1은 「알림톡 발송 시각」이다.
 *    **제출 시각으로 간다.** ① §1-1이 더 최신(2026-08-29 · 일괄 발송+선착순 확정)이고
 *    ② 「자리를 잡으면 3일 안에 입금」이라는 게이트 문서의 설명과 맞아떨어진다.
 *    일괄 발송이라 발송 시각 기준으로 잡으면 늦게 답한 사람의 시간이 통째로 사라진다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOLD_HOURS = 72;

/** 한국 시간으로 그날 23:59:59.999 를 UTC 기준 Date로 만든다. */
function endOfDayKST(iso: string): Date {
  return new Date(Date.parse(`${iso}T23:59:59.999+09:00`));
}

/** 전체 마감 — 행사 7일 전 끝. 이 시각이 지나면 아무도 자리를 못 잡는다. */
export function overallDeadline(): Date {
  const event = new Date(`${EVENT.dateISO}T00:00:00+09:00`);
  const d = new Date(event.getTime() - 7 * 24 * 60 * 60 * 1000);
  const iso = new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
  return endOfDayKST(iso);
}

/** 자리를 잡은 시각으로부터의 개인 기한과 전체 마감 중 **먼저 오는 쪽**. */
export function dueAtFrom(heldAt: Date): Date {
  const personal = new Date(heldAt.getTime() + HOLD_HOURS * 60 * 60 * 1000);
  const overall = overallDeadline();
  return personal < overall ? personal : overall;
}

/** 지금 신청을 받을 수 있는가. */
export function isClosed(now: Date = new Date()): boolean {
  return now > overallDeadline();
}
