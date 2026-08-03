/**
 * 사이트 전역 상수. 행사별 사실은 `@/lib/event`에 있다 — 섞지 말 것.
 */

/** 헤더·푸터가 공유하는 주 내비게이션. 순서가 곧 정보 위계다. */
export const NAV = [
  { href: "/mission", label: "미션" },
  { href: "/why", label: "왜 가치관인가" },
  { href: "/principles", label: "원칙과 안전" },
] as const;

/** 1차 모임 랜딩(행사 전용 페이지). NAV에는 넣지 않고 CTA로만 노출한다. */
export const EVENT_HREF = "/events/1";
export const EVENT_CTA_LABEL = "1차 모임 신청";

export const SITE = {
  name: "한결",
  /** 반드시 전문 그대로. 축약형("결국에는 결이더라") 단독 사용 금지. */
  slogan: "결국에는 결이더라, 한결같이",
  operators: ["이현우", "여동현"],
} as const;
