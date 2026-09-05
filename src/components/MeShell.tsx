import s from "./Me.module.css";

/**
 * 마이페이지 화면 여덟 개가 공유하는 뼈대(브랜드 표시 + 카드).
 * `SiteChrome`이 `/me/`에는 사이트 헤더를 안 붙이므로(이슈 #32), 여기서 대신
 * 브랜드명을 텍스트로 보여준다 — 홈 게이트의 애니메이션 로고(`LogoMark.tsx`)는
 * 재생 조건이 얽혀 있어(`CLAUDE.md` "되돌리면 깨지는 것" — 게이트 로고) 가져오지
 * 않는다.
 */
export default function MeShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={s.shell}>
      <p className={s.brand}>한결</p>
      <div className={s.card}>{children}</div>
    </main>
  );
}
