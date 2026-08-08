import Image from "next/image";
import { EVENT } from "@/lib/event";

const EASE = "cubic-bezier(.22,1,.36,1)";

/**
 * 글자별 등장 시각(초).
 *
 * ⚠️ 핸드오프 원본은 2.5초짜리 인트로 오버레이가 걷히기를 기다리느라
 *    헤드라인이 2.25초에 시작했다. 인트로는 회사 메인(/)으로 옮겨졌으므로
 *    **전 구간을 정확히 2.0초씩 앞당겼다** — 순서와 간격은 원본 그대로다.
 *    (헤드라인 0.25 → 칩 1.15 → CTA 1.3 → 한 줄 설명 1.4 → 로고 3.0 → 워드플레이 3.3~6.95)
 *    globals.css에 남아 있는 지연값(.hero__logo 5s 등)은 아래 인라인 style이 덮는다.
 */
const LINE_1 = [
  { ch: "결", at: 0.25, lit: 1.05 },
  { ch: "국", at: 0.33 },
  { ch: "에", at: 0.41 },
  { ch: "는", at: 0.49 },
];
const LINE_2 = [
  { ch: "결", at: 0.61, lit: 1.25 },
  { ch: "이", at: 0.69 },
  { ch: "더", at: 0.77 },
  { ch: "라", at: 0.85 },
];

function Char({ ch, at, lit }: { ch: string; at: number; lit?: number }) {
  const animation = `charIn .5s ${at}s ${EASE} both`;
  if (lit === undefined) {
    return (
      <span className="hero__char" style={{ animation }}>
        {ch}
      </span>
    );
  }
  return (
    <span className="hero__char hero__char--lit" style={{ animation }}>
      <span
        className="hero__hl"
        style={{ animation: `hlIn .5s ${lit}s ${EASE} both` }}
      />
      <span className="hero__glyph">{ch}</span>
    </span>
  );
}

export default function Hero() {
  return (
    <section id="hero" className="hero" aria-label="한결 소개">
      {/* 바로 아래 100px 헤드라인이 브랜드를 말하므로 이 이미지는 장식이다.
          ⚠️ priority(=preload)를 다시 붙이지 말 것 — 3초에야 나타나는 장식 이미지가
             LCP 경쟁 구간에서 대역폭을 먼저 가져간다. SiteHeader의 로고에만 남겨 두었다. */}
      <Image
        src="/hangyeol-logo.png"
        alt=""
        width={351}
        height={489}
        className="hero__logo"
        style={{ animation: "logoIn .9s 3s var(--ease-out) both" }}
      />

      <div className="hero__headline-wrap">
        <h1 className="hero__headline">
          {LINE_1.map((c, i) => (
            <Char key={`a${i}`} {...c} />
          ))}
          <br />
          {LINE_2.map((c, i) => (
            <Char key={`b${i}`} {...c} />
          ))}
        </h1>
      </div>

      {/* 결 + 가치 → 한결같이 */}
      <div className="hero__wordplay" aria-hidden="true">
        <div className="hero__wp-parts">
          <span style={{ display: "inline-block", animation: "wpFadeOut .4s 5.4s both" }}>
            <span
              style={{
                display: "inline-block",
                animation: "wpMergeR .75s 4.6s cubic-bezier(.5,0,.2,1) both",
              }}
            >
              <span
                style={{ display: "inline-block", animation: `wpPop .5s 3.3s ${EASE} both` }}
              >
                결
              </span>
            </span>
          </span>
          <span style={{ display: "inline-block", animation: "wpFadeOut .4s 5.4s both" }}>
            <span
              style={{
                display: "inline-block",
                animation: "wpMergeL .75s 4.6s cubic-bezier(.5,0,.2,1) both",
              }}
            >
              <span
                style={{ display: "inline-block", animation: `wpPop .5s 4s ${EASE} both` }}
              >
                가치
              </span>
            </span>
          </span>
        </div>
        <div
          className="hero__wp-result"
          style={{ animation: "wpFadeIn .5s 5.6s var(--ease-out) both" }}
        >
          한
          <span
            style={{
              display: "inline-block",
              color: "var(--ink)",
              animation: "ulIn .45s 6.95s both",
            }}
          >
            결
          </span>
          <span className="hero__swap">
            <span style={{ gridArea: "1 / 1", animation: "wpFadeOut .45s 6.5s both" }}>
              가치
            </span>
            <span
              style={{
                gridArea: "1 / 1",
                color: "var(--ink)",
                animation: `wpFadeIn .5s 6.55s ${EASE} both`,
              }}
            >
              <span style={{ display: "inline-block", animation: "ulIn .45s 6.95s both" }}>
                같이
              </span>
            </span>
          </span>
        </div>
      </div>
      <span className="sr-only">한결같이 — 결이 같은 사람</span>

      <p
        className="hero__lead"
        style={{ animation: "riseIn .8s 1.4s var(--ease-out) both" }}
      >
        가치관이 맞는 사람을 오프라인에서 만나는 자리.
      </p>

      <div
        className="hero__chips"
        style={{ animation: "riseIn .8s 1.15s var(--ease-out) both" }}
      >
        <span className="chip">{EVENT.date}</span>
        <span className="chip">{EVENT.place}</span>
        <span className="chip">{EVENT.capacity}명</span>
      </div>

      <a
        href="#apply"
        className="pill hero__cta"
        style={{ animation: "riseIn .8s 1.3s var(--ease-out) both" }}
      >
        신청하기
      </a>
    </section>
  );
}
