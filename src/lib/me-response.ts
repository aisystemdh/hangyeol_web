import type { BizAccount, BizIdentity } from "./biz";
import type { Question } from "./form9-copy";
import type { MeScreenName } from "./me-screen";
import type { VisibleReport } from "./report";

/**
 * `GET /api/me/[token]`이 내려주는 모양. **화면마다 필드가 다르다** — 이슈 #32의
 * 핵심 규칙("응답 필드는 화면별로 하나씩 골라 담는다", `docs/decisions/003…` §6)을
 * 타입으로 못박는다. DB row를 통째로 실어 보내는 지름길은 이 타입 자체가 막는다 —
 * `MeData`에 없는 필드는 애초에 응답 객체에 넣을 수 없다.
 *
 * 🔴 이 파일은 **타입만** 있다(런타임 값이 없다). 그래서 `form9-copy.ts`가
 *    `import "server-only"`로 막아 둔 문항이라도, **타입만** 가져오는 `import type`은
 *    번들에 아무것도 남기지 않는다 — 클라이언트 컴포넌트가 이 파일의 타입을 가져다
 *    `fetch("/api/me/…")` 응답 모양을 설명하는 데 써도 안전하다.
 */

type Common = { name: string };

/** 계좌·문항처럼 민감한 값이 없는 화면들. 안내 문구만 있으면 되는 자리다. */
export type MeSimpleScreen = Exclude<MeScreenName, "register" | "payment" | "questions" | "ended">;
export type MeSimpleData = Common & { screen: MeSimpleScreen };

/** 리포트 링크. `report.ts`의 `VisibleReport`를 그대로 재수출한 것이다 — 선언을
 *  둘로 나누지 않는다(위 import에 이유가 적혀 있다). */
export type MeReport = VisibleReport;

/**
 * 행사 종료 화면(이슈 #40). 🔴 **`report`가 null이면 "아직 없다"가 아니라 "아직 못
 *    보여준다"다** — 리포트 행이 아예 없거나, 있어도 `published_at`이 비었거나
 *    아직 오지 않은 미래 시각인 경우를 모두 이 하나로 뭉갠다. 손님 입장에서는
 *    셋의 차이가 없다("아직 준비 중입니다"로 충분하다) — 구분이 필요한 쪽은
 *    운영자 화면(#34)이지 여기가 아니다.
 */
export type MeEndedData = Common & {
  screen: "ended";
  report: MeReport | null;
};

/** 등록 화면. 🔴 계좌·문항은 여기 없다 — 사업자 **신원**과 금액·환불 규정만. */
export type MeRegisterData = Common & {
  screen: "register";
  bizIdentity: BizIdentity;
  price: string;
  ageRange: string;
  refund: readonly { when: string; what: string }[];
  refundLaw: readonly string[];
};

/** 입금 안내 화면. 🔴 문항은 여기 없다 — 계좌·예금주·기한·금액만. */
export type MePaymentData = Common & {
  screen: "payment";
  bizAccount: BizAccount;
  price: string;
  dueAtLabel: string | null;
};

/** 사전질문 화면. 🔴 계좌는 여기 없다 — 문항 전문·짝 정보(페어드 인덱스)·문항 버전만. */
export type MeQuestionsData = Common & {
  screen: "questions";
  formVersion: string;
  questions: Question[];
  pairedIndexes: number[];
};

export type MeData = MeSimpleData | MeRegisterData | MePaymentData | MeQuestionsData | MeEndedData;

export type MeApiSuccess = { ok: true; data: MeData };
export type MeApiError = { ok: false; error: string; message: string };
export type MeApiResponse = MeApiSuccess | MeApiError;

/**
 * `POST /api/me/[token]`(정식등록, 이슈 #33)이 돌려주는 모양.
 *
 * 🔴 여기에도 계좌가 없다 — 등록 응답은 "등록됐다"는 사실만 알린다. 계좌는 그다음
 *    화면이 `GET`을 다시 부를 때 `resolveMeScreen`이 새로 고른 "payment" 화면에서만
 *    내려온다. 등록 라우트 코드에는 `bizAccount()`를 부를 이유 자체가 없다.
 */
export type MeRegisterApiSuccess = { ok: true; data: { registeredAt: string } };
export type MeRegisterApiResponse = MeRegisterApiSuccess | MeApiError;
