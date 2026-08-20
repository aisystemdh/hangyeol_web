import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import GrainCanvas from "@/components/GrainCanvas";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import PageEffects from "@/components/PageEffects";
import Analytics from "@/components/Analytics";
import { SITE, SITE_URL } from "@/lib/site";
import { EVENT } from "@/lib/event";

/**
 * subsets에 "korean"은 넣을 수 없다 — next/font가 이 세 폰트에 대해 인정하는
 * 서브셋 목록에 없다. 대신 latin만 지정해도 한글 @font-face(U+AC00–D7A3)는
 * 그대로 포함된다. subsets는 "무엇을 preload할지"만 정하기 때문이다.
 *
 * preload는 끈다. 한글 폰트는 unicode-range로 수백 개 청크로 쪼개져 있어
 * 전부 preload하면 낭비다. 브라우저가 필요한 구간만 받아가고,
 * display:swap이 그동안 시스템 폰트로 먼저 그려준다.
 */
/**
 * 고딕 한 종으로 통합했다. 예전에는 Gothic A1(제목·버튼·라벨)과 Noto Sans KR(본문)을
 * 함께 실었는데 **둘 다 고딕이라 역할이 겹쳤다** — 사람 눈은 명조 vs 고딕은 즉시
 * 구분하지만 고딕 vs 고딕은 구분하지 못한다. 얻는 것 없이 비용만 냈다.
 *
 * 비용의 크기: 한글은 글자가 11,172자라 unicode-range로 수백 조각씩 쪼개진다.
 * 3종일 때 빌드 결과가 @font-face 961개 / 렌더 차단 CSS 약 179KB(gzip)였다.
 * 이 CSS를 다 읽기 전까지 브라우저는 글자를 한 자도 그리지 않으므로 LCP를 직접 깎는다.
 *
 * `--font-display`와 `--font-body`는 globals.css의 :root가 이 변수 하나를 가리키게
 * 해 두었다. 나중에 제목용 서체를 따로 쓰고 싶으면 거기만 바꾸면 된다.
 */
const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});

const serif = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

const title = `${SITE.name} — ${SITE.slogan}`;
// 숫자·장소는 반드시 EVENT에서 가져온다 — 광고와 실제가 어긋나는 것이 이 시장의 대표 불만이다.
const description = `가치관이 맞는 사람을 오프라인에서 만나는 자리. ${SITE.name} 1차 모임 — ${EVENT.place}, ${EVENT.capacity}명, ${EVENT.priceLabel}.`;

/**
 * 카카오톡·인스타에 링크를 붙였을 때 뜨는 썸네일.
 *
 * `public/og-v2.png`는 `scripts/make-og.py`가 그린 정적 이미지다(재생성: `python scripts/make-og.py`).
 * ⚠️ 날짜·참가비는 일부러 그림에 넣지 않았다 — 캐시된 썸네일이 옛 숫자를 계속 보여주면
 *    "광고와 실제가 다르다"가 된다. 자세한 근거는 그 스크립트 상단 주석에 있다.
 * ⚠️ 파일명의 `-v2`는 캐시 버스터다 — 팔레트가 바뀔 때(흑백→딥그린) 같은 URL이면
 *    카카오톡·브라우저·이미지 옵티마이저가 옛 그림을 계속 내보낸다. 색을 갈면 버전을 올릴 것.
 */
const OG_IMAGE = {
  url: "/og-v2.png",
  width: 1200,
  height: 630,
  alt: title,
};

export const metadata: Metadata = {
  // 실제 주소는 `@/lib/site`의 SITE_URL 하나에서만 온다(robots.ts·sitemap.ts도 같은 값을 쓴다)
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: `%s — ${SITE.name}`,
  },
  description,
  openGraph: {
    title,
    description,
    locale: "ko_KR",
    type: "website",
    images: [OG_IMAGE],
  },
  // 링크를 공유했을 때 텍스트만 뜨지 않고 큰 카드로 뜨게 한다
  twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  // ⚠️ canonical은 여기 넣지 않는다 — 루트에 두면 자식 페이지가 그대로 물려받아
  //    /mission·/why·/principles가 전부 "/"를 정규 주소로 가리키게 된다.
  //    각 page.tsx가 자기 경로를 직접 적는다.
};

