"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import HomeGate from "./HomeGate";
import HomeHero from "./HomeHero";
import HomeDialog, { A1_LABEL, A2_TEXT, A3_LABEL } from "./HomeDialog";
import { track } from "@/lib/track";
import s from "./HomeStage.module.css";

/**
 * 홈 무대 — **게이트에서 갈리는 두 경로**를 한 화면에서 잇는 상태 머신 (10차, A안).
 *
 *          ┌─ 시작 ─▶ a1 ─▶ t1 ─▶ a2 ─▶ t2 ─▶ a3 ─▶ why ─▶ cmp ─▶ a4 ─▶ hub
 *   gate ──┤          행동   빚    이유   갈림   자리   겹침   분포   착지   허브
 *          │         01/03        02/03         03/03
 *          └─ 건너뛰기 ─▶ hero ─▶ (스크롤) 페이지 본문
 *                       결국에는 / 결이더라 / 한결같이
 *
 * ⭐ **게이트가 첫 화면이다.** 로고만 재생하고 멈춘 뒤 「시작 / 건너뛰기」를 준다.
 *    예전에는 히어로가 첫 화면이었고 건너뛰기는 좌상단에 뜬 fixed 버튼이었다 —
 *    지금은 둘이 같은 줄의 선택지이고, 건너뛴 사람도 **빈손으로 지나가지 않는다**
 *    (히어로 애니메이션을 보고 내려간다).
 *
 * ⭐ 사용자가 답을 세 번 고르고 그중 **두 번째가 「그 이유」**다. 이유가 별도
 *    화면이 아니라 질문이라 01/03 표기가 정직해진다. 문안·분기는 HomeDialog 참조.
 *
 * 전이 주체:
 *  - gate→a1 / gate→hero: 게이트 버튼. **자동 전이는 한 곳도 없다.**
 *    (9차까지 있던 intro→a1 자동 전이는 게이트가 생기며 사라졌다 — 그래서
 *     animationend 배선도, reduced-motion 전용 수동 진입 버튼도 필요 없어졌다.)
 *  - hero→a1: 히어로 하단 CTA. 건너뛴 사람에게 주는 **두 번째 기회**라 약하게 둔다.
 *  - a→t·why: 답 버튼. t·cmp·a4의 진행은 버튼만 — 자동 진행은 7차 소유자 결정으로 없다.
 *
 * ⚠️ 레이어는 전부 상시 마운트 + opacity/visibility + inert. 언마운트 금지
 *    (애니메이션 재생·스냅 높이 요동·SSR 콘텐츠 소실).
 * ⚠️ React는 html의 data-dialog-phase를 렌더에서 읽지 않는다(하이드레이션).
 *    복귀의 진실은 sessionStorage다 — html 속성은 전체 로드의 첫 페인트용
 *    보조일 뿐이다(SPA 뒤로가기는 인라인 스크립트가 안 돈다).
 */
export type Phase =
  | "gate"
  | "hero"
  | "a1"
  | "t1"
  | "a2"
  | "t2"
  | "a3"
  | "why"
  | "cmp"
  | "a4"
  | "hub";

/** 세션 복원 시 신뢰할 수 있는 값만 통과시킨다 (layout.tsx의 정규식과 짝).
    gate는 넣지 않는다 — 초기값이자 "처음부터 다시 보기"가 지운 상태다. */
