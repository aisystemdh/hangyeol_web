import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadFunnel, loadSourceCounts } from "@/lib/admin-marketing";
import AdminNav from "../AdminNav";
import MarketingBoard from "./MarketingBoard";
import st from "../admin.module.css";

/**
 * 마케팅 탭 — 유입과 퍼널 (이슈 #41).
 *
 * 🔴 참가자 유입 경로·전환 숫자를 보는 화면이라 다른 운영자 화면과 같은 이중 방어를
 *    그대로 따른다 — 여기서 한 번, `/api/admin/marketing`에서 또 한 번 막는다.
 *
 * ⭐ **첫 데이터를 서버에서 그려서 넘긴다.** `Dashboard`(#34)와 같은 이유 —
 *    빈 화면이 잠깐 보였다가 채워지지 않는다.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영 — 마케팅",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MarketingPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [sources, funnel] = await Promise.all([loadSourceCounts(), loadFunnel()]);

  return (
    <main className={st.wrap}>
      <AdminNav current="/admin/marketing" />
      <MarketingBoard initialSources={sources} initialFunnel={funnel} />
    </main>
  );
}
