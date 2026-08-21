import Image from "next/image";
import styles from "./HomeHero.module.css";

const EASE = "cubic-bezier(.22,1,.36,1)";

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

/**
 * 회사 메인 히어로 — **건너뛰기 경로 전용 화면**(10차, A안 §1-4).
 *
 * 게이트에서 「건너뛰기」를 고른 사람이 여기로 온다. 온보딩을 안 해도
 * **「결」이라는 말은 한 번 만나고** 내려가게 하는 것이 이 화면의 일이다.
 * 예전에는 이게 첫 화면이었고 인트로 로고 오버레이도 여기 있었다 —
 * 로고는 게이트(LogoMark)로 이사했고, 여기 남은 건 **텍스트 애니메이션**이다.
 *
 * ⚠️ 이 레이어는 비활성 동안 CSS로 애니메이션이 **멈춰 있다**
 *    (HomeStage.module.css의 .layerHero:not([data-active]) 규칙).
 *    상시 마운트라 그 장치가 없으면 게이트를 보는 동안 다 재생돼 버리고,
 *    건너뛰기를 누른 사람은 끝난 화면을 보게 된다.
 *
 * ── 타임라인 ────────────────────────────────────────────────
 *  0.9–1.5  헤드라인 글자 8개          ← **LCP 요소**. 더 뒤로 미루지 말 것
 *  1.5      나뭇결 두 줄 (.hero__gloss)
 *  1.7/1.9  헤드라인 하이라이트
 *  1.9      사람도 그렇습니다 (.hero__lead)
 *  2.2      작은 로고 (.hero__logo)
 *  2.4–4.5  워드플레이 결+가치 → 한결같이
 *  4.6      「그 왜를 묻는 자리」 한 줄 · CTA · 메타
 *
 * wpMerge(3.05+0.4)가 끝난 뒤에 wpFadeOut(3.45)이 시작해야
 * 두 글자가 합쳐졌다가 사라지는 것으로 보인다 — 지연값을 손볼 때 확인할 것.
 */
export default function HomeHero({ onStart }: { onStart: () => void }) {
  return (
    <section id="hero" className={styles.stage} aria-label="한결 소개">
      {/* 나무결 베일은 무대(HomeStage)가 한 장 깐다 — 히어로가 페이드아웃된 뒤에도
          다이얼로그 글자 뒤의 결을 계속 눌러줘야 하기 때문이다. */}

      <div className={`hero ${styles.inner}`}>
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
        <span className="sr-only">한결같이 — 결을 보는 자리</span>

        {/* ⚠️ 예전 이 자리에는 「결 = 나뭇결처럼 바뀌지 않는 성향과 가치관.
               결이 같은 사람과 이야기하는 자리입니다.」가 있었다. **세 군데가 틀렸다.**
             ① 「성향과 가치관」은 정본 정의의 **답** 쪽이다. 결은 성향이 아니라
                그 성향 밑에 깔린 **이유**다(01_brand_philosophy §4.2 — 답과 결의 분리).
                그 정의대로면 §4.3의 "같은 답, 다른 결" 사례 자체가 성립하지 않는다.
             ② 「바뀌지 않는」도 과하다. 정본 표는 「잘 안 바뀜」이고, T+5 리포트는
                "사람은 상황과 시간에 따라 달라집니다"라고 적어 내보낸다.
             ③ 「결이 같은 사람과」는 절반에게 **사실이 아니다** — 2부 페어링은
                최대유사 5쌍 + 최소유사 5쌍이다. 되돌리지 말 것. */}
        <p className="hero__gloss">
          나뭇결은 세로로 켜야 보입니다.
          <br />
          겉만 봐서는 안 나오고, 잘라야 나옵니다.
        </p>

        <p className="hero__lead">
          사람도 그렇습니다. 무엇을 고르는지가 아니라 왜 그걸 고르는지에 있습니다.
        </p>

        <p className={styles.ask}>
          한결은 그 <strong>「왜」</strong>를 묻는 자리를 만듭니다.
        </p>

        {/* 게이트에서 이미 한 번 거절한 사람이다. **약하게** 놓는다 —
            눌러도 되고, 그냥 페이지를 계속 내려봐도 되어야 한다. */}
        <button type="button" className={styles.cta} onClick={onStart}>
          세 번 물어보겠습니다 →
        </button>
        {/* 시간 비용과 "평가받나" 불안을 **누르기 전에** 제거한다.
            ⚠️ 「정답은 없습니다」는 A안 전체의 전제다(Rule 4·14 — 열등한 선택지를
               만들지 않는다). 이 줄이 없으면 사용자가 "맞는 답"을 찾기 시작하고,
               그러면 이유가 안 나온다. 지우지 말 것. */}
        {/* ⚠️ 소요 시간은 게이트 한 줄(「단 1분으로 “나” 찾기」)과 **반드시 같은 숫자**여야
               한다. 한 사이트가 1분과 2분을 동시에 약속하면 둘 다 안 믿긴다.
               ⚠️ 1분은 **아직 실측한 적이 없다**(탭 10번 + 타자기 3회). 파일럿에서
                  넘으면 여기와 게이트를 같이 고친다. */}
        <p className={styles.ctaMeta}>1분이면 됩니다 · 정답은 없습니다</p>
      </div>
    </section>
  );
}
