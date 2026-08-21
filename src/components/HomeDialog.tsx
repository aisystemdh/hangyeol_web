"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_HREF, EVENT_CTA_LABEL, NAV, SITE } from "@/lib/site";
import type { A1, A2, A3, Phase, SimState } from "./HomeStage";
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
 * 온보딩 문안 — 10차 A안(2026-08-21 소유자 확정).
 *
 * ── 왜 이 구조인가 ──────────────────────────────────────────
 * 브랜드 정본(01_brand_philosophy §4.2)의 핵심은 **답과 결의 분리**다:
 * 무엇을 골랐는가(답)와 왜 그것을 골랐는가(결)는 다르고, 같은 답을 고른 두 사람이
 * 전혀 다른 이유를 가질 수 있다. 이 온보딩은 그것을 **설명하지 않고 겪게 한다**.
 *
 *   a1 무엇을 했나 → a2 그 이유는 → a3 자리를 바꾸면
 *
 * ⚠️ **이유를 별도 화면이 아니라 두 번째 질문으로 둔 것이 이 설계의 전부다.**
 *    9차까지는 「답 3개 → 마지막에만 이유 3택」이었는데, 그러면 이유가 부록이 된다.
 *    지금은 사용자가 정확히 세 번 누르고 01/03 표기가 정직해진다.
 *
 * ⚠️ a2의 두 보기는 반드시 **「즉각 ↔ 구조」로 갈리게** 쓴다.
 *    minor는 *그 일이 작다* · futile은 *말이 안 통한다* — 넘어간 자리가 완전히 다르다.
 *    accurate는 *지금 이 사람* · future는 *앞으로 반복될 것*.
 *    이 대비가 무너지면 cmp의 "이유는 다릅니다"가 거짓말이 된다.
 *
 * ⚠️ 열등한 선택지를 만들지 않는다(02_question_principles Rule 4·14).
 *    why의 「같음」 두 갈래에도 **반드시 대가를 한 줄 적는다** — 같다고 좋다고만 하면
 *    그 화면이 칭찬이 되고, 같은 원칙이 반대 방향으로 깨진다.
 *
 * ⚠️ 유형·점수·퍼센트·성사율을 넣지 않는다. 수치를 지어내지 않는다.
 * ⚠️ a1 장면을 바꿀 때는 **사전 질문 10문항과 겹치지 않는지** 먼저 볼 것.
 *    옛 a1(친구와 어긋난 뒤)이 R4「다투고 난 뒤」와 겹쳐 이 장면으로 교체됐다.
 */
