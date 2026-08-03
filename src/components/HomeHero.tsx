import Image from "next/image";
import ReplayButton from "./ReplayButton";
import SkipIntroButton from "./SkipIntroButton";
import GrainCanvas from "./GrainCanvas";
import styles from "./HomeHero.module.css";

const EASE = "cubic-bezier(.22,1,.36,1)";

/**
 * 로고 마크의 왼쪽 획. 좌우 대칭이라 오른쪽은 translate(100 0) scale(-1 1)로 뒤집어 쓴다.
 *
 * public/hangyeol-logo.png의 실제 획을 100×100 viewBox로 옮긴 것이다.
 * 픽셀에서 잰 값(원본 351×489):
 *   중심선 타원 center(99.4, 200) rx 50.4 ry 71 · 획 두께 38
 *   위쪽 끝 (139, 138) · 아래쪽 끝 (152, 287) — 둘 다 안쪽(중앙)으로 갈고리처럼 휜다
 * 변환 v = (p − [175.5, 173]) × 0.29 + 50  (175.5는 좌우 대칭축)
 *
 * ⚠️ 절대 지켜야 할 것: **두 끝점이 대칭축(x=50)에 닿으면 안 된다.**
 *    닿는 순간 미러링된 두 획이 위아래에서 맞물려 하트가 된다. 실제로 예전 path가
 *    끝점을 (50,90)·(50,22)에 두는 바람에 인트로가 하트를 그렸다.
 *    지금은 위 끝 x≈39.4, 아래 끝 x≈43.2로 중앙에 세로 틈이 남는다 — 로고 그대로다.
 */
const STROKE =
  "M39.4 39.9C36.5 38.4 32.2 37.2 27.9 37.2A14.6 20.6 0 0 0 27.9 78.4C33.5 78.4 39.6 80.4 43.2 83.1";

/** 로고 위쪽 두 점. 왼쪽만 적고 오른쪽은 100에서 뺀다. */
const DOT = { cx: 28.8, cy: 18.8, r: 7.4 };

