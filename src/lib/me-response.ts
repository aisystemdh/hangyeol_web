import type { BizAccount, BizIdentity } from "./biz";
import type { Question } from "./form9-copy";
import type { MeScreenName } from "./me-screen";

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
export type MeSimpleScreen = Exclude<MeScreenName, "register" | "payment" | "questions">;
export type MeSimpleData = Common & { screen: MeSimpleScreen };

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

export type MeData = MeSimpleData | MeRegisterData | MePaymentData | MeQuestionsData;

export type MeApiSuccess = { ok: true; data: MeData };
export type MeApiError = { ok: false; error: string; message: string };
export type MeApiResponse = MeApiSuccess | MeApiError;
