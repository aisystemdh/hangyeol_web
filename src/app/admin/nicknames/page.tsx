import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadApplications } from "@/lib/admin-data";
import AdminNav from "../AdminNav";
import NicknameBoard from "./NicknameBoard";
import st from "../admin.module.css";

/**
 * 닉네임 배정 탭 (이슈 #39) — 행사 며칠 전, 그 시점의 입금완료 신청 전체에
 * 현장 이름표 번호(1~20)를 한 번에 붙인다(`CONTEXT.md` "닉네임", 결정 14).
 *
 * 🔴 참가자 이름·성별이 보이는 화면이라 다른 운영자 화면과 같은 이중 방어를
 *    따른다 — 여기서 한 번, `/api/admin/nicknames`에서 또 한 번 막는다.
 *
 * ⭐ 첫 데이터를 서버에서 그려서 넘긴다 — `Dashboard`(#34)·`MarketingBoard`(#41)와
 *    같은 이유(빈 화면이 잠깐 보였다가 채워지지 않는다).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영 — 닉네임 배정",
  robots: { index: false, follow: false, nocache: true },
};

export default async function NicknamesPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const items = await loadApplications({ status: "입금완료" });

  return (
    <main className={st.wrap}>
      <AdminNav current="/admin/nicknames" />
      <NicknameBoard initial={items} />
    </main>
  );
}
