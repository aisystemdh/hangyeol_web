"use client";

import { usePathname } from "next/navigation";
import { MY_PAGE_PATH } from "@/lib/site";

/**
 * 브랜드 화면에만 붙는 것들(헤더·푸터·나뭇결·계측)을 감싼다.
 *
 * 🔴 `/admin` 은 **참가자 명단을 보는 업무 도구**지 브랜드 화면이 아니다.
 *    거기까지 헤더·푸터가 따라붙으면 ① 화면이 좁아지고 ② 나뭇결이 표 뒤에 깔리고
 *    ③ **운영자가 쓴 것까지 GA4 방문 수에 섞여** 모객 지표가 오염된다.
 *
 * 🔴 **`/me/`도 같은 이유로 막는다**(#32). 안 막으면 마이페이지에 헤더와
 *    「1차 모임 신청」 고정 바가 붙어, **이미 신청한 사람에게 다시 신청하라고 권하는
 *    화면**이 된다. 단계별 주소 `/pre`·`/q`가 같은 이유로 여기 있었고, 손님 링크가
 *    `/me/<토큰>` 하나로 합쳐지면서(ADR 003 결정 6) 그 자리를 물려받았다.
 *    대신 폼 화면 안(`MeShell.tsx`)에 브랜드명을 텍스트로 둬서 「진짜 한결이 보낸
 *    링크」임은 알 수 있게 한다.
 *
 * ⚠️ 라우트 그룹으로 레이아웃을 아예 분리하는 편이 더 깔끔하지만, 그러려면
 *    지금 있는 페이지 다섯 개를 전부 옮겨야 한다. 경로 한 줄로 끝나는 일에
 *    그만한 이동을 하지 않는다.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  if (path?.startsWith(`${MY_PAGE_PATH}/`)) return null;
  return <>{children}</>;
}
