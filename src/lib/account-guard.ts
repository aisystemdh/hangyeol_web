/**
 * 문구 본문에 계좌번호처럼 보이는 숫자가 있는지 (이슈 #38).
 *
 * 🔴 계좌는 링크로만 보낸다(`docs/alimtalk-templates.md` "계좌번호를 문구에 넣지
 *    않는다") — 문구에 박으면 계좌가 바뀔 때 아홉 곳(그리고 앞으로 늘어날 곳)을
 *    전부 찾아 고쳐야 하고, 「계좌 값은 환경변수에서만」이라는 규칙이 DB로 샌다.
 *
 * DB나 화면 상태를 보지 않는 순수 함수다. `age.ts`·`deadline.ts`와 같은 자리라
 * 이 파일만 따로 검사하는 테스트를 만들지 않는다(`CLAUDE.md` "테스트").
 *
 * ⚠️ **경고이지 차단이 아니다.** 국내 계좌번호는 보통 10~14자리라 그 아래로 잡으면
 *    "39,000원" 같은 정상 문구까지 걸리고, 그 위로 잡으면 놓치는 계좌가 생긴다.
 *    10자리를 기준으로 삼되, 확신할 수 없으므로 저장 자체를 막지는 않는다 —
 *    운영자가 보고 판단한다(`biz.ts`의 "비어 있으면 경고만 하고 막지 않는다"와 같은 결).
 *
 * 🔴 **지금은 `TemplateBoard.tsx`(클라이언트)만 부른다.** 저장 API(`admin-templates.ts`)는
 *    이 검사를 하지 않는다 — 이 경고는 신원이 확인된 운영자 자신의 실수를 잡는
 *    용도(`CLAUDE.md`가 말하는 "화면 검증을 믿지 않는다"의 대상인 손님 입력이 아니다)라,
 *    화면을 거치지 않고 API를 직접 두드리는 것 자체가 이미 운영자 본인의 행동이다.
 *    그래도 서버에서도 같은 경고를 보고 싶어지면, 이 함수를 그대로 가져다 쓴다 —
 *    규칙을 새로 짓지 않는다.
 */
const DIGIT_RUN = /[0-9][0-9\- ]*[0-9]/g;
const MIN_ACCOUNT_DIGITS = 10;

export function looksLikeAccountNumber(text: string): boolean {
  const runs = text.match(DIGIT_RUN) ?? [];
  return runs.some((run) => (run.match(/\d/g) ?? []).length >= MIN_ACCOUNT_DIGITS);
}