export const SIM = {
  a1: {
    lead: "누가 나를 이렇게 말합니다.",
    quote: ["“너 원래 그런 거", "신경 안 쓰잖아.”"],
    tail: "근데 사실은 아닙니다.",
    options: [
      { key: "pass", text: "그냥 웃고 넘어간다", label: "넘어간다" },
      { key: "say", text: "아니라고 말한다", label: "말한다" },
    ],
  },
  /** 되돌림 1 — 답을 받고 **이유를 빚으로 남긴다**. 다음 화면이 그 빚을 갚는다. */
  t1: {
    plain: "그러시군요.",
    typed: {
      pass: "그런데 왜 넘어가셨는지는 아직 안 여쭤봤습니다.",
      say: "그런데 왜 말하기로 하셨는지는 아직 안 여쭤봤습니다.",
    },
  },
  a2: {
    pass: {
      lead: "넘어가기로 하셨습니다.",
      options: [
        { key: "minor", text: "굳이 설명할 일은 아니라서" },
        { key: "futile", text: "설명해도 잘 전해지지 않을 것 같아서" },
      ],
    },
    say: {
      lead: "아니라고 하기로 하셨습니다.",
      options: [
        { key: "accurate", text: "잘못 알려진 채로 두기 싫어서" },
        { key: "future", text: "지금 말해야 다음이 편해서" },
      ],
    },
  },
  /**
   * 되돌림 2 — 고른 이유를 되돌려준다. 판정하지 않는다.
   * `typed`("앞의 것과는 다른 이유입니다")는 **각 짝의 둘째 보기에만** 붙인다 —
   * 네 화면에 다 넣으면 장치가 닳는다. 브랜드가 자기 방식을 설명하는 대신
   * 사용자가 고른 것으로 갈림을 보여주는 문장이라 값이 여기 있다.
   */
  t2: {
    minor: {
      quote: "굳이 설명할 일은 아니라서",
      body: [
        "그 오해가 나를 크게 건드리지 않았다는 뜻이기도 합니다.",
        "참은 게 아니라, 애초에 넘어갈 만한 일이었던 거죠.",
      ],
      typed: null,
    },
    futile: {
      quote: "설명해도 잘 전해지지 않을 것 같아서",
      body: ["넘어간 이유가 그 사람이 아니라 말의 한계에 있었습니다."],
      typed: "같은 「넘어간다」인데, 앞의 것과는 다른 이유입니다.",
    },
    accurate: {
      quote: "잘못 알려진 채로 두기 싫어서",
      body: ["지금 이 사람이 나를 어떻게 아는가.", "거기가 걸리셨습니다."],
      typed: null,
    },
    future: {
      quote: "지금 말해야 다음이 편해서",
      body: ["걸린 건 지금이 아니라 앞으로 반복될 것이었습니다."],
      typed: "같은 「말한다」인데, 앞의 것과는 다른 이유입니다.",
    },
  },
  a3: {
    lead: "이번엔 반대입니다.",
    question: ["내가 누군가를 잘못 알고 있다면,", "그 사람이 어떻게 해주면 좋겠어요?"],
    options: [
      { key: "tell", text: "바로 말해줬으면", label: "말해줬으면" },
      { key: "leave", text: "굳이 안 해도 괜찮다", label: "안 해도 괜찮다" },
    ],
  },
  /**
   * 겹침 — a1(내가 한 것) × a3(상대에게 바라는 것). 이 화면이 A안의 정점이다.
   * 네 갈래 **모두** 얻는 것과 잃는 것이 한 줄씩 있다(caveat). 어느 조합도
   * 정답이 아니고, 어느 조합도 흠이 아니다.
   */
  why: {
    "pass-tell": {
      head: ["나는 넘어갔는데,", "상대에겐 말해달라고 하셨습니다."],
      body: [
        "앞뒤가 안 맞는 게 아닙니다 —",
        "내가 편한 방식과 내가 바라는 방식이 같아야 할 이유는 없으니까요.",
      ],
      caveat:
        "다만 말해두지 않으면 상대는 모릅니다. 대개는 상대가 나 하는 걸 보고 따라 하니까요.",
    },
    "say-leave": {
      head: ["나는 말했는데,", "상대는 안 해도 된다고 하셨습니다."],
      body: [
        "내가 하는 건 괜찮고 상대가 하는 건 부담일 수 있습니다.",
        "이상한 게 아닙니다.",
      ],
      caveat: "다만 상대는 나에게 말해도 되는지 알 방법이 없습니다.",
    },
    "pass-leave": {
      head: ["나도 넘어가고,", "상대도 안 해도 된다고 하셨습니다."],
      body: [
        "주는 것과 바라는 것이 같으셨습니다.",
        "이 자리에서는 어긋날 일이 적습니다.",
      ],
      caveat: "다만 둘 다 넘어가면, 틀린 채로 오래 갑니다.",
    },
    "say-tell": {
      head: ["나도 말하고,", "상대도 말해줬으면 하셨습니다."],
      body: ["주는 것과 바라는 것이 같으셨습니다.", "오해가 오래 남지 않습니다."],
      caveat: "다만 상대는 그걸 부담으로 느낄 수도 있습니다.",
    },
  },
  /** a4의 마지막 한 줄. why의 네 갈래를 한 문장으로 접는다. */
  overlap: {
    "pass-tell": "하는 것과 바라는 것이 서로 반대쪽입니다.",
    "say-leave": "하는 것과 바라는 것이 서로 반대쪽입니다.",
    "pass-leave": "하는 것과 바라는 것이 같은 쪽입니다.",
    "say-tell": "하는 것과 바라는 것이 같은 쪽입니다.",
  },
} as const;