/** 글자별 등장 시각(초) — 핸드오프 타임라인 그대로 */
const LINE_1 = [
  { ch: "결", at: 2.25, lit: 3.05 },
  { ch: "국", at: 2.33 },
  { ch: "에", at: 2.41 },
  { ch: "는", at: 2.49 },
];
const LINE_2 = [
  { ch: "결", at: 2.61, lit: 3.25 },
  { ch: "이", at: 2.69 },
  { ch: "더", at: 2.77 },
  { ch: "라", at: 2.85 },
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

/** 인트로에서 그려지는 로고 획 한 짝. dir이 R이면 좌우 반전. */
function LogoStroke({ dir }: { dir: "L" | "R" }) {
  const path = (
    <path
      d={STROKE}
      fill="none"
      stroke="#111111"
      strokeWidth="11"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* pathLength로 길이를 300에 고정한다 — strokeDraw의 dashoffset 300→0이
         path 길이와 무관하게 정확히 처음부터 끝까지 그리게 된다. */
      pathLength={300}
      strokeDasharray="300"
      style={{ animation: "strokeDraw 2.5s cubic-bezier(.4,0,.3,1) both" }}
    />
  );
  return (
    <g
      style={{
        transformBox: "view-box",
        transformOrigin: "50% 62%",
        animation: `speak${dir} 2.5s cubic-bezier(.4,0,.3,1) both`,
      }}
    >
      {dir === "L" ? path : <g transform="translate(100 0) scale(-1 1)">{path}</g>}
    </g>
  );
}

/**
 * 회사 메인 히어로.
 *
 * 행사 랜딩의 Hero와 다른 점 두 가지:
 *  1) 배경에 나무결 캔버스가 깔린다(§4.1 — 결은 살아온 시간의 흔적이다).
 *  2) 행사 칩·신청 CTA가 없다. 여기는 회사 소개지 신청 페이지가 아니다.
 *
 * 인트로는 **로고 입모양 + 줌인**이다. 로고의 두 획이 "말하듯" 여닫다가
 * (speakL/speakR) 로고 형태 그대로 확대되며 사라진다(logoZoom).
 * 하트를 되살리지 말 것 — 근거와 함정은 위 STROKE 주석에 적어 두었다.
 */
export default function HomeHero() {
  return (
    <section id="hero" className={styles.stage} aria-label="한결 소개">
      <GrainCanvas className={styles.grain} />
      <div className={styles.veil} aria-hidden="true" />

      {/* 오버레이 밖에 둔다 — .hero__intro는 aria-hidden이라 안에 넣으면
          스크린리더와 탭 순서에서 이 버튼이 함께 숨는다. */}
      <SkipIntroButton />

      <div className={`hero ${styles.inner}`}>
        {/* 0–2.5초 인트로 오버레이.
            prefers-reduced-motion과 재방문(html[data-intro-seen])에서는 CSS가 통째로 숨긴다. */}
        <div className="hero__intro" data-intro aria-hidden="true">
          <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "50% 52%",
                animation: "logoZoom 2.5s cubic-bezier(.45,0,.35,1) both",
              }}
            >
              <LogoStroke dir="L" />
              <LogoStroke dir="R" />
              {/* 두 점은 로고의 일부다. 깜빡이거나 사라지지 않고 끝까지 보인다. */}
              <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#111111" />
              <circle cx={100 - DOT.cx} cy={DOT.cy} r={DOT.r} fill="#111111" />
            </g>
          </svg>
        </div>

        {/* 바로 아래 100px 헤드라인과 워드마크가 이름을 말하므로 이 이미지는 장식이다 */}
        <Image
          src="/hangyeol-logo.png"
          alt=""
          width={351}
          height={489}
          className="hero__logo"
          priority
          loading="eager"
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
            <span style={{ display: "inline-block", animation: "wpFadeOut .4s 7.4s both" }}>
              <span
                style={{
                  display: "inline-block",
                  animation: "wpMergeR .75s 6.6s cubic-bezier(.5,0,.2,1) both",
                }}
              >
                <span
                  style={{ display: "inline-block", animation: `wpPop .5s 5.3s ${EASE} both` }}
                >
                  결
                </span>
              </span>
            </span>
            <span style={{ display: "inline-block", animation: "wpFadeOut .4s 7.4s both" }}>
              <span
                style={{
                  display: "inline-block",
                  animation: "wpMergeL .75s 6.6s cubic-bezier(.5,0,.2,1) both",
                }}
              >
                <span
                  style={{ display: "inline-block", animation: `wpPop .5s 6s ${EASE} both` }}
                >
                  가치
                </span>
              </span>
            </span>
          </div>
          <div className="hero__wp-result">
            한
            <span
              style={{
                display: "inline-block",
                color: "var(--ink)",
                animation: "ulIn .45s 8.95s both",
              }}
            >
              결
            </span>
            <span className="hero__swap">
              <span style={{ gridArea: "1 / 1", animation: "wpFadeOut .45s 8.5s both" }}>
                가치
              </span>
              <span
                style={{
                  gridArea: "1 / 1",
                  color: "var(--ink)",
                  animation: `wpFadeIn .5s 8.55s ${EASE} both`,
                }}
              >
                <span style={{ display: "inline-block", animation: "ulIn .45s 8.95s both" }}>
                  같이
                </span>
              </span>
            </span>
          </div>
        </div>
        <span className="sr-only">한결같이 — 결이 같은 사람</span>

        {/* "결"의 뜻을 즉시 풀어준다 — /mission까지 가야 알 수 있으면
            대부분의 방문자는 언어유희를 눈치채지 못하고 지나간다. */}
        <p className="hero__gloss">
          결 = 나뭇결처럼 바뀌지 않는 성향과 가치관. 결이 같은 사람과 이야기하는 자리입니다.
        </p>

        <ReplayButton />

        <p className="hero__lead">
          한결은 사람들이 서로를 더 깊이 이해하도록 대화를 설계하는 브랜드다.
        </p>

        <div className={styles.hint} aria-hidden="true">
          <span>아래로</span>
          <span className={styles.hintLine} />
        </div>
      </div>
    </section>
  );
}
