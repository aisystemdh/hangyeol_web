"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import HomeHero from "./HomeHero";
import HomeDialog, { SIM } from "./HomeDialog";
import s from "./HomeStage.module.css";

/**
 * 홈 무대 — 히어로 인트로와 **체험형 시퀀스**(9차, A안)를 한 화면에서 잇는 상태 머신.
 *
 *   intro → a1 → t1 → a2 → t2 → a3 → why → cmp → a4 → hub
 *          질문1 되돌림 질문2 되돌림 질문3 이유3택 같은답 착지   (기존 허브)
 *
 * 사용자가 가치 2지선다에 답하고, 마지막 질문에서는 **이유까지 고른다** —
 * 원칙 1("답보다 이유를 묻는다")을 설명이 아니라 동작으로 보여주는 구조다.
 * 질문·이유의 근거는 볼트 사전질문 10주제, 숫자(10명·9분)는 event.ts에서 온다.
 *
 * 전이 주체:
 *  - intro→a1: 인트로 마지막 애니메이션(ulIn, 4.5s)의 animationend + 700ms 여유.
 *    setTimeout(고정 시각) 금지 — 건너뛰기(finish())도 animationend를 발화시키므로
 *    스킵과 자동 동기화되고, 타임라인의 진실이 CSS 한 곳에 남는다.
 *  - a→t/why: 답 버튼 클릭. why→cmp: 이유 버튼 클릭.
 *  - t·cmp·a4의 진행은 **버튼만** — 자동 진행은 7차 소유자 결정으로 없다.
 *
 * ⚠️ 레이어는 전부 상시 마운트 + opacity/visibility + inert. 언마운트 금지
 *    (인트로 재생·스냅 높이 요동·SSR 콘텐츠 소실).
 * ⚠️ React는 html의 data-intro-seen / data-dialog-phase를 렌더에서 읽지 않는다
 *    (하이드레이션). 복귀의 진실은 sessionStorage다 — html 속성은 전체 로드의
 *    첫 페인트용 보조일 뿐이다(SPA 뒤로가기는 인라인 스크립트가 안 돈다).
 */
export type Phase =
  | "intro"
  | "a1"
  | "t1"
  | "a2"
  | "t2"
  | "a3"
  | "why"
  | "cmp"
  | "a4"
  | "hub";

/** 세션 복원 시 신뢰할 수 있는 값만 통과시킨다 (layout.tsx의 정규식과 짝) */
const RESUMABLE: readonly Phase[] = [
  "a1",
  "t1",
  "a2",
  "t2",
  "a3",
  "why",
  "cmp",
  "a4",
  "hub",
];

const NEXT: Record<Phase, Phase | null> = {
  intro: "a1",
  a1: "t1",
  t1: "a2",
  a2: "t2",
  t2: "a3",
  a3: "why",
  why: "cmp",
  cmp: "a4",
  a4: "hub",
  hub: null,
};

/** 답·이유 선택 상태. answers는 a1·a2·a3, reason은 a3의 이유(0~2). */
export type SimState = {
  answers: (0 | 1 | null)[];
  reason: 0 | 1 | 2 | null;
};
const EMPTY_STATE: SimState = { answers: [null, null, null], reason: null };

/** 크로스페이드 길이 — 인라인 --xfade로 CSS에 주입해 진실을 한 곳에 둔다 */
const XFADE_MS = 500;
/** 인트로 종료(ulIn) 후 첫 질문까지의 숨 고르기 */
const INTRO_TO_Q1_MS = 700;