/** 답 → 짧은 라벨. a4 대조와 계측이 함께 쓴다(전문은 길어서 집계 화면에서 잘린다). */
export const A1_LABEL: Record<A1, string> = {
  pass: SIM.a1.options[0].label,
  say: SIM.a1.options[1].label,
};
export const A3_LABEL: Record<A3, string> = {
  tell: SIM.a3.options[0].label,
  leave: SIM.a3.options[1].label,
};
/** 이유 → 전문. t2·cmp·a4가 **글자 그대로 같은 문장**을 보여줘야 대조가 산다. */
export const A2_TEXT: Record<A2, string> = {
  minor: SIM.a2.pass.options[0].text,
  futile: SIM.a2.pass.options[1].text,
  accurate: SIM.a2.say.options[0].text,
  future: SIM.a2.say.options[1].text,
};

/** a1과 a3의 조합 키 — why·overlap의 인덱스다 */
export type OverlapKey = keyof typeof SIM.why;
export const overlapKey = (a1: A1, a3: A3): OverlapKey =>
  `${a1}-${a3}` as OverlapKey;

type Props = {
  phase: Phase;
  sim: SimState;
  onA1: (v: A1) => void;
  onA2: (v: A2) => void;
  onA3: (v: A3) => void;
  onNext: () => void;
  /** "이전 질문으로" — 1-기반 질문 번호 */
  onPrev: (questionNumber: number) => void;
  onRestart: () => void;
  onReplay: () => void;
};

/**
 * 허브의 정체 한 줄 — 「그래서 뭐 하는 곳인데」의 답.
 *
 * ⭐ **문장이 스스로 브랜드 명제를 수행한다.** 한 글자씩 빠르게 써진 뒤
 *    「답」에 X가 그어지고 → 「답」이 사라지고 → 「이유」가 들린다.
 *    브랜드가 "저희는 이유를 봅니다"라고 **말하는** 대신, 눈앞에서 답이 지워진다.
 *
 * ⚠️ 「답」은 opacity로만 지운다. 문자를 실제로 빼면 뒷글자가 당겨지며 줄바꿈이
 *    다시 잡혀, 사라진 게 아니라 **화면이 틀어진 것처럼** 보인다. 같은 이유로
 *    타이핑도 글자를 잘라 붙이는 게 아니라 **전부 그려 놓고 opacity만 켠다** —
 *    문단 높이가 처음부터 확정돼 아래 CTA가 밀리지 않는다.
 */
const HUB_LINE = [
  { t: `${SITE.name}은 ` },
  { t: "답", role: "answer" as const },
  { t: "이 아니라 " },
  { t: "이유", role: "reason" as const },
  { t: "를 묻는 오프라인 대화 모임입니다." },
];
const HUB_TEXT = HUB_LINE.map((s) => s.t).join("");
const HUB_CHARS = HUB_LINE.flatMap(({ t, role }) =>
  [...t].map((ch) => ({ ch, role })),
);

/** 레이어 등장 스태거(240ms 지연 + 450ms)가 끝난 뒤에 쓰기 시작한다 */
const HUB_START_MS = 450;
/** 글자당 간격 — 되돌림(t1·t2)의 45ms보다 빠르다. 여긴 읽어주는 게 아니라 쓰는 것이다. */
const HUB_TICK_MS = 34;
const HUB_X_MS = 420; // 다 쓰고 → X
const HUB_GONE_MS = 620; // X → 「답」 사라짐
const HUB_LIT_MS = 260; // 사라짐 → 「이유」 강조