const RESUMABLE: readonly Phase[] = [
  "hero",
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

/** 「다음 →」이 데려가는 곳. 게이트·히어로는 버튼이 직접 목적지를 정한다. */
const NEXT: Record<Phase, Phase | null> = {
  gate: null,
  hero: null,
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

/** 세 번의 선택. 코드값은 계측·문안 인덱스로 그대로 쓰이므로 바꾸지 말 것. */
export type A1 = "pass" | "say";
export type A2 = "minor" | "futile" | "accurate" | "future";
export type A3 = "tell" | "leave";
export type SimState = { a1: A1 | null; a2: A2 | null; a3: A3 | null };

const EMPTY_STATE: SimState = { a1: null, a2: null, a3: null };

/**
 * 저장된 답을 **화면에 그대로 되돌려주는** 레이어들.
 *
 * ⚠️ 여기 있는 phase는 답이 없으면 복원하면 안 된다. 레이어가 상시 마운트라
 *    답이 null이면 기본값(pass/minor/tell)으로 그려지는데, 그러면 a4가
 *    **남의 답을 자기 답처럼** 보여준다. 옛 포맷({answers, reason})이 남아 있는
 *    세션에서 실제로 그렇게 됐다 — 저장값을 버리고 게이트부터 다시 시작한다.
 */
const NEEDS_A1: readonly Phase[] = ["t1", "a2", "t2", "a3", "why", "cmp", "a4"];
const NEEDS_A2: readonly Phase[] = ["t2", "a3", "why", "cmp", "a4"];
const NEEDS_A3: readonly Phase[] = ["why", "a4"];

function restorable(phase: Phase, sim: SimState | null): boolean {
  if (NEEDS_A1.includes(phase) && !sim?.a1) return false;
  if (NEEDS_A2.includes(phase) && !sim?.a2) return false;
  if (NEEDS_A3.includes(phase) && !sim?.a3) return false;
  return true;
}

const A1_VALUES: readonly (A1 | null)[] = ["pass", "say", null];
const A2_VALUES: readonly (A2 | null)[] = [
  "minor",
  "futile",
  "accurate",
  "future",
  null,
];
const A3_VALUES: readonly (A3 | null)[] = ["tell", "leave", null];

/** 크로스페이드 길이 — 인라인 --xfade로 CSS에 주입해 진실을 한 곳에 둔다 */
const XFADE_MS = 500;

export default function HomeStage() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [sim, setSim] = useState<SimState>(EMPTY_STATE);
  const stageRef = useRef<HTMLDivElement>(null);
  /* 이벤트 핸들러가 최신 phase를 클로저 없이 읽기 위한 미러.
     렌더 중 대입은 금지라 이펙트에서 동기화한다 — 이벤트는 커밋 후에만 온다. */
  const phaseRef = useRef<Phase>("gate");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const layerEl = useCallback(
    (p: Phase) =>
      stageRef.current?.querySelector<HTMLElement>(`[data-layer="${p}"]`) ?? null,
    [],
  );

  /**
   * phase 전이. 새 레이어의 [data-focus-target]으로 포커스를 옮긴다 —
   * 전이는 **전부 사용자가 시킨 것**이라 포커스 이동이 곧 낭독이 된다
   * (자동 전이가 없으므로 WCAG 3.2.1 맥락 변화 문제도 없다).
   */
  const go = useCallback(
    (next: Phase) => {
      setPhase(next);
      requestAnimationFrame(() => {
        layerEl(next)
          ?.querySelector<HTMLElement>("[data-focus-target]")
          ?.focus({ preventScroll: true });
      });
    },
    [layerEl],
  );

  /* ── 게이트의 두 갈래 ─────────────────────────────────────
     여기서 갈린 비율이 곧 "온보딩을 할 의향"이다. 건너뛰기가 압도적이면
     게이트 한 줄(「한결의 대화 느껴보기」)이 약한 것이지 온보딩이 나쁜 게 아니다. */
  const startFromGate = useCallback(() => {
    track("gate_start");
    go("a1");
  }, [go]);

  const skipFromGate = useCallback(() => {
    track("gate_skip");
    go("hero");
  }, [go]);

  /** 히어로 하단 CTA — 건너뛴 사람에게 주는 두 번째 기회 */
  const startFromHero = useCallback(() => {
    track("hero_start");
    go("a1");
  }, [go]);

  /* ── 세 번의 답 ───────────────────────────────────────────
     어느 질문에서 이탈하는지 = 어느 훅이 안 먹히는지. 값은 **코드가 아니라 라벨**로
     싣는다 — 집계 화면에서 pass/say를 다시 해독하지 않아도 되게. */

  const onA1 = useCallback(
    (v: A1) => {
      track("q1_answer", { choice: A1_LABEL[v] });
      /* a1이 바뀌면 a2의 **보기 자체가 달라진다** — 이전 이유는 무효다.
         (되돌아가 답을 바꿨을 때 t2·cmp가 없는 보기를 가리키는 사고 방지) */
      setSim((prev) => ({ a1: v, a2: null, a3: prev.a3 }));
      go("t1");
    },
    [go],
  );

  /** ⭐ 이 사이트에서 가장 값나가는 한 줄. **같은 답을 고른 사람들의 이유 분포**가
      여기 쌓인다. 분포가 흩어져 있다는 것이 곧 "답이 같아도 이유는 다르다"가
      주장이 아니라 우리 데이터라는 뜻이고, 그대로 통계 콘텐츠의 원본 집계가 된다.
      쏠려 있으면 a2의 두 보기가 「즉각 ↔ 구조」로 안 갈린 것이다 — 문안을 고친다. */
  const onA2 = useCallback(
    (v: A2) => {
      track("q2_answer", { choice: A2_TEXT[v], after: A1_LABEL[sim.a1 ?? "pass"] });
      setSim((prev) => ({ ...prev, a2: v }));
      go("t2");
    },
    [go, sim.a1],
  );

  const onA3 = useCallback(
    (v: A3) => {
      track("q3_answer", { choice: A3_LABEL[v] });
      setSim((prev) => ({ ...prev, a3: v }));
      go("why");
    },
    [go],
  );

  const next = useCallback(() => {
    const to = NEXT[phaseRef.current];
    if (to) go(to);
  }, [go]);

  /**
   * "← 이전 질문으로". **뒤 상태를 반드시 지운다** — a1을 바꾸면 a2의 보기가
   * 통째로 갈리고, a3를 그대로 두면 why의 겹침이 옛 조합으로 남는다.
   */
  const goToQuestion = useCallback(
    (n: number) => {
      setSim((prev) =>
        n <= 1 ? EMPTY_STATE : { a1: prev.a1, a2: null, a3: null },
      );
      go(`a${n}` as Phase);
    },
    [go],
  );

  const restartQuestions = useCallback(() => {
    setSim(EMPTY_STATE);
    go("a1");
  }, [go]);

  /** "처음부터 다시 보기" — 게이트로 되돌리고 로고를 다시 그린다 */
  const replayFromGate = useCallback(() => {
    // 처음부터 다시 = 진행 기록도 초기화 (남겨두면 이탈 후 재방문이 옛 화면으로 감)
    try {
      sessionStorage.removeItem("dialog-phase");
      sessionStorage.removeItem("dialog-chosen");
    } catch {
      /* 접근 불가 시 무시 */
    }
    setSim(EMPTY_STATE);
    // 게이트 레이어가 DOM상 활성이 된 **뒤에** 애니메이션을 되감아야 한다
    flushSync(() => setPhase("gate"));
    layerEl("gate")
      ?.getAnimations({ subtree: true })
      .forEach((a) => {
        a.cancel();
        a.play();
      });
  }, [layerEl]);

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
        /* 옛 포맷({answers, reason} — 9차)은 여기서 통째로 걸러진다.
           키가 하나라도 안 맞으면 버리고 처음부터 시작한다. */
        if (
          typeof p === "object" &&
          p !== null &&
          A1_VALUES.includes((p as SimState).a1) &&
          A2_VALUES.includes((p as SimState).a2) &&
          A3_VALUES.includes((p as SimState).a3)
        ) {
          savedSim = p as SimState;
        }
      }
    } catch {
      /* 접근 불가·손상 시 무시 — 처음부터 시작한다 */
    }
    if (saved && RESUMABLE.includes(saved) && restorable(saved, savedSim)) {
      pendingAttrCleanup.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 시스템(sessionStorage)과의 1회 동기화. 조건부라 연쇄 렌더 없음.
      setPhase(saved);
      if (savedSim) setSim(savedSim);
    } else {
      /* 복원을 포기했다 = 저장값이 못 믿을 것이다. CSS 핀을 풀고 저장값도 버린다 —
         남겨 두면 다음 이동 때 같은 판정을 되풀이하고, 그동안 CSS 핀이 첫 페인트에
         엉뚱한 레이어를 한 번 보여준다. */
      document.documentElement.removeAttribute("data-dialog-phase");
      try {
        sessionStorage.removeItem("dialog-phase");
        sessionStorage.removeItem("dialog-chosen");
      } catch {
        /* 접근 불가 시 무시 */
      }
    }
  }, []);
  /* 복원 phase가 커밋·페인트된 **뒤에** 속성을 걷는다 — 먼저 걷으면 전체 로드
     경로에서 CSS 핀이 풀린 채 React가 아직 gate라 게이트가 한 프레임 비친다. */
  useEffect(() => {
    if (!pendingAttrCleanup.current || phase === "gate") return;
    pendingAttrCleanup.current = false;
    document.documentElement.removeAttribute("data-dialog-phase");
  }, [phase]);

  /* 진행 저장 — 서브페이지(허브 링크·신청 페이지)를 다녀와도 보던 화면으로 복귀한다.
     gate는 저장하지 않는다(초기값이자, "처음부터"가 지운 상태를 유지해야 하므로). */
  useEffect(() => {
    if (phase === "gate") return;
    try {
      sessionStorage.setItem("dialog-phase", phase);
      sessionStorage.setItem("dialog-chosen", JSON.stringify(sim));
    } catch {
      /* 프라이빗 모드 등 접근 불가 시 무시 */
    }
  }, [phase, sim]);

  /* 허브 도달 = 체험을 끝까지 본 사람. 세션당 한 번만 센다 —
     서브페이지에 다녀오면 복원 이펙트가 phase를 hub로 되돌리는데,
     그때마다 세면 "끝까지 본 사람"이 부풀어 전환율이 거짓이 된다. */
  useEffect(() => {
    if (phase !== "hub") return;
    try {
      if (sessionStorage.getItem("hub-tracked")) return;
      sessionStorage.setItem("hub-tracked", "1");
    } catch {
      /* 프라이빗 모드 등 접근 불가 시 중복을 감수하고 보낸다 */
    }
    track("hub_reached");
  }, [phase]);

  return (
    <div
      ref={stageRef}
      className={s.stage}
      data-stage
      style={{ "--xfade": `${XFADE_MS}ms` } as React.CSSProperties}
    >
      {/* 나무결 베일 — 게이트·히어로·다이얼로그가 함께 쓰므로 무대가 한 장 깐다 */}
      <div className={s.veil} aria-hidden="true" />

      {/* ── 게이트 — 첫 화면. 로고 한 벌과 두 버튼뿐이다 ────────── */}
      <section
        className={s.layer}
        data-layer="gate"
        data-active={phase === "gate"}
        inert={phase !== "gate"}
        aria-label="한결 시작"
      >
        <HomeGate onStart={startFromGate} onSkip={skipFromGate} />
      </section>

      {/* ── 히어로 — **건너뛰기 경로 전용**. 브랜드 애니메이션이 여기 있다 ── */}
      <div
        className={`${s.layer} ${s.layerHero}`}
        data-layer="hero"
        data-active={phase === "hero"}
        inert={phase !== "hero"}
      >
        <HomeHero onStart={startFromHero} />
      </div>

      <HomeDialog
        phase={phase}
        sim={sim}
        onA1={onA1}
        onA2={onA2}
        onA3={onA3}
        onNext={next}
        onPrev={goToQuestion}
        onRestart={restartQuestions}
        onReplay={replayFromGate}
      />
    </div>
  );
}
