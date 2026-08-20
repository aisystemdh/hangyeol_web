/**
 * 퍼널 계측 — 이벤트를 **한 곳에서** 정의하고 두 수집처로 동시에 보낸다.
 *
 * 왜 필요한가: 홈이 대화형 무대(질문 3개 → 허브 → 신청)라, 어느 질문에서 사람이
 * 빠지는지가 곧 **어느 훅이 안 먹히는지**다. 이 값이 없으면 인스타 게시물이
 * 방문을 만들었는지조차 알 수 없고, 질문 후보 30개 중 무엇을 쓸지를 감으로 고르게 된다.
 *
 * 두 수집처를 쓰는 이유:
 *  - **Vercel Analytics** — 방문·유입경로(referrer)·페이지별 조회. 광고 차단기에
 *    거의 안 걸린다(자사 도메인에서 서빙). 단, 커스텀 이벤트는 Pro 요금제부터다.
 *  - **Meta 픽셀** — 커스텀 이벤트가 무료 요금제에서도 기록되고, 무엇보다
 *    **리타겟팅 모수**가 여기 쌓인다. 지금 안 심으면 나중에 소급이 안 된다.
 *    단, 광고 차단기에 막히는 비율이 있어 절대값이 아니라 **비율**로만 읽어야 한다.
 *
 * ⚠️ 개인정보는 절대 싣지 않는다. 이름·연락처·나이는 인자로 넘기지 말 것.
 *    성별만 신는 이유는 게이트 1의 판정 기준이 "여성 25명"이기 때문이다.
 */

/** 퍼널 이벤트 이름. 오타로 다른 이름이 섞이면 집계가 조용히 갈라지므로 유니온으로 고정한다. */
export type TrackEvent =
  | "q1_answer"
  | "q2_answer"
  | "q3_answer"
  | "hub_reached"
  | "apply_view"
  | "apply_submit";

type Props = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * 이벤트 한 건을 보낸다. 실패해도 절대 throw하지 않는다 —
 * 계측이 신청 흐름을 막는 일은 없어야 한다.
 */
export function track(event: TrackEvent, props?: Props) {
  if (typeof window === "undefined") return;

  // Vercel Analytics. 스크립트가 아직 안 붙었거나 차단됐으면 queue조차 없으므로 조용히 넘어간다.
  try {
    void import("@vercel/analytics").then(({ track: vercelTrack }) => {
      vercelTrack(event, props);
    });
  } catch {
    /* 수집 실패는 무시 */
  }

  // Meta 픽셀. 표준 이벤트가 아니므로 trackCustom을 쓴다.
  try {
    window.fbq?.("trackCustom", event, props ?? {});
  } catch {
    /* 수집 실패는 무시 */
  }
}
