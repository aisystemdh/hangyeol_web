"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import HomeHero from "./HomeHero";
import HomeDialog, { STEPS } from "./HomeDialog";
import s from "./HomeStage.module.css";

/**
 * 홈 무대 — 히어로 인트로와 대화형 질문 시퀀스를 **한 화면**에서 잇는 상태 머신.
 *
 *   intro → q1 → r1 → q2 → r2 → q3 → r3 → hub
 *
 * 전이 주체:
 *  - intro→q1: 인트로 마지막 애니메이션(ulIn, 4.5s)의 animationend + 700ms 여유.
 *    setTimeout(고정 시각)을 쓰지 않는 이유 — 건너뛰기(finish())도 animationend를
 *    발화시키므로 스킵과 자동으로 동기화되고, 타임라인의 진실이 CSS 한 곳에 남는다.
 *  - q→r: 답 버튼 클릭. r→다음 q: **"다음 질문" 버튼만** — 자동 진행은 7차에서
 *    소유자 결정으로 제거했다(읽는 속도를 강제하지 않는다). 되살리지 말 것.
 *  - hub→q1(질문 다시 보기) / hub→intro(처음부터 다시 보기 — 옛 ReplayButton 흡수).
 *
 * ⚠️ 레이어는 **전부 상시 마운트**하고 opacity/visibility + inert로만 토글한다.
 *    언마운트하면 ① CSS animation-delay가 마운트 기준이라 인트로가 재생되고
 *    ② 무대 높이가 요동쳐 스냅 지점이 흔들리고 ③ SSR HTML에서 콘텐츠가 사라진다.
 *
 * ⚠️ React는 html의 data-intro-seen / data-dialog-phase를 **렌더에서 읽지 않는다**
 *    (첫 페인트 전 인라인 스크립트가 붙이는 속성이라 서버 HTML과 다르다 —
 *    읽는 순간 하이드레이션이 어긋난다). 초기 phase는 항상 "intro"이고,
 *    복귀 화면은 CSS(html[data-dialog-phase] 규칙)가 먼저 만들며, 마운트 후
 *    이펙트가 상태를 따라잡고 속성을 걷어 React에 제어를 넘긴다.
 *
 * 진행 상태는 phase가 바뀔 때마다 세션에 기록한다 — 질문 도중 "왜 가치관인가 보기"
 * 같은 링크로 서브페이지에 다녀와도 **보던 화면 그대로** 돌아오기 위해서다
 * (소유자 요구). 답 선택(chosen)도 함께 저장해 반응 멘트가 유지된다.
 */
export type Phase = "intro" | "q1" | "r1" | "q2" | "r2" | "q3" | "r3" | "hub";

/** 세션 복원 시 신뢰할 수 있는 값만 통과시킨다 (layout.tsx의 정규식과 짝) */
const RESUMABLE: readonly Phase[] = ["q1", "r1", "q2", "r2", "q3", "r3", "hub"];

const NEXT: Record<Phase, Phase | null> = {
  intro: "q1",
  q1: "r1",
  r1: "q2",
  q2: "r2",
  r2: "q3",
  q3: "r3",
  r3: "hub",
  hub: null,
};

/** 크로스페이드 길이 — 인라인 --xfade로 CSS에 주입해 진실을 한 곳에 둔다 */
const XFADE_MS = 500;
/** 인트로 종료(ulIn) 후 질문까지의 숨 고르기 */
const INTRO_TO_Q1_MS = 700;

