import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadTemplates } from "@/lib/admin-templates";
import AdminNav from "../AdminNav";
import TemplateBoard from "./TemplateBoard";
import st from "../admin.module.css";

/**
 * 문구 관리 탭 (이슈 #38) — 운영자가 배포 없이 알림톡 문구를 추가·수정·비활성화한다.
 *
 * 🔴 문구 아홉 개는 영업비밀은 아니지만(사전질문 문항과 달리 카카오 심사를 거쳐야
 *    할 안내문이다) 이 화면에서 승인 코드·대체문자까지 함께 다루므로 다른 운영자
 *    화면과 같은 이중 방어를 따른다 — 여기서 한 번, `/api/admin/templates`에서 또 한 번 막는다.
 *
 * ⭐ 첫 데이터를 서버에서 그려서 넘긴다 — 다른 운영자 화면과 같은 이유.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "한결 운영 — 문구 관리",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TemplatesPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const items = await loadTemplates();

  return (
    <main className={st.wrap}>
      <AdminNav current="/admin/templates" />
      <TemplateBoard initial={items} />
    </main>
  );
}
