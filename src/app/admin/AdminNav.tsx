import Link from "next/link";
import { ADMIN_NAV } from "@/lib/admin-nav";
import st from "./admin.module.css";

/**
 * 운영자 화면 탭. 서버 컴포넌트다 — 활성 탭은 부르는 페이지가 자기 경로를
 * `current`로 넘겨 표시한다(클라이언트 훅 `usePathname` 없이도 된다).
 *
 * 목록 자체(`ADMIN_NAV`)를 늘리는 것 말고는 이 파일을 고칠 일이 없게 만든 것이
 * 이슈 #34의 요구사항이다 — #37·#39·#41이 각자 탭을 더할 곳이 여기다.
 */
export default function AdminNav({ current }: { current: string }) {
  return (
    <nav className={st.tabs} aria-label="운영 화면">
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.href === current ? st.tabOn : st.tab}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
