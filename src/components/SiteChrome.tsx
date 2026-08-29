"use client";

import { usePathname } from "next/navigation";

/**
 * 브랜드 화면에만 붙는 것들(헤더·푸터·나뭇결·계측)을 감싼다.
 *
 * 🔴 `/admin` 은 **참가자 명단을 보는 업무 도구**지 브랜드 화면이 아니다.
 *    거기까지 헤더·푸터가 따라붙으면 ① 화면이 좁아지고 ② 나뭇결이 표 뒤에 깔리고
 *    ③ **운영자가 쓴 것까지 GA4 방문 수에 섞여** 모객 지표가 오염된다.
 *
 * ⚠️ 라우트 그룹으로 레이아웃을 아예 분리하는 편이 더 깔끔하지만, 그러려면
 *    지금 있는 페이지 다섯 개를 전부 옮겨야 한다. 경로 한 줄로 끝나는 일에
 *    그만한 이동을 하지 않는다.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  return <>{children}</>;
}
