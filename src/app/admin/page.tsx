import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadApplications, loadSeats } from "@/lib/admin-data";
import AdminNav from "./AdminNav";
import Dashboard from "./Dashboard";
import st from "./admin.module.css";

/**
 * 신청 목록 (이슈 #34). `/admin/login`이 성공하면 여기로 온다.
 *
 * 🔴 참가자 20명의 이름·연락처·생년월일이 전부 보이는 화면이다 — 여기서 한 번,
 *    `/api/admin/applications`에서 또 한 번 막는다(`CLAUDE.md`).
 *    `src/proxy.ts`가 주소 패턴으로 이미 막고 있지만 지우지 않고 남겨 둔다.
 *
 * ⭐ **첫 데이터를 서버에서 그려서 넘긴다.** 빈 표가 잠깐 보였다가 채워지지
 *    않고, 클라이언트가 뜨자마자 같은 것을 또 요청하지도 않는다 — `Dashboard`는
 *    이 값을 초깃값으로만 쓰고 30초마다 갱신한다(결정 003 §7).
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영",
  // 🔴 검색엔진에 절대 올라가면 안 된다.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [initial, initialSeats] = await Promise.all([loadApplications(), loadSeats()]);

  return (
    <main className={st.wrap}>
      <AdminNav current="/admin" />
      <Dashboard initial={initial} initialSeats={initialSeats} />
    </main>
  );
}
