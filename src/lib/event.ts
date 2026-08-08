/**
 * 1차 모임의 확정 사실.
 * 원본은 옵시디언 볼트 `C:\second_brain\한결\_1차 오프라인 소개팅.md`.
 * 여기 값을 바꾸기 전에 반드시 볼트를 먼저 확인할 것 — 광고와 실제가 다른 것이
 * 이 시장의 대표적 불만 요인이다.
 */
export const EVENT = {
  /** 아직 일자까지는 미정이다. 확정되면 이 한 곳만 고치면 히어로 칩·정보표·하단 바·
   *  메타 description에 모두 반영된다. */
  date: "10월 중",
  time: "18:00–21:00",
  doorsOpen: "17:45 입장",
  place: "합정",
  placeNote: "신청자에게 개별 안내",
  capacity: 20,
  capacityPerGender: 10,
  priceLabel: "39,000원",
  priceNote: "남녀 동일",
  ageMin: 20,
  ageMax: 32,
} as const;

/**
 * 환불 규정. 확정 사실이므로 카피에 직접 문장을 쓰지 말고 여기서 가져온다.
 * 원본은 옵시디언 볼트 `_1차 오프라인 소개팅.md`.
 */
export const REFUND = [
  { when: "7일 전", what: "전액 돌려드립니다." },
  { when: "3일 전", what: "절반을 돌려드립니다." },
  {
    when: "그 이후",
    what: `환불이 어렵습니다. 자리가 ${EVENT.capacity}석뿐이라 한 명이 빠지면 성비가 무너지기 때문입니다.`,
  },
] as const;

/**
 * 카피에서 반복해 쓰는 문구. 숫자를 문장에 박아 넣지 않기 위한 헬퍼다.
 * 참가 조건·FAQ·폼 검증 메시지가 전부 이 한 줄을 쓴다 — 나이가 바뀌면 여기만 고친다.
 */
export const AGE_RANGE = `${EVENT.ageMin}살~${EVENT.ageMax}살`;