/**
 * 구조화 데이터. 상위 1,000만 사이트 중 스키마를 넣은 곳이 17%뿐이라
 * 검색·AI 답변에서 인용될 확률을 올리는 값싼 수단이다.
 *
 * ⚠️ `Event` 스키마는 아직 넣지 않는다 — 필수 속성 `startDate`가 ISO 8601 날짜여야 하는데
 *    현재 `EVENT.date`는 "10월 중"이라 채울 수 없다. 일자가 확정되면 `/events/1`에
 *    Event를 추가할 것. 없는 날짜를 지어내지 않는다.
 */
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  slogan: SITE.slogan,
  url: SITE_URL,
  logo: new URL("/hangyeol-logo-v2.png", SITE_URL).toString(),
  description,
  founder: SITE.operators.map(({ name, role }) => ({
    "@type": "Person",
    name,
    jobTitle: role,
  })),
};

export const viewport: Viewport = {
  themeColor: "#f5f1e8", // --paper. 브라우저 UI(모바일 주소창)가 종이색과 이어진다
  // env(safe-area-inset-*)가 0이 아니려면 필수 — 하단 고정 바·오버레이가 쓴다
  viewportFit: "cover",
};

/**
 * 홈 전용 세션 플래그 2종 — 반드시 **첫 페인트 전**에 <html>에 속성을 붙인다.
 * useEffect로 하면 재방문자가 오버레이/히어로를 한 프레임 이상 보게 된다.
 * 프라이빗 모드에서 sessionStorage 접근이 throw할 수 있어 try/catch로 감쌌다.
 *
 * - `intro-seen` → html[data-intro-seen]: 인트로 오버레이는 세션당 한 번.
 *   자동 재생이라 스크립트가 첫 방문에 즉시 기록한다.
 * - `dialog-phase` → html[data-dialog-phase="q2" 등]: 대화 시퀀스의 진행 위치.
 *   **HomeStage만** 기록하고, 여기서는 읽어서 속성만 붙인다 — 질문 도중 카드
 *   링크로 서브페이지에 다녀와도 React 마운트 전에 CSS(HomeStage.module.css)가
 *   **보던 화면 그대로** 복원하기 위해서다. 정규식 화이트리스트 밖의 값은
 *   버린다(저장소가 오염돼도 임의 속성값이 html에 붙지 않게).
 *
 * 인트로 오버레이(.hero__intro)는 **"/"의 HomeHero에만** 있다. /events/1의 Hero에는
 * 없으므로, 거기서 플래그를 세워 버리면 그 세션에서 홈의 인트로가 한 번도
 * 재생되지 않는다. 그래서 경로가 "/"일 때만 읽고 쓴다.
 *
 * ⚠️ 이 스크립트가 하이드레이션 전에 <html>에 속성을 붙이므로 재방문 시
 *    서버 HTML과 속성이 어긋난다 → <html>에 suppressHydrationWarning이 반드시 필요하다.
 *    (next-themes와 같은 패턴. 한 단계에만 적용되어 자식 검사에는 영향이 없다.)
 * ⚠️ React 컴포넌트가 이 속성들을 **렌더에서 읽으면 안 된다** — 서버 HTML과 달라
 *    하이드레이션이 어긋난다. 이벤트 핸들러/이펙트에서만 읽는다(HomeStage 참조).
 */
const HOME_FLAGS_SCRIPT = `try{if(location.pathname==='/'){if(sessionStorage.getItem('intro-seen')){document.documentElement.setAttribute('data-intro-seen','')}else{sessionStorage.setItem('intro-seen','1')}var p=sessionStorage.getItem('dialog-phase');if(p&&/^(a[1234]|t[12]|why|cmp|hub)$/.test(p)){document.documentElement.setAttribute('data-dialog-phase',p)}}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${sans.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HOME_FLAGS_SCRIPT }} />
      </head>
      <body>
        {/* 사이트 전체 배경. 화면 고정 한 장이라 페이지가 길어져도 비용이 일정하다.
            흰 구간에서만 보이고 검정 밴드에는 가려진다 — globals.css의 .site-grain 참조. */}
        <GrainCanvas className="site-grain" />
        {/* 탭 순서상 가장 먼저 와야 의미가 있다 — 헤더보다 위에 둘 것 */}
        <a className="skip-link" href="#main">
          본문 바로가기
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSONLD),
          }}
        />
        <SiteHeader />
        <main id="main">{children}</main>
        <Footer />
        <PageEffects />
        <Analytics />
      </body>
    </html>
  );
}
