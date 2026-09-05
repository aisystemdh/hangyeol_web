/**
 * 신청 한 건의 유입 경로(`application.source`)를 정하는 규칙 (이슈 #41).
 *
 * `deadline.ts`·`seats.ts`·`admin-list.ts`와 같은 자리다 — DB·요청 객체를 직접 읽지
 * 않는 순수 함수라 `/api/apply` 라우트가 실제로 부르는 값 그대로 눈으로 따라갈 수 있다.
 *
 * 우선순위가 이런 이유:
 * 1. **`utm_source`가 있으면 그게 곧 answer다.** 광고주가 스스로 붙인 값이라
 *    "어느 캠페인인가"까지 사람이 읽고 답한 것이다 — 추측할 필요가 없다.
 * 2. UTM이 없으면 **리퍼러의 호스트**로 대신한다("instagram.com"처럼) — 인스타그램
 *    게시물·프로필 링크처럼 UTM을 안 붙이고 그냥 누른 경우가 실제로 가장 흔하다.
 * 3. 리퍼러가 **우리 사이트 자신**이면(같은 호스트) "direct"로 본다 — 다른 내부
 *    페이지를 거쳐 온 것은 "채널"이 아니라 우리 사이트 안에서의 이동이다.
 * 4. 아무것도 없으면(주소를 직접 치거나 즐겨찾기) "direct".
 *
 * 🔴 여기 담기는 값은 URL·리퍼러 문자열뿐이다 — 개인정보를 절대 섞지 않는다.
 *
 * ⚠️ **이 파일만 따로 검사하는 테스트를 만들지 않는다** — `admin-list.ts`·`deadline.ts`와
 *    같은 이유(`CLAUDE.md` "테스트"). `tests/marketing.test.ts`가 `POST /api/apply`를
 *    통해 실제로 저장되는 `application.source` 값으로 이 규칙을 검사한다.
 */
export function deriveSource(input: {
  utm: Record<string, string> | null;
  referrer: string | null;
  siteUrl: string;
}): string {
  const utmSource = input.utm?.utm_source?.trim();
  if (utmSource) return utmSource.toLowerCase();

  if (!input.referrer) return "direct";

  try {
    const referrerHost = new URL(input.referrer).hostname.replace(/^www\./, "");
    const siteHost = new URL(input.siteUrl).hostname.replace(/^www\./, "");
    if (!referrerHost || referrerHost === siteHost) return "direct";
    return referrerHost;
  } catch {
    // 리퍼러가 URL 모양이 아니면(브라우저 확장이 이상한 값을 넣는 경우 등) 판단할 수 없다.
    return "direct";
  }
}
