"use client";

/**
 * 인트로(9초대 시퀀스)를 처음 보는 방문자도 즉시 건너뛸 수 있게 한다.
 * ReplayButton과 마찬가지로 상태 없이 DOM을 직접 다룬다 — 언제 사라지는지는
 * CSS 애니메이션(heroSkipOut, globals.css)이 맡고, 클릭 시 즉시 사라지는 것은
 * data-intro-seen 속성에 걸린 CSS 규칙(html[data-intro-seen] .hero__skip)이 맡는다.
 */
export default function SkipIntroButton() {
  const skip = () => {
    const hero = document.getElementById("hero");
    hero?.getAnimations({ subtree: true }).forEach((a) => {
      /* ⚠️ finish()는 무한 반복 애니메이션에 InvalidStateError를 던진다.
         무대(HomeStage)의 스크롤 힌트처럼 infinite인 것은 건너뛴다. */
      if (a.effect?.getTiming().iterations === Infinity) return;
      a.finish();
    });
    document.documentElement.setAttribute("data-intro-seen", "");
    try {
      sessionStorage.setItem("intro-seen", "1");
    } catch {
      /* 프라이빗 모드 등 sessionStorage 접근 불가 시 무시 */
    }
  };

  return (
    <button type="button" className="hero__skip" onClick={skip}>
      건너뛰기
    </button>
  );
}
