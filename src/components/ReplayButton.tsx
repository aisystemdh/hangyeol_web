"use client";

/**
 * 히어로 인트로를 처음부터 다시 재생한다.
 * 원본은 섹션 ref에 getAnimations({subtree:true})를 걸었다 — 여기서는 id로 찾는다.
 */
export default function ReplayButton() {
  const replay = () => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    // 재방문이면 인트로 오버레이가 display:none이라 애니메이션이 아예 없다.
    // "다시 보기"는 인트로부터 보여주는 버튼이므로 숨김을 먼저 푼다.
    document.documentElement.removeAttribute("data-intro-seen");
    hero
      .getAnimations({ subtree: true })
      .forEach((a) => {
        a.cancel();
        a.play();
      });
  };

  return (
    <button type="button" className="hero__replay" onClick={replay}>
      다시 보기
    </button>
  );
}
