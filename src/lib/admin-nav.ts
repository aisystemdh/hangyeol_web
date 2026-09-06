/**
 * 운영자 화면 탭 목록의 유일한 정본.
 *
 * 🔴 #34는 「신청 목록」 하나뿐이지만, 뒤이어 #35(입금 확인은 목록 안 상세 서랍에
 * 붙는다)·#37(알림톡 발송)·#39(닉네임 배정)·#41(마케팅)이 각자 탭을 하나씩
 * 더한다(`docs/decisions/003…` §7). 그때 **이 배열에 한 줄만 추가**하면
 * `AdminNav`가 그대로 그려준다 — 탭마다 헤더 마크업을 새로 베끼지 않는다.
 */
export const ADMIN_NAV = [
  { href: "/admin", label: "신청 목록" },
  { href: "/admin/notify", label: "알림톡" }, // #37
  { href: "/admin/nicknames", label: "닉네임 배정" }, // #39
  { href: "/admin/marketing", label: "마케팅" }, // #41
] as const;
