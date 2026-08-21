import Image from "next/image";

/**
 * 로고 마크. 게이트(§1-3)가 첫 화면에서 재생하고 멈춘다.
 *
 * ── SVG로 그리다가 실제 로고 이미지로 바뀐다 ────────────────────
 * ⚠️ **쉬는 모양은 손으로 딴 좌표가 아니라 진짜 로고 PNG다.** 처음엔 두 획을
 *    SVG로 그리고 "말하듯" 움직이다가(strokeDraw·speakL/R, ~1.2s), 그 동작이
 *    끝나갈 즈음 `hangyeol-mark-v2.png`(헤더가 쓰는 바로 그 파일)로 크로스페이드한다.
 *
 *    왜: 아래 STROKE는 원본 PNG에서 픽셀을 재서 손으로 옮긴 근사치다(변환 공식은
 *    STROKE 정의 옆 주석 참조). 예전엔 다 그리자마자 줌으로 확대돼 사라졌으니
 *    (`logoZoom`) 근사치의 오차가 보일 새가 없었다. 게이트가 생기며 **이 모양이
 *    화면에 계속 남게 되자** 오차가 드러났다 — 위쪽 두 훅 사이 틈이 실물보다
 *    좁게 그려져 점(눈) + 좁은 틈이 하트처럼 읽혔다(2026-08-21 실측 비교).
 *    좌표를 더 정밀하게 다듬는 대신, 동작이 끝나면 **진짜 이미지로 바꿔치기**해
 *    쉬는 모양이 헤더 로고와 항상 정확히 같도록 만들었다 — 다음에 STROKE를 또
 *    손보게 되더라도 이 자리는 다시 깨지지 않는다.
 *
 * ── 좌우 대칭 획 (SVG 그리기 구간에만 쓰인다) ──────────────────
 * 좌우 대칭이라 오른쪽은 translate(100 0) scale(-1 1)로 뒤집어 쓴다.
 * public/hangyeol-logo-v2.png의 실제 획을 100×100 viewBox로 옮긴 것이다.
 * 픽셀에서 잰 값(원본 351×489):
 *   중심선 타원 center(99.4, 200) rx 50.4 ry 71 · 획 두께 38
 *   위쪽 끝 (139, 138) · 아래쪽 끝 (152, 287) — 둘 다 안쪽(중앙)으로 갈고리처럼 휜다
 * 변환 v = (p − [175.5, 173]) × 0.29 + 50  (175.5는 좌우 대칭축)
 *
 * ⚠️ 절대 지켜야 할 것: **두 끝점이 대칭축(x=50)에 닿으면 안 된다.**
 *    닿는 순간 미러링된 두 획이 위아래에서 맞물려 하트가 된다. 실제로 예전 path가
 *    끝점을 (50,90)·(50,22)에 두는 바람에 인트로가 하트를 그렸다 — 지금 값은
 *    그 문제는 피했지만, 위에 적은 대로 **또 다른 이유로** 여전히 하트에 가까워
 *    보였다. 크로스페이드가 최종 방어선이다.
 */
const STROKE =
  "M39.4 39.9C36.5 38.4 32.2 37.2 27.9 37.2A14.6 20.6 0 0 0 27.9 78.4C33.5 78.4 39.6 80.4 43.2 83.1";

/** 로고 위쪽 두 점. 왼쪽만 적고 오른쪽은 100에서 뺀다. */
const DOT = { cx: 28.8, cy: 18.8, r: 7.4 };

/** 획 한 짝. dir이 R이면 좌우 반전. */
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
 * 두 획이 "말하듯" 여닫으며 그려지다가 실제 로고 이미지로 자리를 넘긴다.
 * 색은 currentColor 하나로 정해진다 — 부모에서 color만 주면 된다.
 *
 * className은 **바깥 래퍼**(position:relative 컨테이너)에 붙는다 — 크기는
 * 거기서 정한다(HomeGate.module.css의 `.mark`). SVG와 실제 이미지는 그 안에서
 * inset:0으로 완전히 겹쳐 크로스페이드한다.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        /* 동작 줄이기에서 globals.css가 이 속성으로 잡아 아예 숨긴다 —
           애니메이션이 꺼지면 크로스페이드도 안 돌아 SVG·이미지가 나란히
           불투명하게 겹쳐 찍힌다(.hero__wp-parts가 같은 문제를 겪었다). */
        data-logo-draw
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible", // 획이 speak 변형으로 viewBox 밖까지 흔들린다
          color: "var(--ink)",
          // 말하는 동작이 잦아든 뒤(1.1s) 진짜 이미지에 자리를 넘긴다
          animation: "logoMarkOut 0.3s 1.1s ease both",
        }}
      >
        <LogoStroke dir="L" />
        <LogoStroke dir="R" />
        {/* 두 점은 로고의 일부다. 깜빡이거나 사라지지 않고 끝까지 보인다. */}
        <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="currentColor" />
        <circle cx={100 - DOT.cx} cy={DOT.cy} r={DOT.r} fill="currentColor" />
      </svg>
      <Image
        src="/hangyeol-mark-v2.png"
        alt=""
        fill
        sizes="(max-width: 767px) 40vw, 320px"
        priority
        style={{ animation: "logoMarkIn 0.3s 1.1s ease both" }}
      />
    </div>
  );
}