export default function HomeStage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [chosen, setChosen] = useState<(0 | 1 | null)[]>([null, null, null]);
  const [liveText, setLiveText] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 이벤트 핸들러(animationend·클릭)가 최신 phase를 클로저 없이 읽기 위한 미러.
     렌더 중 대입은 금지라 이펙트에서 동기화한다 — 이벤트는 커밋 후에만 오므로 안전하다. */
  const phaseRef = useRef<Phase>("intro");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const layerEl = useCallback(
    (p: Phase) =>
      stageRef.current?.querySelector<HTMLElement>(`[data-layer="${p}"]`) ?? null,
    [],
  );

  /**
   * phase 전이. 사용자가 시킨 전이(focus)만 새 레이어의 [data-focus-target]으로
   * 포커스를 옮긴다 — 자동 전이가 포커스를 훔치면 맥락 변화(WCAG 3.2.1)가 된다.
   * 자동 전이는 대신 live region으로 알린다. 예외: 포커스가 사라지는 레이어 안에
   * 있었으면 유실 방지를 위해 옮긴다.
   */
  const go = useCallback(
    (next: Phase, opts: { focus?: boolean; auto?: boolean } = {}) => {
      clearTimer();
      const outgoing = layerEl(phaseRef.current);
      const wasInside = !!outgoing?.contains(document.activeElement);
      setPhase(next);
      if (opts.focus || wasInside) {
        requestAnimationFrame(() => {
          layerEl(next)
            ?.querySelector<HTMLElement>("[data-focus-target]")
            ?.focus({ preventScroll: true });
        });
      } else if (opts.auto) {
        const n = Number(next.slice(1));
        const step = STEPS[n - 1];
        if (next.startsWith("q") && step) {
          setLiveText(`질문 ${n}. ${step.question.join(" ")}`);
        }
      }
    },
    [clearTimer, layerEl],
  );

  /** 인트로 끝 감지 — 스킵의 일괄 finish()가 이벤트를 폭주시키므로 이름·phase 가드 필수 */
  const handleAnimationEnd = useCallback(
    (e: React.AnimationEvent) => {
      if (phaseRef.current !== "intro" || e.animationName !== "ulIn") return;
      // ulIn은 '결'·'같이' 두 요소에서 발화 — 두 번째가 타이머를 리셋해도 결과 동일
      clearTimer();
      timerRef.current = setTimeout(() => go("q1", { auto: true }), INTRO_TO_Q1_MS);
    },
    [clearTimer, go],
  );

  const answer = useCallback(
    (stepIndex: number, choice: 0 | 1) => {
      setChosen((prev) => {
        const nextArr = [...prev];
        nextArr[stepIndex] = choice;
        return nextArr;
      });
      go(`r${stepIndex + 1}` as Phase, { focus: true });
    },
    [go],
  );

  const next = useCallback(() => {
    const to = NEXT[phaseRef.current];
    if (to) go(to, { focus: true });
  }, [go]);

  /** "이전 질문으로" — q2→q1, q3→q2. 답을 다시 누르면 chosen이 덮어써진다. */
  const goToQuestion = useCallback(
    (n: number) => {
      go(`q${n}` as Phase, { focus: true });
    },
    [go],
  );

  const restartQuestions = useCallback(() => {
    setChosen([null, null, null]);
    go("q1", { focus: true });
  }, [go]);

  const replayIntro = useCallback(() => {
    clearTimer();
    document.documentElement.removeAttribute("data-intro-seen");
    // 처음부터 다시 = 진행 기록도 초기화 (남겨두면 이탈 후 재방문이 옛 질문으로 감)
    try {
      sessionStorage.removeItem("dialog-phase");
      sessionStorage.removeItem("dialog-chosen");
    } catch {
      /* 접근 불가 시 무시 */
    }
    setChosen([null, null, null]);
    // 히어로 레이어가 DOM상 활성이 된 **뒤에** 애니메이션을 되감아야 한다
    flushSync(() => setPhase("intro"));
    document
      .getElementById("hero")
      ?.getAnimations({ subtree: true })
      .forEach((a) => {
        a.cancel();
        a.play();
      });
  }, [clearTimer]);

  /* (반응 화면 자동 진행은 7차에서 제거 — 진행은 "다음 질문" 버튼만.
     자동 타이머·일시정지 장치가 다시 필요해지면 git 이력의 6.5차 구현을 볼 것.) */

  /* 복귀 동기화 — ⚠️ 진실은 **sessionStorage**다, html 속성이 아니다.
     속성은 layout.tsx의 인라인 스크립트가 **문서 로드 때만** 붙이는 첫 페인트용
     보조 장치라, 서브페이지에서 뒤로가기(SPA 내비게이션 — 문서 재로드 없음)로
     돌아오면 속성이 없다. 속성만 읽으면 그 경로에서 복원이 통째로 빠진다
     (실측으로 확인된 함정). 여기서 storage를 직접 읽어 상태를 따라잡는다.
     ⚠️ flushSync 금지 — 하이드레이션 중 이펙트에서 부르면 React가 경고한다.
        속성 제거는 아래 별도 이펙트가 "복원 phase가 커밋된 뒤"에 한다. */
  const pendingAttrCleanup = useRef(false);
  useEffect(() => {
    let saved: Phase | null = null;
    try {
      saved = sessionStorage.getItem("dialog-phase") as Phase | null;
    } catch {
      /* 접근 불가 시 복원 생략 */
    }
    if (saved && RESUMABLE.includes(saved)) {
      let savedChosen: (0 | 1 | null)[] | null = null;
      try {
        const raw = sessionStorage.getItem("dialog-chosen");
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (
            Array.isArray(parsed) &&
            parsed.length === 3 &&
            parsed.every((v) => v === 0 || v === 1 || v === null)
          ) {
            savedChosen = parsed as (0 | 1 | null)[];
          }
        }
      } catch {
        /* 접근 불가·손상 시 무시 — 반응 멘트만 기본값이 된다 */
      }
      pendingAttrCleanup.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 시스템(sessionStorage)과의 1회 동기화. 조건부라 연쇄 렌더 없음.
      setPhase(saved);
      if (savedChosen) setChosen(savedChosen);
    } else {
      // 복원할 게 없으면 (혹시 남은) 속성만 걷는다
      document.documentElement.removeAttribute("data-dialog-phase");
    }
  }, []);
  /* 복원 phase가 화면에 커밋·페인트된 **뒤에** 속성을 걷는다 — 먼저 걷으면
     전체 로드 경로에서 CSS 핀이 풀린 채 React가 아직 intro라 히어로가 한 프레임 비친다. */
  useEffect(() => {
    if (!pendingAttrCleanup.current || phase === "intro") return;
    pendingAttrCleanup.current = false;
    document.documentElement.removeAttribute("data-dialog-phase");
  }, [phase]);

  /* 진행 저장 — phase가 바뀔 때마다 기록한다. 질문 도중 카드 링크로 서브페이지에
     다녀와도 보던 화면으로 돌아오기 위해서다. intro는 저장하지 않는다(초기값이자,
     "처음부터 다시 보기"가 기록을 지운 상태를 유지해야 하므로). */
  useEffect(() => {
    if (phase === "intro") return;
    try {
      sessionStorage.setItem("dialog-phase", phase);
      sessionStorage.setItem("dialog-chosen", JSON.stringify(chosen));
    } catch {
      /* 프라이빗 모드 등 접근 불가 시 무시 */
    }
  }, [phase, chosen]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <div
      ref={stageRef}
      className={s.stage}
      data-stage
      onAnimationEnd={handleAnimationEnd}
      style={{ "--xfade": `${XFADE_MS}ms` } as React.CSSProperties}
    >
      {/* 나무결 베일 — 히어로·다이얼로그가 함께 쓰므로 무대가 한 장 깐다 */}
      <div className={s.veil} aria-hidden="true" />

      <div
        className={`${s.layer} ${s.layerHero}`}
        data-layer="intro"
        data-active={phase === "intro"}
        inert={phase !== "intro"}
      >
        <HomeHero />
        {/* reduced-motion에서는 인트로 애니메이션이 전부 꺼져 animationend가 오지
            않는다 → CSS로만 보이는 수동 진입 버튼. JS matchMedia 조건부 렌더는
            하이드레이션이 어긋나므로 금지. */}
        <button
          type="button"
          className={s.startBtn}
          onClick={() => go("q1", { focus: true })}
        >
          대화 시작하기
        </button>
      </div>

      <HomeDialog
        phase={phase}
        chosen={chosen}
        onAnswer={answer}
        onNext={next}
        onPrev={goToQuestion}
        onRestart={restartQuestions}
        onReplay={replayIntro}
      />

      {/* 자동 전이 전용 알림 — 클릭 전이는 포커스 이동이 낭독을 담당하므로 침묵 */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
    </div>
  );
}
