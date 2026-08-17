"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_HREF, EVENT_CTA_LABEL, NAV, SITE } from "@/lib/site";
import type { Phase } from "./HomeStage";
import d from "./HomeDialog.module.css";

/** 타이핑 시작 전 여유 — 반응 멘트가 먼저 읽히게 한다 */
const TYPE_DELAY_MS = 600;
/** 글자당 간격 */
const TYPE_TICK_MS = 45;

/**
 * 해결 문장을 한 글자씩 써 내려가는 연출.
 * - active가 꺼지면 리셋된다 — "이전 질문으로"로 되돌아왔다 다시 오면 또 써진다.
 * - 시각 타이핑은 aria-hidden이고 전문은 부모의 sr-only가 즉시 제공한다 —
 *   글자 단위 DOM 변경을 스크린리더가 글자별로 낭독하는 것을 막는다.
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
 * 무대의 질문(Q)·반응(R)·허브 레이어 — 표현 전용. 상태는 HomeStage가 갖는다.
 *
 * 카피 규칙(CLAUDE.md): 존댓말 · "저희" · 업종/상품명 금지(활동명 "소개팅/파티"까지만 —
 * 소유자 확정) · 반응은 답에 따라 갈린다(대화라는 감각의 핵심).
 * 답 버튼은 radio가 아니라 <button>이다 — 누르는 즉시 화면이 전이되는 "행동"이지
 * 폼 상태가 아니다.
 */
export const STEPS = [
  {
    eyebrow: "목표",
    href: "/mission",
    linkLabel: "한결의 목표 보기",
    question: ["소개팅도, 파티도 가보셨죠.", "만난 사람은 많은데, 남는 사람이 없던 적 있나요?"],
    answers: ["있어요", "없어요"] as const,
    reactions: [
      "그 아쉬움에서 한결이 시작됐습니다.",
      "좋은 만남을 이어오셨네요. 저희는 그 ‘다음’을 설계합니다.",
    ] as const,
    card: "저희는 더 많이 만나게 하지 않습니다. 더 깊이 만나게 합니다.",
  },
  {
    eyebrow: "왜 가치관인가",
    href: "/why",
    linkLabel: "왜 가치관인가 보기",
    question: ["MBTI까지 잘 맞는다던 사람과,", "정작 얘기가 안 통했던 적 있나요?"],
    answers: ["있어요", "없어요"] as const,
    reactions: [
      "답이 같아도 이유가 다르면 어긋납니다.",
      "그 대화가 통했던 데는 이유가 있습니다.",
    ] as const,
    card: "무엇을 골랐는지가 아니라 왜 골랐는지를 묻습니다.",
  },
  {
    eyebrow: "원칙",
    href: "/principles",
    linkLabel: "한결의 원칙 보기",
    question: ["나이·직업·사진으로", "나를 소개하는 게 억울했던 적 있나요?"],
    answers: ["있어요", "없어요"] as const,
    reactions: [
      "사람은 세 줄로 요약되지 않습니다.",
      "다행입니다. 그래도 사람이 세 줄에 담기지 않는다는 생각엔 변함이 없습니다.",
    ] as const,
    card: "사람을 전시하지 않는 것을 원칙으로 정했습니다.",
  },
];

type Props = {
  phase: Phase;
  chosen: (0 | 1 | null)[];
  onAnswer: (stepIndex: number, choice: 0 | 1) => void;
  onNext: () => void;
  /** "이전 질문으로" — 1-기반 질문 번호를 받는다 (q3에서 onPrev(2) → q2) */
  onPrev: (questionNumber: number) => void;
  onRestart: () => void;
  onReplay: () => void;
};

export default function HomeDialog({
  phase,
  chosen,
  onAnswer,
  onNext,
  onPrev,
  onRestart,
  onReplay,
}: Props) {
  return (
    <>
      {STEPS.map((step, i) => {
        const n = i + 1;
        const q: Phase = `q${n}` as Phase;
        const r: Phase = `r${n}` as Phase;
        return (
          <Fragment key={step.href}>
            {/* ── 질문 레이어 ── */}
            <section
              className={d.layer}
              data-layer={q}
              data-active={phase === q}
              inert={phase !== q}
              aria-labelledby={`dlg-q${n}`}
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
                  id={`dlg-q${n}`}
                  data-focus-target
                  tabIndex={-1}
                  style={{ "--i": 1 } as React.CSSProperties}
                >
                  {step.question[0]}
                  <br />
                  {step.question[1]}
                </h2>
                <div
                  className={d.answers}
                  role="group"
                  aria-labelledby={`dlg-q${n}`}
                  style={{ "--i": 2 } as React.CSSProperties}
                >
                  <button type="button" className={d.answerBtn} onClick={() => onAnswer(i, 0)}>
                    {step.answers[0]}
                  </button>
                  <button type="button" className={d.answerBtn} onClick={() => onAnswer(i, 1)}>
                    {step.answers[1]}
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

            {/* ── 반응 레이어 — 멘트는 답에 따라 갈린다 ── */}
            <section
              className={d.layer}
              data-layer={r}
              data-active={phase === r}
              inert={phase !== r}
              aria-label={`${step.eyebrow}에 대한 한결의 답`}
            >
              <div className={d.inner}>
                <p
                  className={d.reaction}
                  data-focus-target
                  tabIndex={-1}
                  style={{ "--i": 0 } as React.CSSProperties}
                >
                  {step.reactions[chosen[i] ?? 0]}
                </p>
                {/* 박스 카드 대신 "그래서 한결은 —" + 한 글자씩 써지는 해결 문장 (7차) */}
                <div className={d.solution} style={{ "--i": 1 } as React.CSSProperties}>
                  <span className={d.solutionLead}>
                    그래서 {SITE.name}은 이렇게 합니다
                  </span>
                  <p className={d.solutionText}>
                    <span className="sr-only">{step.card}</span>
                    <Typewriter text={step.card} active={phase === r} />
                  </p>
                  <Link className="link-arrow" href={step.href}>
                    {step.linkLabel}
                  </Link>
                </div>
                {/* 마지막 반응 다음은 질문이 아니라 허브라 라벨이 갈린다 —
                    "다음 질문"이라 해놓고 마무리가 나오면 거짓말이 된다 */}
                <button
                  type="button"
                  className={d.nextBtn}
                  onClick={onNext}
                  style={{ "--i": 2 } as React.CSSProperties}
                >
                  {i < STEPS.length - 1 ? "다음 질문 →" : "마무리 보기 →"}
                </button>
              </div>
            </section>
          </Fragment>
        );
      })}

      {/* ── 허브 — 시퀀스의 종착지이자 재방문의 시작점 ── */}
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
            그 세 가지,
            <br />
            {SITE.name}이 다 합니다.
          </h2>
          {/* "그래서 뭔데"의 답 — 정체 한 문장의 새 자리 */}
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
          {/* 아래에 1차 모임 정보가 이어진다는 신호 — 옛 히어로 힌트의 새 자리 */}
          <div className={d.hint} aria-hidden="true">
            <span>아래로</span>
            <span className={d.hintLine} />
          </div>
        </div>
      </section>
    </>
  );
}
