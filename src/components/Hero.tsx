import Image from "next/image";
import { EVENT } from "@/lib/event";

/**
 * /events/1 히어로 — **정적이다. 애니메이션을 되살리지 말 것.** (8차 소유자 결정)
 *
 * 홈에서 인트로·워드플레이를 이미 본 방문자가 "신청하기"를 눌러 왔는데 같은
 * 애니메이션이 또 시작되면 처음 화면으로 돌아간 줄 안다(실제 사용자 피드백).
 * 그래서 이 히어로는 홈 애니메이션이 **완벽하게 끝난 시점의 화면을 그대로** 그린다.
 *
 * ⚠️ 전역 .hero__* 클래스들은 HomeHero용 기본 애니메이션(지연 포함)을 갖고 있다 —
 *    inline `animation: "none"`이 그걸 눌러야 요소가 지연 없이 즉시 보인다.
 *    (예: .hero__wp-result는 기본이 3.55초 뒤 등장이다.)
 */

/** 하이라이트 바가 이미 켜진 '결' 글자 — 홈 시퀀스의 종료 상태 */
function LitChar({ ch }: { ch: string }) {
  return (
    <span className="hero__char hero__char--lit">
      <span className="hero__hl" style={{ transform: "scaleX(1)" }} />
      <span className="hero__glyph">{ch}</span>
    </span>
  );
}

/** ulIn 애니메이션의 종료 상태 — 테라코타 밑줄 + 잉크색 */
const UNDERLINED = {
  display: "inline-block",
  color: "var(--ink)",
  boxShadow: "inset 0 -3px 0 var(--terra)",
} as const;

export default function Hero() {
  return (
    <section id="hero" className="hero" aria-label="한결 소개">
      {/* 바로 아래 100px 헤드라인이 브랜드를 말하므로 이 이미지는 장식이다.
          ⚠️ priority(=preload)를 다시 붙이지 말 것 — SiteHeader의 로고에만 남겨 두었다. */}
      <Image
        src="/hangyeol-logo-v2.png"
        alt=""
        width={351}
        height={489}
        className="hero__logo"
        style={{ animation: "none" }}
      />

      <div className="hero__headline-wrap">
        <h1 className="hero__headline">
          <LitChar ch="결" />
          <span className="hero__char">국</span>
          <span className="hero__char">에</span>
          <span className="hero__char">는</span>
          <br />
          <LitChar ch="결" />
          <span className="hero__char">이</span>
          <span className="hero__char">더</span>
          <span className="hero__char">라</span>
        </h1>
      </div>

      {/* 워드플레이의 종료 상태만 — "한결같이", 결·같이에 밑줄 */}
      <div className="hero__wordplay" aria-hidden="true">
        <div className="hero__wp-result" style={{ animation: "none" }}>
          한<span style={UNDERLINED}>결</span>
          <span style={UNDERLINED}>같이</span>
        </div>
      </div>
      <span className="sr-only">한결같이 — 결을 보는 자리</span>

      {/* ⚠️ "가치관이 맞는 사람" · "답변이 비슷한 상대"로 되돌리지 말 것.
             2부 페어링은 최대유사 5쌍 + **최소유사 5쌍**이라 절반은 결이 가장 다른
             사람과 앉는다(Timeline.tsx의 같은 경고 참조). 참가비를 받는 페이지의
             사실 주장은 표시광고법상 사업자가 실증해야 한다.
             홈 히어로 · 홈 허브 · 이 줄이 같은 약속을 하므로 **함께** 고칠 것. */}
      <p className="hero__lead" style={{ animation: "none" }}>
        생각이 닮은 사람과도, 전혀 다른 사람과도 마주 앉는 자리.
      </p>

      <div className="hero__chips" style={{ animation: "none" }}>
        <span className="chip">{EVENT.date}</span>
        <span className="chip">{EVENT.place}</span>
        <span className="chip">{EVENT.capacity}명</span>
      </div>

      <a href="#apply" className="pill hero__cta" style={{ animation: "none" }}>
        신청하기
      </a>
    </section>
  );
}
