import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadApplications } from "@/lib/admin-data";
import { loadNotifyFailed, loadNotifyTemplates, loadNotifyTodo } from "@/lib/admin-notify";
import AdminNav from "../AdminNav";
import NotifyBoard from "./NotifyBoard";
import st from "../admin.module.css";

/**
 * 알림톡 발송 화면 (이슈 #37). `/admin`의 신청 목록 옆 두 번째 탭이다.
 *
 * 🔴 참가자의 이름·연락처가 보이는 화면이다 — 여기서 한 번,
 *    `/api/admin/notify`·`/api/admin/notify/{preview,send}`에서 또 한 번 막는다.
 *
 * ⭐ 신청 목록(`/admin`)과 같은 이유로 **첫 데이터를 서버에서 그려 넘긴다** —
 *    빈 화면이 잠깐 보였다가 채워지지 않는다.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영 · 알림톡",
  robots: { index: false, follow: false, nocache: true },
};

export default async function NotifyPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [applications, todo, failed, templates] = await Promise.all([
    loadApplications(),
    loadNotifyTodo(),
    loadNotifyFailed(),
    loadNotifyTemplates(),
  ]);

  return (
    <main className={st.wrap}>
      <AdminNav current="/admin/notify" />
      <NotifyBoard
        initialApplications={applications}
        initialTodo={todo}
        initialFailed={failed}
        templates={templates}
      />
    </main>
  );
}
