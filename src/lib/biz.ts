import "server-only";

/**
 * 사업자 신원과 계좌 — **둘로 쪼개져 있다** (이슈 #32).
 *
 * 🔴 **왜 쪼갰는가.** 마이페이지의 정보 노출 규칙(`docs/decisions/003…` §6)은
 *    "등록 화면은 사업자 신원까지만 보여주고, 계좌는 정식등록을 마친 사람에게만
 *    보여준다"고 정한다. 예전에는 `biz()` 하나가 신원과 계좌를 한 덩어리로 돌려줘서,
 *    등록 화면이 그 값을 그대로 쓰면 **정식등록 전에도 계좌가 함께 딸려 나갔다.**
 *    함수를 둘로 나누면 등록 화면 코드는 애초에 계좌 값을 손에 쥘 수조차 없다 —
 *    "안 보여주기로 했다"를 코드 리뷰로 지키는 대신 **호출부에 존재하지 않게** 만든다.
 *
 * 🔴 **값을 저장소에 적지 않는다.** 사업자등록번호·사업장 소재지·계좌번호는
 *    지식베이스 규칙 §1-3의 저장소 반출 금지 대상이다. 값은 환경변수에서만 온다.
 *
 * 🔴 **비어 있으면 화면이 경고한다.** 전자상거래법 §10①은 상호·대표자·등록번호·
 *    소재지를 「소비자가 쉽게 알 수 있도록」 표시하라고 정한다. 등록해놓고 화면에
 *    안 밝히면 표시 의무를 안 지킨 것이 된다. 조용히 빈칸으로 나가지 않게 한다.
 *    `missing`은 신원·계좌 각자 자기 몫만 담는다 — 등록 화면은 계좌가 없어도
 *    (아직 안 보여주는 값이니까) 경고를 띄우면 안 된다.
 */

function v(k: string): string {
  return (process.env[k] ?? "").trim();
}

export type BizIdentity = {
  name: string;
  ceo: string;
  regno: string;
  mailorder: string;
  address: string;
  phone: string;
  email: string;
  /** 화면에 빨간 경고로 띄울 「빠진 값」 목록. 비어 있으면 정상이다. */
  missing: string[];
};

/** 등록 화면·약관처럼 **계좌 없이** 사업자 신원만 필요한 곳에서 부른다. */
export function bizIdentity(): BizIdentity {
  const id = {
    name: v("HANGYEOL_BIZ_NAME") || "한결 (Hangyeol)",
    ceo: v("HANGYEOL_BIZ_CEO") || "이현우",
    regno: v("HANGYEOL_BIZ_REGNO"),
    mailorder: v("HANGYEOL_BIZ_MAILORDER"),
    address: v("HANGYEOL_BIZ_ADDRESS"),
    phone: v("HANGYEOL_BIZ_PHONE") || "010-5938-7074",
    email: v("HANGYEOL_BIZ_EMAIL") || "hangyeolgachi2026@gmail.com",
  };
  const missing: string[] = [];
  if (!id.regno) missing.push("사업자등록번호");
  // ⚠️ 통신판매업 신고번호는 **일부러 빼 두었다**(2026-09-05 소유자 확인 — 아직 신고 대상이 아니다).
  //    🔴 면제는 조건부다. 전자상거래법 시행령 §6은 직전년도 통신판매 거래 횟수가 일정 수
  //    미만이면 신고 의무를 면제하는데, 1차 행사는 20건이라 걸리지 않을 뿐이다.
  //    **회차가 쌓이면 넘는다** — 2차 행사를 열 때 다시 확인하고, 신고하면 이 줄을 되살린다.
  //    (값 자체는 `HANGYEOL_BIZ_MAILORDER`로 이미 읽고 있으므로 넣기만 하면 화면에 나온다.)
  if (!id.address) missing.push("영업소 소재지");
  return { ...id, missing };
}

export type BizAccount = {
  bank: string;
  account: string;
  holder: string;
  /** 화면에 빨간 경고로 띄울 「빠진 값」 목록. 비어 있으면 정상이다. */
  missing: string[];
};

/** 🔴 **정식등록을 마친 사람에게만** 부른다(마이페이지 「입금」 화면 · #32).
 *  정식등록 전 화면 코드에서는 이 함수를 아예 부르지 않는다. */
export function bizAccount(): BizAccount {
  const acc = {
    bank: v("HANGYEOL_BANK_NAME") || "IBK기업은행",
    account: v("HANGYEOL_BANK_ACCOUNT"),
    holder: v("HANGYEOL_BANK_HOLDER") || "이현우",
  };
  const missing: string[] = [];
  if (!acc.account) missing.push("입금 계좌번호");
  return { ...acc, missing };
}
