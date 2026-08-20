"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT } from "@/lib/event";
import { EVENT_HREF, EVENT_CTA_LABEL, NAV, SITE } from "@/lib/site";
import type { Phase, SimState } from "./HomeStage";
import d from "./HomeDialog.module.css";

/** 타이핑 시작 전 여유 — 앞 문장이 먼저 읽히게 한다 */
const TYPE_DELAY_MS = 600;
/** 글자당 간격 */
const TYPE_TICK_MS = 45;

/**
 * 한 글자씩 써 내려가는 연출.
 * - active가 꺼지면 리셋된다 — 되돌아왔다 다시 오면 또 써진다.
 * - 시각 타이핑은 aria-hidden이고 전문은 부모의 sr-only가 즉시 제공한다.
 * - prefers-reduced-motion: 타이핑 없이 전문 즉시 표시.
 */
function Typewriter({ text, active }: { text: string; active: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 레이어 비활성화에 맞춘 1회 리셋(연쇄 렌더 없음). 재진입 시 다시 타이핑되게 한다.
      setCount(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
    let interval: ReturnType<typeof setInterval> | null = null;
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            if (interval) clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, TYPE_TICK_MS);
    }, TYPE_DELAY_MS);
    return () => {
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [active, text]);

  const done = count >= text.length;
  return (
    <span aria-hidden="true">
      {text.slice(0, count)}
      <span className={`${d.caret} ${done ? d.caretDone : ""}`} />
    </span>
  );
}

/**
 * 체험형 시나리오 데이터 — 세트 A "감정의 거리" (9차 소유자 확정).
 *
 * 사용자가 실제 모임처럼 가치 2지선다에 답하고, 마지막 질문에서는 **이유까지
 * 고른다**. 원칙 1("답보다 이유를 묻는다")을 동작으로 보여주는 구조라,
 * 질문을 바꿀 때도 **3번 질문의 이유 3택 구조는 유지**할 것.
 *
 * 질문의 근거는 볼트 사전질문 10주제(갈등 해결·감정 표현·자기소개).
 * 교체용 세트 B~E(돈과 시간/관계의 속도/계획과 즉흥/말과 마음)는 9차 플랜 파일에 있다.
 * 카피 규칙: 존댓말 · 업종/상품명 금지 · "로테이션" 등 내부 용어 금지 ·
 * 수치를 지어내지 않는다(비교 화면은 이유 나열까지만).
 */
export const SIM = {
  steps: [
    {
      situation: ["친구와 크게 어긋났습니다.", "며칠이 지났습니다."],
      options: [
        { text: "내가 먼저 연락한다", label: "내가 먼저" },
        { text: "상대가 연락할 때까지 둔다", label: "기다린다" },
      ],
    },
    {
      situation: ["이야기하다", "생각이 갈렸습니다."],
      options: [
        { text: "왜 그렇게 생각하는지 더 묻는다", label: "더 묻는다" },
        { text: "서로 다른 걸로 두고 넘어간다", label: "그냥 둔다" },
      ],
    },
    {
      situation: ["나를 소개해야 합니다.", "한 가지만 말할 수 있다면?"],
      options: [
        { text: "무슨 일을 하는지", label: "하는 일" },
        { text: "요즘 무슨 생각을 하는지", label: "요즘 생각" },
      ],
    },
  ],
  /** a1·a2 뒤의 짧은 되돌림 — 판정하지 않는다. 둘째 줄이 타자기로 써진다. */
  reflections: [
    { plain: "그러시군요.", typed: "왜 그러시는지는 아직 안 여쭤봤습니다." },
    { plain: "이것도 그러시군요.", typed: "한 번만 더 여쭤볼게요." },
  ],
  /** a3의 답별 이유 3택 — 같은 답이라도 이유가 갈린다는 것을 보여주는 핵심 */
  reasons: [
    [
      "설명이 제일 빠르니까",
      "거기에 시간을 제일 많이 썼으니까",
      "나머지는 아직 말하기 이르니까",
    ],
    [
      "직업으로 판단당하는 게 싫어서",
      "요즘 생각이 지금의 나에 더 가까워서",
      "그쪽이 대화가 이어지니까",
    ],
  ],
} as const;

type Props = {
  phase: Phase;
  sim: SimState;
  onAnswer: (stepIndex: number, choice: 0 | 1) => void;
  onReason: (reason: 0 | 1 | 2) => void;
  onNext: () => void;
  /** "이전 질문으로"·"답 다시 고르기" — 1-기반 질문 번호 */
  onPrev: (questionNumber: number) => void;
  onRestart: () => void;
  onReplay: () => void;
};

