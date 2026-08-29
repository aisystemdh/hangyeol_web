import "server-only";

/**
 * 사업자 신원과 계좌.
 *
 * 🔴 **값을 저장소에 적지 않는다.** 사업자등록번호·사업장 소재지·계좌번호는
 *    지식베이스 규칙 §1-3의 저장소 반출 금지 대상이다. 값은 환경변수에서만 온다.
 *    (문구와 코드는 저장소에, 값만 밖에 — 개발명세 §0-1의 방식 그대로다.)
 *
 * 🔴 **비어 있으면 화면이 경고한다.** 전자상거래법 §10①은 상호·대표자·등록번호·
 *    소재지를 「소비자가 쉽게 알 수 있도록」 표시하라고 정한다. 등록해놓고 화면에
 *    안 밝히면 표시 의무를 안 지킨 것이 된다. 조용히 빈칸으로 나가지 않게 한다.
 */
export type Biz = {
  name: string;
  ceo: string;
  regno: string;
  mailorder: string;
  address: string;
  phone: string;
  email: string;
  bank: string;
  account: string;
  holder: string;
  /** 화면에 빨간 경고로 띄울 「빠진 값」 목록. 비어 있으면 정상이다. */
  missing: string[];
};

export function biz(): Biz {
  const v = (k: string) => (process.env[k] ?? "").trim();
  const b = {
    name: v("HANGYEOL_BIZ_NAME") || "한결 (Hangyeol)",
    ceo: v("HANGYEOL_BIZ_CEO") || "이현우",
    regno: v("HANGYEOL_BIZ_REGNO"),
    mailorder: v("HANGYEOL_BIZ_MAILORDER"),
    address: v("HANGYEOL_BIZ_ADDRESS"),
    phone: v("HANGYEOL_BIZ_PHONE") || "010-5938-7074",
    email: v("HANGYEOL_BIZ_EMAIL") || "hangyeolgachi2026@gmail.com",
    bank: v("HANGYEOL_BANK_NAME") || "IBK기업은행",
    account: v("HANGYEOL_BANK_ACCOUNT"),
    holder: v("HANGYEOL_BANK_HOLDER") || "이현우",
  };
  const missing: string[] = [];
  if (!b.regno) missing.push("사업자등록번호");
  if (!b.mailorder) missing.push("통신판매업 신고번호");
  if (!b.address) missing.push("영업소 소재지");
  if (!b.account) missing.push("입금 계좌번호");
  return { ...b, missing };
}
