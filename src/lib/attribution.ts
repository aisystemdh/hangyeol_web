/**
 * 유입 정보 캡처 — 신청 폼이 함께 실어 보내는 「어디서 들어왔는가」(이슈 #41).
 *
 * 왜 첫 진입에서만 캡처하는가: 이 사이트는 클라이언트 내비게이션(App Router)을 쓴다.
 * 광고 링크로 들어온 사람이 홈 게이트 → 질문 3개 → 허브를 거쳐 `/events/1`의 신청
 * 폼까지 오는 동안, 그 사이 내부 이동은 `document.referrer`도 주소창의 `?utm_...`도
 * 건드리지 않는다(둘 다 브라우저가 "이 문서를 최초로 열게 한 것"만 가리키고,
 * History API 내비게이션은 그 값을 갱신하지 않는다). 그래서 이 값들은 세션 안에서
 * 실제로 "첫 도착"을 가리키는 값이고, **처음 읽는 순간 한 번만 굳혀 두면** 그 뒤로
 * 몇 페이지를 거치든 원래 유입 경로를 그대로 들고 있을 수 있다.
 *
 * 반대로 신청 버튼을 누르는 순간 `location.search`·`location.pathname`을 다시 읽으면
 * 안 된다 — 그건 "들어온 페이지"가 아니라 "지금 있는 페이지"라 랜딩 경로의 의미를
 * 잃는다. sessionStorage에 굳혀 두는 이유가 그것이다(같은 세션·같은 탭에서만 유지되면
 * 충분하다 — 마케팅 탭이 보려는 것은 "이 방문이 어디서 시작됐는가"이지 사람 단위
 * 장기 추적이 아니다).
 *
 * 🔴 **그래서 "처음 읽는 순간"이 실제로 언제인지가 중요하다.** `ApplyForm`이 제출
 *    시점에야 처음 부르면 늦다 — 광고 링크의 UTM은 **랜딩 페이지의 주소**에만 있고,
 *    홈 게이트 → 질문 3개 → 허브를 거치는 동안 주소창은 이미 여러 번 바뀐 뒤다.
 *    그래서 실제 첫 호출은 `layout.tsx`에 상시 마운트된 `Analytics.tsx`가 이 문서가
 *    열리는 즉시 한다 — `ApplyForm`이 나중에 부르는 것은 이미 굳어 있는 값을 읽어
 *    실어 보내는 것뿐이다.
 *
 * ⚠️ 개인정보를 담지 않는다 — 여기 담기는 값은 URL·리퍼러 문자열뿐이다.
 */

import { UTM_KEYS } from "./source";

const KEY = "hg-attribution";

export type Attribution = {
  referrer: string | null;
  utm: Record<string, string> | null;
  landingPath: string | null;
};

const EMPTY: Attribution = { referrer: null, utm: null, landingPath: null };

function captureNow(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  return {
    referrer: document.referrer || null,
    utm: Object.keys(utm).length > 0 ? utm : null,
    landingPath: window.location.pathname,
  };
}

/**
 * 이 세션에서 처음 읽은 값을 그대로 돌려준다.
 *
 * ⚠️ 사파리 사생활 모드 등 sessionStorage가 막힌 브라우저에서는 굳히지 못하고 매번
 *    새로 캡처한다 — 그래도 신청 자체를 막을 이유는 아니므로 조용히 넘어간다.
 */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as Attribution;
    const now = captureNow();
    sessionStorage.setItem(KEY, JSON.stringify(now));
    return now;
  } catch {
    return captureNow();
  }
}
