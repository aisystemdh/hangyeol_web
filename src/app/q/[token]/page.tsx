import QuestionForm from "@/components/QuestionForm";

/**
 * 폼 9 · 2단계(사전 10문항). 입금이 확인된 사람에게만 열린다.
 * 🔴 검색엔진에 올라가면 안 된다 — 문항이 영업비밀이다.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "한결 1차 모임 · 사전 질문",
  robots: { index: false, follow: false, nocache: true },
};

export default async function QPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <QuestionForm token={token} />;
}
