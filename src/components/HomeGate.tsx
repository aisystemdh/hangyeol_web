"use client";

import LogoMark from "./LogoMark";
import g from "./HomeGate.module.css";

/**
 * 게이트 — 사이트의 **첫 화면**(2026-08 10차, A안 §1-3).
 *
 * 로고 애니메이션만 재생하고 멈춘다. 「결국에는 / 결이더라 / 한결같이」 텍스트
 * 애니메이션은 여기서 나오지 않는다 — 그건 건너뛰기 경로의 히어로가 갖는다.
 *
 *   [로고]  단 1분으로 “나” 찾기   [시작] [건너뛰기]
 *      시작     → a1 (온보딩 세 질문)
 *      건너뛰기 → 히어로 애니메이션 → 페이지 본문
 *
 * ⚠️ 이 한 줄 외에 다른 설명을 넣지 말 것. 게이트는 **고르는 자리**라
 *    여기서 설명하면 두 버튼이 안 읽힌다. 브랜드 설명은 히어로(건너뛰기 경로)가 한다.
 * ⚠️ 두 버튼은 **같은 줄에 나란히** 둔다. 예전 건너뛰기는 좌상단에 떠 있는
 *    fixed 버튼이었는데(모바일에서 햄버거와 겹쳤다), 이제는 선택지 둘 중 하나다.
 * ⚠️ 시작이 왼쪽·강조, 건너뛰기가 오른쪽·약하게. 기본 경로는 온보딩이다.
 */
export default function HomeGate({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className={g.inner}>
      <LogoMark className={g.mark} />
      <p className={g.line}>단 1분으로 “나” 찾기</p>
      <div className={g.actions}>
        <button
          type="button"
          className={g.start}
          onClick={onStart}
          data-focus-target
        >
          시작
        </button>
        <button type="button" className={g.skip} onClick={onSkip}>
          건너뛰기
        </button>
      </div>
    </div>
  );
}
