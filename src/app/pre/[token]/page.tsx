import PreForm from "@/components/PreForm";

/**
 * 폼 9 · 1단계. 링크에 박힌 토큰이 곧 신원이라 로그인이 없다.
 * 🔴 검색엔진에 올라가면 안 된다 — 남의 토큰이 색인될 수 있다.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "한결 1차 모임 · 참가 신청",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PreForm token={token} />;
}
