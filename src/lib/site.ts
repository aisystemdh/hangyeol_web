/**
 * 사이트 전역 상수. 행사별 사실은 `@/lib/event`에 있다 — 섞지 말 것.
 */

/**
 * 배포 주소. `layout.tsx`의 metadataBase, `robots.ts`, `sitemap.ts`가 전부 여기서 가져간다.
 *
 * 배포 환경(및 로컬 `.env.local`)에 `NEXT_PUBLIC_SITE_URL=https://실제도메인` 을 넣는다.
 * ⚠️ 예전에는 `https://hangyeol.example`라는 실재하지 않는 도메인이 프로덕션 빌드에
 *    그대로 박혀 OG·canonical이 전부 가짜 주소를 가리켰다. 하드코딩으로 되돌리지 말 것.
 *
 * ⚠️ `??`가 아니라 `||`다. `??`는 null·undefined만 걸러서, 환경변수를 만들어 놓고
 *    값을 비워두면(`NEXT_PUBLIC_SITE_URL=`) 빈 문자열이 그대로 통과해
 *    `new URL("")`이 던지고 **전 페이지가 500으로 죽는다.** 실제로 그렇게 죽었다.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** 헤더·푸터가 공유하는 주 내비게이션. 순서가 곧 정보 위계다. */
export const NAV = [
  // 경로는 /mission 그대로 두고 라벨만 "목표"다 — 이미 공유된 링크를 깨지 않기 위해서다
  { href: "/mission", label: "목표" },
  { href: "/why", label: "왜 가치관인가" },
  { href: "/principles", label: "원칙" },
] as const;

/** 1차 모임 랜딩(행사 전용 페이지). NAV에는 넣지 않고 CTA로만 노출한다. */
export const EVENT_HREF = "/events/1";
export const EVENT_CTA_LABEL = "1차 모임 신청";

export const SITE = {
  name: "한결",
  /** 반드시 전문 그대로. 축약형("결국에는 결이더라") 단독 사용 금지. */
  slogan: "결국에는 결이더라, 한결같이",
  /**
   * 운영자와 직함. 사람마다 역할이 달라 이름만 나열하던 배열을 객체로 바꿨다.
   * `Founders`(직함까지) · `Footer`(이름만) · `layout.tsx`의 JSON-LD(이름까지)가 함께 쓴다.
   *
   * ⭐ **여기가 운영자 명단의 유일한 정본이다.** 사람이 늘거나 줄면 이 배열만 고치면
   *    운영자 섹션·푸터·구조화 데이터가 함께 따라온다. 이름을 다른 파일에 쓰지 말 것.
   * ⚠️ 다만 **"운영자 O명"처럼 수를 세는 문장은 자동으로 안 따라온다.** 사람이 바뀌면
   *    Faq의 안전 문답을 함께 확인할 것 — 현장 상주 인원은 명단 수와 다를 수 있다.
   */
  operators: [
    { name: "이현우", role: "기획 · 진행 (CEO)" },
    { name: "여동현", role: "기획 · 기술 (CTO)" },
    { name: "박지연", role: "기획 · 마케팅" },
  ],
} as const;

/**
 * 문의 채널. Stanford 웹 신뢰도 가이드라인 10개 중 **"연락이 쉬워야 한다"** 에 해당한다 —
 * 참가비 39,000원을 받는 사이트에 연락할 곳이 없으면 신뢰가 서지 않는다.
 *
 * ⚠️ 빈 문자열이면 `Footer`가 그 항목을 **아예 그리지 않는다.** 깨진 링크를 내보내는 것이
 *    링크가 없는 것보다 나쁘기 때문이다. 실제 계정이 생기면 여기만 채우면 된다.
 *    (`ApplyForm`의 전송 실패 안내도 인스타그램 메시지를 언급하므로 함께 채울 것)
 */
export const CONTACT = {
  /** 계정명은 `hangyeol_kr` — 2026-08 소유자가 계정을 이전·확정했다.
      (옛 계정 `hangyeol_offical`은 더 이상 쓰지 않는다 — 1:1 문의가 빈 화면으로 갔었다.) */
  instagram: "https://instagram.com/hangyeol_kr",
  /** 카카오톡 채널 또는 오픈채팅. 예: "http://pf.kakao.com/_xxxxxx" */
  kakao: "",
  /** `mailto:`는 Footer가 붙인다 */
  email: "hangyeolgachi2026@gmail.com",
  /**
   * `tel:`은 Footer가 붙인다(하이픈은 링크에서 자동으로 걸러진다).
   *
   * ⚠️ 웹에 노출된 번호는 크롤러가 수집해 스팸·보이스피싱 목록에 오른다.
   *    개인 번호를 빼고 싶으면 여기를 `""`로 두면 푸터에서 그 줄이 사라진다.
   */
  phone: "010-5938-7074",
} as const;