function HubIdentity({ active, style }: { active: boolean; style?: React.CSSProperties }) {
  const [count, setCount] = useState(0);
  /** 0 쓰는 중 · 1 X · 2 「답」 사라짐 · 3 「이유」 강조 */
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 레이어 비활성화에 맞춘 1회 리셋. 재진입 시 다시 재생된다.
      setCount(0);
      setStep(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(HUB_CHARS.length);
      setStep(3);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i < HUB_CHARS.length) return;
        if (interval) clearInterval(interval);
        timers.push(setTimeout(() => setStep(1), HUB_X_MS));
        timers.push(setTimeout(() => setStep(2), HUB_X_MS + HUB_GONE_MS));
        timers.push(setTimeout(() => setStep(3), HUB_X_MS + HUB_GONE_MS + HUB_LIT_MS));
      }, HUB_TICK_MS);
    }, HUB_START_MS);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [active]);

  return (
    <p className={d.identity} style={style}>
      {/* 낭독은 완성된 문장 하나로 끝낸다 — 글자별 span을 읽히면 소음이 된다 */}
      <span className="sr-only">{HUB_TEXT}</span>
      <span aria-hidden="true">
        {HUB_CHARS.map((c, i) => (
          <span
            key={i}
            className={
              c.role === "answer"
                ? d.hubAnswer
                : c.role === "reason"
                  ? d.hubReason
                  : d.hubChar
            }
            data-typed={i < count ? "true" : undefined}
            data-gone={c.role === "answer" && step >= 2 ? "true" : undefined}
            data-lit={c.role === "reason" && step >= 3 ? "true" : undefined}
          >
            {c.ch}
            {c.role === "answer" && (
              /* X는 SVG로 긋는다. div 두 장을 회전시키는 방식은 한 글자(≈20px)
                 위에서 ±21°가 세로로 8px밖에 안 벌어져 **X로 안 읽혔다**(실측). */
              <svg
                className={d.hubX}
                data-on={step >= 1 ? "true" : undefined}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="4" y1="4" x2="96" y2="96" pathLength={100} />
                <line x1="96" y1="4" x2="4" y2="96" pathLength={100} />
              </svg>
            )}
          </span>
        ))}
      </span>
    </p>
  );
}

/** 진행 표시. t·why·cmp는 세지 않는다 — 사용자가 누르는 건 정확히 세 번이다. */
function Counter({ n }: { n: 1 | 2 | 3 }) {
  return (
    <p className={d.counter} style={{ "--i": 0 } as React.CSSProperties}>
      <span aria-hidden="true">
        0{n} <span className={d.counterOf}>/ 03</span>
      </span>
      <span className="sr-only">{`질문 ${n}, 총 3개`}</span>
    </p>
  );
}

/** 줄바꿈이 문안의 일부인 문단 — 배열을 <br>로 잇는다 */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

