import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import st from "./admin.module.css";

/**
 * 스태프 현황판 — **재건 중**(#34).
 *
 * 옛 현황판은 상태 아홉 개와 성별 슬롯을 전제로 만들어져 있어 #30에서 통째로 버렸다.
 * 여기 남아 있는 것은 **로그인이 갈 곳**뿐이다 — `/admin/login`이 성공하면 `/admin`으로
 * 보내는데, 이 파일이 없으면 비밀번호를 맞게 넣은 운영자가 **404를 본다.**
 *
 * 🔴 다시 세울 때 지킬 것은 그대로다 — 참가자 20명의 이름·연락처·생년월일이 전부
 *    보이는 화면이라 **화면에서 한 번, API 하나하나에서 또 한 번** 막는다.
 *    (지금은 화면 쪽 확인만 살아 있고, 막을 운영자 API가 아직 없다.)
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영",
  // 🔴 검색엔진에 절대 올라가면 안 된다.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <main className={st.loginWrap}>
      <div className={st.loginBox}>
        <h1 className={st.loginTitle}>한결 운영</h1>
        <p className={st.loginNote}>
          현황판을 다시 만들고 있습니다. 지금은 신청이 저장되고 입금 안내가 자동으로
          나가는 것까지 동작합니다.
        </p>
      </div>
    </main>
  );
}
