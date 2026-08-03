import type { Metadata, Viewport } from "next";
import { Gothic_A1, Noto_Sans_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import PageEffects from "@/components/PageEffects";
import { SITE } from "@/lib/site";
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
const display = Gothic_A1({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

const body = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
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

export const metadata: Metadata = {
  // TODO: 실제 도메인이 정해지면 교체
  metadataBase: new URL("https://hangyeol.example"),
  title: {
    default: title,
    template: `%s — ${SITE.name}`,
  },
  description,
  openGraph: { title, description, locale: "ko_KR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

/**
 * 인트로는 세션당 한 번만 재생한다.
 * useEffect로 하면 재방문자가 흰 오버레이를 한 프레임 보게 되므로
 * 반드시 **첫 페인트 전**에 <html>에 속성을 붙여야 한다.
 * 프라이빗 모드에서 sessionStorage 접근이 throw할 수 있어 try/catch로 감쌌다.
 *
 * 인트로 오버레이(.hero__intro)는 **"/"의 HomeHero에만** 있다. /events/1의 Hero에는
 * 없으므로, 거기서 플래그를 세워 버리면 그 세션에서 홈의 인트로가 한 번도
 * 재생되지 않는다. 그래서 경로가 "/"일 때만 읽고 쓴다.
 *
 * ⚠️ 이 스크립트가 하이드레이션 전에 <html>에 data-intro-seen을 붙이므로 재방문 시
 *    서버 HTML과 속성이 어긋난다 → <html>에 suppressHydrationWarning이 반드시 필요하다.
 *    (next-themes와 같은 패턴. 한 단계에만 적용되어 자식 검사에는 영향이 없다.)
 */
const INTRO_SEEN_SCRIPT = `try{if(location.pathname==='/'){if(sessionStorage.getItem('intro-seen')){document.documentElement.setAttribute('data-intro-seen','')}else{sessionStorage.setItem('intro-seen','1')}}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${display.variable} ${body.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SEEN_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <Footer />
        <PageEffects />
      </body>
    </html>
  );
}