export default function HomeDialog({
  phase,
  sim,
  onA1,
  onA2,
  onA3,
  onNext,
  onPrev,
  onRestart,
  onReplay,
}: Props) {
  /* 레이어는 전부 상시 마운트라(HomeStage 주석 참조) 아직 안 고른 값도 렌더된다.
     기본값으로 대신 그린다 — 그 레이어에 닿을 때쯤엔 실제 선택으로 덮여 있다. */
  const a1 = sim.a1 ?? "pass";
  const a2 = sim.a2 ?? (a1 === "pass" ? "minor" : "accurate");
  const a3 = sim.a3 ?? "tell";
  const a2set = SIM.a2[a1];
  const t2 = SIM.t2[a2];
  const overlap = overlapKey(a1, a3);
  const why = SIM.why[overlap];

  return (
    <>
      {/* ── a1 · 01/03 — 오해받는 장면. 분기 없음 ─────────────── */}
      <section
        className={d.layer}
        data-layer="a1"
        data-active={phase === "a1"}
        inert={phase !== "a1"}
        aria-labelledby="dlg-a1"
      >
        <div className={d.inner}>
          <Counter n={1} />
          <p className={d.qLead} style={{ "--i": 1 } as React.CSSProperties}>
            {SIM.a1.lead}
          </p>
          <h2
            className={d.q}
            id="dlg-a1"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <Lines lines={SIM.a1.quote} />
          </h2>
          <p className={d.qTail} style={{ "--i": 3 } as React.CSSProperties}>
            {SIM.a1.tail}
          </p>
          <div
            className={d.answerCol}
            role="group"
            aria-labelledby="dlg-a1"
            style={{ "--i": 4 } as React.CSSProperties}
          >
            <button type="button" className={d.answerBtn} onClick={() => onA1("pass")}>
              {SIM.a1.options[0].text}
            </button>
            <button type="button" className={d.answerBtn} onClick={() => onA1("say")}>
              {SIM.a1.options[1].text}
            </button>
          </div>
        </div>
      </section>

      {/* ── t1 — 이유를 빚으로 남긴다 (a1으로 2갈래) ──────────── */}
      <section
        className={d.layer}
        data-layer="t1"
        data-active={phase === "t1"}
        inert={phase !== "t1"}
        aria-label="한결의 되돌림"
      >
        <div className={d.inner}>
          <p
            className={d.reaction}
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            {SIM.t1.plain}
          </p>
          <p className={d.typedLine} style={{ "--i": 1 } as React.CSSProperties}>
            <span className="sr-only">{SIM.t1.typed[a1]}</span>
            <Typewriter text={SIM.t1.typed[a1]} active={phase === "t1"} />
          </p>
          <button
            type="button"
            className={d.nextBtn}
            onClick={onNext}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            바로 여쭤보겠습니다 →
          </button>
        </div>
      </section>

      {/* ── a2 · 02/03 — **그 이유**. 보기가 a1에 따라 갈린다 ──── */}
      <section
        className={d.layer}
        data-layer="a2"
        data-active={phase === "a2"}
        inert={phase !== "a2"}
        aria-labelledby="dlg-a2"
      >
        <div className={d.inner}>
          <Counter n={2} />
          <p className={d.qLead} style={{ "--i": 1 } as React.CSSProperties}>
            {a2set.lead}
          </p>
          <h2
            className={d.q}
            id="dlg-a2"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            그 이유는?
          </h2>
          <div
            className={d.reasonCol}
            role="group"
            aria-labelledby="dlg-a2"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            {a2set.options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={d.reasonBtn}
                onClick={() => onA2(o.key)}
              >
                {o.text}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={d.prevBtn}
            onClick={() => onPrev(1)}
            style={{ "--i": 4 } as React.CSSProperties}
          >
            ← 이전 질문으로
          </button>
        </div>
      </section>

      {/* ── t2 — 고른 이유를 되돌려준다 (4갈래) ───────────────── */}
      <section
        className={d.layer}
        data-layer="t2"
        data-active={phase === "t2"}
        inert={phase !== "t2"}
        aria-label="한결의 되돌림"
      >
        <div className={d.inner}>
          <p className={d.chosenChip} style={{ "--i": 0 } as React.CSSProperties}>
            {`「${t2.quote}」`}
          </p>
          <p
            className={d.reaction}
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <Lines lines={t2.body} />
          </p>
          {t2.typed && (
            <p className={d.typedLine} style={{ "--i": 2 } as React.CSSProperties}>
              <span className="sr-only">{t2.typed}</span>
              <Typewriter text={t2.typed} active={phase === "t2"} />
            </p>
          )}
          <button
            type="button"
            className={d.nextBtn}
            onClick={onNext}
            style={{ "--i": 3 } as React.CSSProperties}
          >
            다음 질문 →
          </button>
        </div>
      </section>

      {/* ── a3 · 03/03 — 자리를 바꾼다. 분기 없음 ─────────────── */}
      <section
        className={d.layer}
        data-layer="a3"
        data-active={phase === "a3"}
        inert={phase !== "a3"}
        aria-labelledby="dlg-a3"
      >
        <div className={d.inner}>
          <Counter n={3} />
          <p className={d.qLead} style={{ "--i": 1 } as React.CSSProperties}>
            {SIM.a3.lead}
          </p>
          <h2
            className={d.q}
            id="dlg-a3"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <Lines lines={SIM.a3.question} />
          </h2>
          <div
            className={d.answerCol}
            role="group"
            aria-labelledby="dlg-a3"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <button type="button" className={d.answerBtn} onClick={() => onA3("tell")}>
              {SIM.a3.options[0].text}
            </button>
            <button type="button" className={d.answerBtn} onClick={() => onA3("leave")}>
              {SIM.a3.options[1].text}
            </button>
          </div>
          <button
            type="button"
            className={d.prevBtn}
            onClick={() => onPrev(2)}
            style={{ "--i": 4 } as React.CSSProperties}
          >
            ← 이전 질문으로
          </button>
        </div>
      </section>

      {/* ── why — 겹침 a1 × a3 (4갈래). A안의 정점 ────────────── */}
      <section
        className={d.layer}
        data-layer="why"
        data-active={phase === "why"}
        inert={phase !== "why"}
        aria-labelledby="dlg-why"
      >
        <div className={d.inner}>
          <h2
            className={d.qSmall}
            id="dlg-why"
            data-focus-target
            tabIndex={-1}
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <Lines lines={why.head} />
          </h2>
          <p className={d.identity} style={{ "--i": 1 } as React.CSSProperties}>
            <Lines lines={why.body} />
          </p>
          {/* 얻는 것 옆의 **잃는 것**. 네 갈래 모두에 있다 — 없으면 칭찬이 된다. */}
          <p className={d.caveat} style={{ "--i": 2 } as React.CSSProperties}>
            {why.caveat}
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

      {/* ── cmp — 같은 답, 다른 이유 (a1으로 2갈래) ───────────── */}
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
            {`「${SIM.a1.options[a1 === "pass" ? 0 : 1].text}」를 고른 분들이,`}
            <br />
            이유에서 이렇게 갈렸습니다.
          </h2>
          <ul className={d.cmpList} style={{ "--i": 1 } as React.CSSProperties}>
            {a2set.options.map((o) => {
              const mine = sim.a2 === o.key;
              return (
                <li key={o.key} className={mine ? d.cmpMine : d.cmpRow}>
                  <span>{o.text}</span>
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

      {/* ── a4 — 착지: 답 ↔ 결 대조 + 겹침 한 줄 ──────────────────
          🗑️ 여기에 **나뭇결 문단·「결」이라는 단어·가격·신청 버튼을 넣지 말 것.**
             ① 개념 설명을 다시 하면 방금 겪은 체험이 강의로 내려앉는다. 나뭇결
                이야기는 건너뛰기 경로의 히어로가 이미 한다.
             ② 자기 발견으로 끝난 화면이 가격표로 닫히면 체험이 광고가 된다.
                상품 이야기는 바로 다음 hub가 받는다(탭 한 번).
             ⚠️ 이건 전환율과 바꾼 것이다 — a4가 관심이 가장 높은 지점이라
                거기서 바로 신청으로 보내는 편이 수치상 유리하다. 그걸 알면서
                택한 것이므로, a4 → hub → 신청 이탈이 실측에서 크면 다시 판단한다. */}
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

          <div className={d.contrast} style={{ "--i": 1 } as React.CSSProperties}>
            <p className={d.contrastLine}>
              <span className={d.quoted}>{`「${A1_LABEL[a1]}」`}</span> 는 답이고
            </p>
            <p className={d.contrastLine}>
              <span className={d.quoted}>{`「${A2_TEXT[a2]}」`}</span> 가{" "}
              <span className={d.accent}>이유</span>입니다.
            </p>
          </div>

          <p className={d.identity} style={{ "--i": 2 } as React.CSSProperties}>
            같은 답을 한 사람이라도
            <br />
            <span className={d.accent}>이유</span>가 다르면 완전히 다른 사람입니다.
          </p>

          <div className={d.contrast} style={{ "--i": 3 } as React.CSSProperties}>
            <p className={d.contrastLine}>그리고 상대에겐 —</p>
            <p className={d.contrastLine}>
              <span className={d.quoted}>{`「${A3_LABEL[a3]}」`}</span>
            </p>
          </div>

          <p className={d.caveat} style={{ "--i": 4 } as React.CSSProperties}>
            {SIM.overlap[overlap]}
          </p>

          <button
            type="button"
            className={d.nextBtn}
            onClick={onNext}
            style={{ "--i": 5 } as React.CSSProperties}
          >
            다음 →
          </button>
        </div>
      </section>

      {/* ── 허브 — 시퀀스의 종착지이자 재방문의 시작점 ─────────── */}
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
            이런 대화
            <br />
            {SITE.name}에서 시작합니다.
          </h2>
          {/* "그래서 뭔데"의 답 — 정체 한 문장의 자리.
              ⚠️ "가치관이 맞는 사람" · "결이 같은 사람" · "답변이 비슷한 상대"로
                 되돌리지 말 것. 2부 페어링은 최대유사 5쌍 + **최소유사 5쌍**이라
                 절반은 결이 가장 다른 사람과 앉는다. 참가비를 받는 페이지의 사실
                 주장은 표시광고법상 사업자가 실증해야 한다. 히어로·이 문장·
                 /events/1 세 곳이 같은 약속을 하므로 **함께** 고칠 것. */}
          <HubIdentity
            active={phase === "hub"}
            style={{ "--i": 1 } as React.CSSProperties}
          />
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
