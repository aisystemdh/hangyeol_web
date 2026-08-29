"use client";

import { usePathname } from "next/navigation";

/**
 * 브랜드 화면에만 붙는 것들(헤더·푸터·나뭇결·계측)을 감싼다.
 *
 * 🔴 `/admin` 은 **참가자 명단을 보는 업무 도구**지 브랜드 화면이 아니다.
 *    거기까지 헤더·푸터가 따라붙으면 ① 화면이 좁아지고 ② 나뭇결이 표 뒤에 깔리고
 *    ③ **운영자가 쓴 것까지 GA4 방문 수에 섞여** 모객 지표가 오염된다.
 *
 * 🔴 `/pre`·`/q`(참가자 폼)도 뺀다. 알림톡 링크를 타고 온 사람은 **그 폼 하나를
 *    끝내러** 온 것이다. 헤더 메뉴와 하단 고정 바(「1차 모임 신청」)가 같이 뜨면
 *    이미 신청 중인 사람에게 다시 신청하라고 권하는 꼴이고, 폼 밖으로 나갈 길만 는다.
 *    대신 폼 화면 안에 로고를 둬서 「진짜 한결이 보낸 링크」임은 알 수 있게 했다.
 *
 * ⚠️ 라우트 그룹으로 레이아웃을 아예 분리하는 편이 더 깔끔하지만, 그러려면
 *    지금 있는 페이지 다섯 개를 전부 옮겨야 한다. 경로 한 줄로 끝나는 일에
 *    그만한 이동을 하지 않는다.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  if (path?.startsWith("/pre/") || path?.startsWith("/q/")) return null;
  return <>{children}</>;
}