export default function HomeStage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sim, setSim] = useState<SimState>(EMPTY_STATE);
  const [liveText, setLiveText] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 이벤트 핸들러가 최신 phase를 클로저 없이 읽기 위한 미러.
     렌더 중 대입은 금지라 이펙트에서 동기화한다 — 이벤트는 커밋 후에만 온다. */
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
   * 자동 전이(intro→a1뿐)는 live region으로 알린다. 예외: 포커스가 사라지는
   * 레이어 안에 있었으면 유실 방지를 위해 옮긴다.
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
      } else if (opts.auto && next === "a1") {
        setLiveText(`질문 1. ${SIM.steps[0].situation.join(" ")}`);
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
      timerRef.current = setTimeout(() => go("a1", { auto: true }), INTRO_TO_Q1_MS);
    },
    [clearTimer, go],
  );

  /** 답 선택: a1·a2는 되돌림으로, a3는 이유 선택(why)으로 */
  const answer = useCallback(
    (stepIndex: number, choice: 0 | 1) => {
      setSim((prev) => {
        const answers = [...prev.answers];
        answers[stepIndex] = choice;
        // a3의 답을 바꾸면 이전에 고른 이유는 무효다
        return { answers, reason: stepIndex === 2 ? null : prev.reason };
      });
      go(stepIndex < 2 ? (`t${stepIndex + 1}` as Phase) : "why", { focus: true });
    },
    [go],
  );

  /** 이유 선택(a3 전용) → 같은 답·다른 이유 비교 화면 */
  const chooseReason = useCallback(
    (r: 0 | 1 | 2) => {
      setSim((prev) => ({ ...prev, reason: r }));
      go("cmp", { focus: true });
    },
    [go],
  );

  const next = useCallback(() => {
    const to = NEXT[phaseRef.current];
    if (to) go(to, { focus: true });
  }, [go]);

  /** "이전 질문으로"·"답 다시 고르기" — 1-기반 질문 번호(a1~a3)로 되돌린다 */
  const goToQuestion = useCallback(
    (n: number) => {
      go(`a${n}` as Phase, { focus: true });
    },
    [go],
  );

  const restartQuestions = useCallback(() => {
    setSim(EMPTY_STATE);
    go("a1", { focus: true });
  }, [go]);

  const replayIntro = useCallback(() => {
    clearTimer();
    document.documentElement.removeAttribute("data-intro-seen");
    // 처음부터 다시 = 진행 기록도 초기화 (남겨두면 이탈 후 재방문이 옛 화면으로 감)
    try {
      sessionStorage.removeItem("dialog-phase");
      sessionStorage.removeItem("dialog-chosen");
    } catch {
      /* 접근 불가 시 무시 */
    }
    setSim(EMPTY_STATE);
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

  /* 복귀 동기화 — 진실은 sessionStorage. 첫 페인트는 CSS(html[data-dialog-phase])가
     담당하고, 여기서 상태가 따라잡은 뒤(커밋 후) 속성을 걷어 React에 제어를 넘긴다.
     flushSync 금지(하이드레이션 중 경고) — 속성 제거는 아래 별도 이펙트가 한다. */
  const pendingAttrCleanup = useRef(false);
  useEffect(() => {
    let saved: Phase | null = null;
    let savedSim: SimState | null = null;
    try {
      saved = sessionStorage.getItem("dialog-phase") as Phase | null;
      const raw = sessionStorage.getItem("dialog-chosen");
      if (raw) {
        const p: unknown = JSON.parse(raw);
        if (
          typeof p === "object" &&
          p !== null &&
          Array.isArray((p as SimState).answers) &&
          (p as SimState).answers.length === 3 &&
          (p as SimState).answers.every((v) => v === 0 || v === 1 || v === null) &&
          [0, 1, 2, null].includes((p as SimState).reason)
        ) {
          savedSim = p as SimState;
        }
      }
    } catch {
      /* 접근 불가·손상(옛 포맷 포함) 시 무시 — 처음부터 시작한다 */
    }
    if (saved && RESUMABLE.includes(saved)) {
      pendingAttrCleanup.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 시스템(sessionStorage)과의 1회 동기화. 조건부라 연쇄 렌더 없음.
      setPhase(saved);
      if (savedSim) setSim(savedSim);
    } else {
      document.documentElement.removeAttribute("data-dialog-phase");
    }
  }, []);
  /* 복원 phase가 커밋·페인트된 **뒤에** 속성을 걷는다 — 먼저 걷으면 전체 로드
     경로에서 CSS 핀이 풀린 채 React가 아직 intro라 히어로가 한 프레임 비친다. */
  useEffect(() => {
    if (!pendingAttrCleanup.current || phase === "intro") return;
    pendingAttrCleanup.current = false;
    document.documentElement.removeAttribute("data-dialog-phase");
  }, [phase]);

  /* 진행 저장 — 서브페이지(카드 링크·뒤로가기)를 다녀와도 보던 화면으로 복귀한다.
     intro는 저장하지 않는다(초기값이자, "처음부터"가 지운 상태를 유지해야 하므로). */
  useEffect(() => {
    if (phase === "intro") return;
    try {
      sessionStorage.setItem("dialog-phase", phase);
      sessionStorage.setItem("dialog-chosen", JSON.stringify(sim));
    } catch {
      /* 프라이빗 모드 등 접근 불가 시 무시 */
    }
  }, [phase, sim]);

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
          onClick={() => go("a1", { focus: true })}
        >
          대화 시작하기
        </button>
      </div>

      <HomeDialog
        phase={phase}
        sim={sim}
        onAnswer={answer}
        onReason={chooseReason}
        onNext={next}
        onPrev={goToQuestion}
        onRestart={restartQuestions}
        onReplay={replayIntro}
      />

      {/* 자동 전이(intro→a1) 전용 알림 — 클릭 전이는 포커스 이동이 낭독을 담당 */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
    </div>
  );
}
