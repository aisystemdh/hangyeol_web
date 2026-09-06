/**
 * 운영자 화면이 공유하는 표시 포맷.
 *
 * 🔴 서버 전용이 아니다 — `ApplicationDrawer.tsx`·`NotifyBoard.tsx` 같은 클라이언트
 *    컴포넌트가 그대로 import한다. `admin-data.ts`·`admin-notify.ts`처럼 DB를
 *    읽는 파일과 섞지 않는다(그런 파일은 `"server-only"`가 붙어 있어 클라이언트
 *    번들에 섞이면 안 된다).
 *
 * 코드리뷰(2026-09-06, 이슈 #37) — `formatDT`가 `ApplicationDrawer.tsx`와
 * `NotifyBoard.tsx`에 토씨 하나 안 틀리고 복붙돼 있었다. 날짜 표기를 나중에
 * 한 곳이라도 다르게 고치면(예: 시간대 표기 추가) 두 화면이 다른 형식을 보여준다.
 */
export function formatDT(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
