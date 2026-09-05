import type { Metadata } from "next";
import MeClient from "@/components/MeClient";

/**
 * 🔴 **검색에 잡히지 않는다.** 남의 토큰이 색인될 수 있고, 사전질문 문항 자체가
 *    영업비밀이다(`CLAUDE.md` "라우팅"). robots.txt에 `Disallow`를 적지 않는 것과
 *    같은 이유로(`/admin/login/page.tsx` 참고 — 막으려는 주소를 오히려 광고하게
 *    된다) 여기서만 `noindex`를 건다.
 */
export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * `/me/[token]` — 손님이 받는 주소 하나(`docs/decisions/003…` 결정 6).
 *
 * 🔴 **서버 컴포넌트지만 DB를 읽지 않는다.** 여기서 신청 상태나 문항을 읽어
 *    `MeClient`에 props로 넘기면, 그 값이 이 페이지의 RSC 페이로드를 타고 **문항
 *    없는 사람에게도** 브라우저까지 내려간다(`import "server-only"`는 번들 포함만
 *    막지 이 경로는 못 막는다). 그래서 여기서는 주소에 있던 토큰 문자열만 그대로
 *    전달하고, 화면 판정과 데이터 조회는 `MeClient`가 `GET /api/me/[token]`으로
 *    따로 불러 가져온다(이슈 #32).
 */
export default async function MePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MeClient token={token} />;
}
