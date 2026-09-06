/**
 * 알림톡 발송 화면(이슈 #37) — 순수 판정 로직만 모은 자리.
 *
 * `admin-list.ts`·`deadline.ts`·`seats.ts`와 같은 자리다 — DB·시계를 직접 읽지
 * 않고, 부르는 쪽(`admin-notify.ts`)이 값을 가져와 넘긴다. 「기한 임박」 판정 자체는
 * 이미 `admin-list.ts`의 `isDueSoon`이 있어 그대로 재사용한다(두 번째 정의를 만들면
 * 신청 목록의 강조와 이 화면의 "오늘 보낼 것"이 서로 다른 기준으로 갈릴 수 있다).
 * 여기 새로 필요한 것은 "행사가 임박했는가" 하나뿐이다.
 *
 * ⚠️ 이 파일만 따로 검사하는 테스트를 만들지 않는다(`CLAUDE.md` "테스트") — 실제로
 *    쓰이는지는 `GET /api/admin/notify`를 통해서 본다(`tests/notify.test.ts`).
 */

/**
 * 「행사 임박」 — 전날 안내(⑥ `전날안내`, `when_hint`="행사 전날")를 놓치지 않기
 * 위한 여유 구간이다.
 *
 * 🔴 **실제 발송 창(행사 전날 하루)보다 하루 앞선 「이틀 전」부터 화면 위쪽에 띄운다.**
 *    이슈 #37 원문("오늘이 행사 이틀 전인지(전날 안내 대상)")을 이렇게 해석한 근거:
 *    운영자는 하루 두 번(아침·저녁, `admin.ts`의 세션 TTL 12시간과 같은 주기) 화면을
 *    확인한다. 발송 창을 "행사 전날 당일"로만 잡으면 그 하루 안의 두 번을 모두
 *    놓쳤을 때 되돌릴 방법이 없다. 이틀 전부터 띄우면 놓칠 기회가 최소 세 번
 *    (이틀 전 저녁·전날 아침·전날 저녁)으로 늘어난다.
 * 🔴 **행사 당일까지도 계속 뜬다.** `admin-list.ts`의 `isDueSoon`이 "지난 기한도
 *    계속 강조한다"를 원칙으로 삼은 것과 같은 이유다 — 이틀 전과 전날을 전부
 *    놓친 극단적인 경우일수록 화면에서 조용히 사라지면 안 된다.
 */
export function isEventImminent(now: Date, eventDayStart: Date): boolean {
  const twoDaysBefore = eventDayStart.getTime() - 2 * 24 * 60 * 60 * 1000;
  const dayEnd = eventDayStart.getTime() + 24 * 60 * 60 * 1000; // 행사일 자정까지
  return now.getTime() >= twoDaysBefore && now.getTime() < dayEnd;
}