export default function HomeDialog({
  phase,
  sim,
  onAnswer,
  onReason,
  onNext,
  onPrev,
  onRestart,
  onReplay,
}: Props) {
  const a3choice = sim.answers[2] ?? 0;
  const a3reasons = SIM.reasons[a3choice];

  return (
    <>
      {/* ── 질문 a1·a2·a3 ── */}
      {SIM.steps.map((step, i) => {
        const n = i + 1;
        const p: Phase = `a${n}` as Phase;
        return (
          <section
            key={p}
            className={d.layer}
            data-layer={p}
            data-active={phase === p}
            inert={phase !== p}
            aria-labelledby={`dlg-${p}`}
          >
            <div className={d.inner}>
              <p className={d.counter} style={{ "--i": 0 } as React.CSSProperties}>
                <span aria-hidden="true">
                  0{n} <span className={d.counterOf}>/ 03</span>
                </span>
                <span className="sr-only">{`질문 ${n}, 총 3개`}</span>
              </p>
              <h2
                className={d.q}
                id={`dlg-${p}`}
                data-focus-target
                tabIndex={-1}
                style={{ "--i": 1 } as React.CSSProperties}
              >
                {step.situation[0]}
                <br />
                {step.situation[1]}
              </h2>
              {/* 보기는 문장 전체를 보여준다 — 짧은 라벨은 리캡(a4)에서만 쓴다 */}
              <div
                className={d.answerCol}
                role="group"
                aria-labelledby={`dlg-${p}`}
                style={{ "--i": 2 } as React.CSSProperties}
              >
                <button type="button" className={d.answerBtn} onClick={() => onAnswer(i, 0)}>
                  {step.options[0].text}
                </button>
                <button type="button" className={d.answerBtn} onClick={() => onAnswer(i, 1)}>
                  {step.options[1].text}
                </button>
              </div>
              {i > 0 && (
                <button
                  type="button"
                  className={d.prevBtn}
                  onClick={() => onPrev(i)}
                  style={{ "--i": 3 } as React.CSSProperties}
                >
                  ← 이전 질문으로
                </button>
              )}
            </div>
          </section>
        );
      })}

      {/* ── 되돌림 t1·t2 — 판정 없이 한 박자 ── */}
      {SIM.reflections.map((ref, i) => {
        const p: Phase = `t${i + 1}` as Phase;
        return (
          <section
            key={p}
            className={d.layer}
            data-layer={p}
            data-active={phase === p}
            inert={phase !== p}
            aria-label="한결의 되돌림"
          >
            <div className={d.inner}>
              <p
                className={d.reaction}
                data-focus-target
                tabIndex={-1}
                style={{ "--i": 0 } as React.CSSProperties}
              >
                {ref.plain}
              </p>
              <p className={d.typedLine} style={{ "--i": 1 } as React.CSSProperties}>
                <span className="sr-only">{ref.typed}</span>
                <Typewriter text={ref.typed} active={phase === p} />
              </p>
              <button
                type="button"
                className={d.nextBtn}
                onClick={onNext}
                style={{ "--i": 2 } as React.CSSProperties}
              >
                다음 질문 →
              </button>
            </div>
          </section>
        );
      })}

      {/* ── why — 답을 고른 뒤, 이유를 고른다 (A안의 전부) ── */}
      <section
        className={d.layer}
        data-layer="why"
        data-active={phase === "why"}
        inert={phase !== "why"}
        aria-labelledby="dlg-why"
      >
        <div className={d.inner}>
          <p className={d.chosenChip} style={{ "--i": 0 } as React.CSSProperties}>
            {SIM.steps[2].options[a3choice].text}
          </p>
          <h2
            className={d.q}
            id="dlg-why"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 1 } as React.CSSProperties}
          >
            왜 그쪽을 고르셨어요?
          </h2>
          <div
            className={d.reasonCol}
            role="group"
            aria-labelledby="dlg-why"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            {a3reasons.map((reason, r) => (
              <button
                key={reason}
                type="button"
                className={d.reasonBtn}
                onClick={() => onReason(r as 0 | 1 | 2)}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={d.prevBtn}
            onClick={() => onPrev(3)}
            style={{ "--i": 3 } as React.CSSProperties}
          >
            ← 답 다시 고르기
          </button>
        </div>
      </section>

      {/* ── cmp — 같은 답, 다른 이유 ── */}
      <section
        className={d.layer}
        data-layer="cmp"
        data-active={phase === "cmp"}
        inert={phase !== "cmp"}
        aria-labelledby="dlg-cmp"
      >
        <div className={d.inner}>
          <h2
            className={d.qSmall}
            id="dlg-cmp"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            같은 답을 고른 분들이,
            <br />
            이렇게 갈렸습니다.
          </h2>
          <ul className={d.cmpList} style={{ "--i": 1 } as React.CSSProperties}>
            {a3reasons.map((reason, r) => {
              const mine = sim.reason === r;
              return (
                <li key={reason} className={mine ? d.cmpMine : d.cmpRow}>
                  <span>{`“${reason}”`}</span>
                  {mine && <span className={d.youMark}>← 당신</span>}
                </li>
              );
            })}
          </ul>
          <p className={d.typedLine} style={{ "--i": 2 } as React.CSSProperties}>
            <span className="sr-only">답은 같은데, 이유는 다릅니다.</span>
            <Typewriter text="답은 같은데, 이유는 다릅니다." active={phase === "cmp"} />
          </p>
          <button
            type="button"
            className={d.nextBtn}
            onClick={onNext}
            style={{ "--i": 3 } as React.CSSProperties}
          >
            다음 →
          </button>
        </div>
      </section>

      {/* ── a4 — 착지: 방금 한 것이 한결의 방식 ── */}
      <section
        className={d.layer}
        data-layer="a4"
        data-active={phase === "a4"}
        inert={phase !== "a4"}
        aria-labelledby="dlg-a4"
      >
        <div className={d.inner}>
          <h2
            className={d.q}
            id="dlg-a4"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            방금 하신 게
            <br />
            {SITE.name}의 방식입니다.
          </h2>
          <p className={d.identity} style={{ "--i": 1 } as React.CSSProperties}>
            답을 고르고 — <strong>왜 그랬는지 말하는 것.</strong>
          </p>
          <div className={d.recap} style={{ "--i": 2 } as React.CSSProperties}>
            <span className={d.recapLabel}>오늘 고르신 것</span>
            <div className={d.recapChips} aria-hidden="true">
              {SIM.steps.map((step, i) => (
                <span key={step.options[0].label} className="chip">
                  {step.options[sim.answers[i] ?? 0].label}
                </span>
              ))}
            </div>
          </div>
          <p className={d.identity} style={{ "--i": 3 } as React.CSSProperties}>
            현장에서는 보기가 없습니다. <strong>직접 말씀하십니다.</strong>
            <br />
            {EVENT.rotationPartners}명과, 한 분당 {EVENT.rotationMinutes}분씩.
          </p>
          <p className={d.grainNote} style={{ "--i": 4 } as React.CSSProperties}>
            나무를 세로로 켜면 무늬가 드러납니다. 어떤 땅에서 어떤 바람을 맞고
            자랐는지가 안쪽에 기록된 것입니다. 저희는 사람의 그것을{" "}
            <strong>‘결’</strong>이라고 부릅니다.
          </p>
          <button
            type="button"
            className={d.nextBtn}
            onClick={onNext}
            style={{ "--i": 5 } as React.CSSProperties}
          >
            마무리 보기 →
          </button>
        </div>
      </section>

      {/* ── 허브 — 시퀀스의 종착지이자 재방문의 시작점 (7차 그대로) ── */}
      <section
        className={`${d.layer} ${d.layerHub}`}
        data-layer="hub"
        data-active={phase === "hub"}
        inert={phase !== "hub"}
        aria-labelledby="dlg-hub"
      >
        <div className={d.inner}>
          <h2
            className={d.q}
            id="dlg-hub"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            그 대화,
            <br />
            {SITE.name}이 엽니다.
          </h2>
          {/* "그래서 뭔데"의 답 — 정체 한 문장의 자리 */}
          <p className={d.identity} style={{ "--i": 1 } as React.CSSProperties}>
            {SITE.name}은 가치관이 맞는 사람을 오프라인에서 만나게 하는 대화
            모임입니다.
          </p>
          <div className={d.hubActions} style={{ "--i": 2 } as React.CSSProperties}>
            <Link className={`pill ${d.hubCta}`} href={EVENT_HREF}>
              {EVENT_CTA_LABEL}
            </Link>
          </div>
          <nav
            className={d.hubLinks}
            aria-label="한결을 더 알아보기"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <span className={d.hubLinksLabel}>{SITE.name}을 더 알아보기</span>
            {NAV.map((item) => (
              <Link key={item.href} className="link-arrow" href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={d.hubMini} style={{ "--i": 4 } as React.CSSProperties}>
            <button type="button" className={d.miniBtn} onClick={onRestart}>
              질문 다시 보기
            </button>
            <button type="button" className={d.miniBtn} onClick={onReplay}>
              처음부터 다시 보기
            </button>
          </div>
          {/* 아래에 1차 모임 정보가 이어진다는 신호 */}
          <div className={d.hint} aria-hidden="true">
            <span>아래로</span>
            <span className={d.hintLine} />
          </div>
        </div>
      </section>
    </>
  );
}
