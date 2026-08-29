import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadBoard } from "@/lib/admin-data";
import Board from "./Board";

/**
 * 스태프 현황판.
 *
 * 🔴 참가자 20명의 이름·연락처·생년월일이 전부 보이는 화면이다.
 *    여기서 먼저 막고, API 하나하나도 다시 막는다(둘 중 하나만 있으면 새기 쉽다).
 *
 * ⭐ 첫 데이터를 **서버에서 그려서 넘긴다.** 빈 표가 잠깐 보였다가 채워지지 않고,
 *    요청도 한 번 줄어든다.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영",
  // 🔴 검색엔진에 절대 올라가면 안 된다.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const initial = await loadBoard();
  return <Board initial={initial} />;
}
