import Image from "next/image";
import SkipIntroButton from "./SkipIntroButton";
import styles from "./HomeHero.module.css";

const EASE = "cubic-bezier(.22,1,.36,1)";

/**
 * 로고 마크의 왼쪽 획. 좌우 대칭이라 오른쪽은 translate(100 0) scale(-1 1)로 뒤집어 쓴다.
 *
 * public/hangyeol-logo-v2.png의 실제 획을 100×100 viewBox로 옮긴 것이다.
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

/**
 * 글자별 등장 시각(초).
 *
 * ⚠️ 핸드오프 원본은 2.25초에 시작했다. **전 구간을 1.35초씩 앞당겼다** —
 *    순서와 간격(0.08초)은 원본 그대로다.
 *
 *    이유: 이 h1이 홈의 LCP 요소인데 `opacity:0`으로 시작하므로,
 *    실제 LCP = (첫 렌더 시각) + (여기 적힌 지연)이 된다. 2.25초면 어떤 회선에서도
 *    합격선 2.5초를 넘길 수 없었다. 0.9초면 첫 렌더가 1.5초여도 2.4초에 들어온다.
 *    **이 값을 다시 늘리면 홈은 Core Web Vitals를 구조적으로 통과하지 못한다.**
 */
const LINE_1 = [
  { ch: "결", at: 0.9, lit: 1.7 },
  { ch: "국", at: 0.98 },
  { ch: "에", at: 1.06 },
  { ch: "는", at: 1.14 },
];
const LINE_2 = [
  { ch: "결", at: 1.26, lit: 1.9 },
  { ch: "이", at: 1.34 },
  { ch: "더", at: 1.42 },
  { ch: "라", at: 1.5 },
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
      stroke="currentColor"
      strokeWidth="11"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* pathLength로 길이를 300에 고정한다 — strokeDraw의 dashoffset 300→0이
         path 길이와 무관하게 정확히 처음부터 끝까지 그리게 된다. */
      pathLength={300}
      strokeDasharray="300"
      style={{ animation: "strokeDraw 1.2s cubic-bezier(.4,0,.3,1) both" }}
    />
  );
  return (
    <g
      style={{
        transformBox: "view-box",
        transformOrigin: "50% 62%",
        animation: `speak${dir} 1.2s cubic-bezier(.4,0,.3,1) both`,
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
 *
 * ── 타임라인 (총 4.5초) ─────────────────────────────────────
 *  0.0–1.2  인트로 오버레이 (strokeDraw · speakL/R · logoZoom · introOut)
 *  0.9–1.5  헤드라인 글자 8개          ← **LCP 요소**. 더 뒤로 미루지 말 것
 *  1.5      한 줄 설명 (.hero__lead)
 *  1.7      뜻 풀이 (.hero__gloss)     ← 5초 테스트의 답. 워드플레이보다 먼저 나온다
 *  1.7/1.9  헤드라인 하이라이트
 *  2.2      작은 로고 (.hero__logo)
 *  2.4–4.5  워드플레이 결+가치 → 한결같이
 *  4.5      건너뛰기 버튼 퇴장 (heroSkipOut)
 *
 * 예전에는 이 전체가 9.4초였고 뜻 풀이가 9.15초에 나왔다. 지연값을 손볼 때는
 * 위 순서가 유지되는지 확인할 것 — 특히 wpMerge(3.05+0.4)가 끝난 뒤에
 * wpFadeOut(3.45)이 시작해야 두 글자가 합쳐졌다가 사라지는 것으로 보인다.
 */
export default function HomeHero() {
  return (
    <section id="hero" className={styles.stage} aria-label="한결 소개">
      {/* 나무결 베일은 무대(HomeStage)가 한 장 깐다 — 히어로가 페이드아웃된 뒤에도
          다이얼로그 글자 뒤의 결을 계속 눌러줘야 하기 때문이다. */}

      {/* 오버레이 밖에 둔다 — .hero__intro는 aria-hidden이라 안에 넣으면
          스크린리더와 탭 순서에서 이 버튼이 함께 숨는다. */}
      <SkipIntroButton />

      <div className={`hero ${styles.inner}`}>
        {/* 0–2.5초 인트로 오버레이.
            prefers-reduced-motion과 재방문(html[data-intro-seen])에서는 CSS가 통째로 숨긴다. */}
        <div className="hero__intro" data-intro aria-hidden="true">
          {/* 획·점이 전부 currentColor라 여기 color 하나로 로고색이 정해진다 */}
          <svg
            viewBox="0 0 100 100"
            aria-hidden="true"
            focusable="false"
            style={{ color: "var(--ink)" }}
          >
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "50% 52%",
                animation: "logoZoom 1.2s cubic-bezier(.45,0,.35,1) both",
              }}
            >
              <LogoStroke dir="L" />
              <LogoStroke dir="R" />
              {/* 두 점은 로고의 일부다. 깜빡이거나 사라지지 않고 끝까지 보인다. */}
              <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="currentColor" />
              <circle cx={100 - DOT.cx} cy={DOT.cy} r={DOT.r} fill="currentColor" />
            </g>
          </svg>
        </div>

        {/* 바로 아래 100px 헤드라인과 워드마크가 이름을 말하므로 이 이미지는 장식이다.
            ⚠️ priority(=preload)를 다시 붙이지 말 것 — 2.2초에야 나타나는 장식 이미지가
               LCP 경쟁 구간에서 대역폭을 먼저 가져간다. 첫 화면에 즉시 보이는 로고는
               SiteHeader의 것 하나뿐이고, priority는 거기에만 남겨 두었다. */}
        <Image
          src="/hangyeol-logo-v2.png"
          alt=""
          width={351}
          height={489}
          className="hero__logo"
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
            <span style={{ display: "inline-block", animation: "wpFadeOut .2s 3.45s both" }}>
              <span
                style={{
                  display: "inline-block",
                  animation: "wpMergeR .4s 3.05s cubic-bezier(.5,0,.2,1) both",
                }}
              >
                <span
                  style={{ display: "inline-block", animation: `wpPop .3s 2.4s ${EASE} both` }}
                >
                  결
                </span>
              </span>
            </span>
            <span style={{ display: "inline-block", animation: "wpFadeOut .2s 3.45s both" }}>
              <span
                style={{
                  display: "inline-block",
                  animation: "wpMergeL .4s 3.05s cubic-bezier(.5,0,.2,1) both",
                }}
              >
                <span
                  style={{ display: "inline-block", animation: `wpPop .3s 2.75s ${EASE} both` }}
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
                animation: "ulIn .25s 4.25s both",
              }}
            >
              결
            </span>
            <span className="hero__swap">
              <span style={{ gridArea: "1 / 1", animation: "wpFadeOut .25s 4s both" }}>
                가치
              </span>
              <span
                style={{
                  gridArea: "1 / 1",
                  color: "var(--ink)",
                  animation: `wpFadeIn .3s 4.05s ${EASE} both`,
                }}
              >
                <span style={{ display: "inline-block", animation: "ulIn .25s 4.25s both" }}>
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

        <p className="hero__lead">
          한결은 사람들이 서로를 더 깊이 이해하도록 대화를 설계하는 브랜드입니다.
        </p>
        {/* "처음부터 다시 보기"는 무대(HomeStage) 허브로 이사했다 — 인트로가 끝나면
            이 레이어 자체가 크로스페이드로 사라지므로 여기 두면 죽은 버튼이 된다.
            스크롤 힌트도 같은 이유로 허브로 갔다. */}
      </div>
    </section>
  );
}
