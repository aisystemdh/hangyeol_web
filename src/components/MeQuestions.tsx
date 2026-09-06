"use client";

import { useState } from "react";
import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MeAnswersApiResponse, MeQuestionsData } from "@/lib/me-response";

/**
 * 우선순위 7 — 사전 질문 화면 (이슈 #36).
 *
 * 🔴 **여기 말고는 문항이 응답에 실리지 않는다.** `data`의 타입(`MeQuestionsData`)에만
 *    문항 필드가 있고, 서버는 입금완료 상태에서만 이 화면을 고른다(`src/lib/me-screen.ts`
 *    `guardExposure`). 제출은 별도 주소(`POST /api/me/[token]/answers`)로 가고, 그
 *    라우트가 저장 시점에도 같은 「입금완료」 조건을 한 번 더 건다.
 *
 * 🔴 **한 화면에 열 문항을 전부 펼친다** — 단계별 마법사(이전/다음)로 나누지 않는다.
 *    이 저장소의 다른 마이페이지 화면(`MeRegister.tsx`)이 전부 "한 화면 폼 + 스크롤"
 *    패턴이고, 여기서 갑자기 진행 단계·복원 상태를 새로 들이면 그 상태를 지키는
 *    코드가 이 화면에만 생긴다. 열 문항은 화면 하나에 다 들어갈 만큼 짧다(장면
 *    두세 문장 + 선택지 2~3개).
 *
 * 🔴 **재제출은 최신 값으로 덮어쓴다.** 제출이 성공하면 서버가 답을 저장했다는
 *    사실만 알고(등록 흐름과 같은 이유로 `onSubmitted`가 `GET`을 다시 태운다),
 *    다음 화면("confirmed")은 서버가 다시 고른다 — 여기서 직접 넘기지 않는다.
 */

type Status = "idle" | "submitting" | "success" | "error";

/**
 * 아직 입력 중인 답. 서버가 검사하는 최종 모양(`PreQuestionAnswers`,
 * `form9-copy.ts`)과 다르게 페어드 문항의 두 갈래 중 하나만 고른 **중간 상태**를
 * 허용한다 — 그래서 `[number, number]`가 아니라 `SlotPair`(둘 다 `undefined`일
 * 수 있다)로 따로 둔다. 제출은 `complete`가 참일 때만 되므로, 서버로 나가는
 * 시점에는 항상 두 칸이 다 채워져 있다.
 */
type SlotPair = [number | undefined, number | undefined];
type Draft = Record<string, number | SlotPair>;

/** 문항 하나가 답변됐는지. 페어드는 두 갈래 다 골라야 답변된 것으로 친다. */
function isAnswered(value: number | SlotPair | undefined): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value[0] !== undefined && value[1] !== undefined;
  return true;
}

/**
 * 선택지 하나짜리 라디오 묶음 — 일반 문항과 페어드 문항의 두 갈래가 똑같은 모양
 * (숨긴 라디오 + `.gender__btn` 라벨)이라 여기 하나로 모은다. 갈랐다가 한쪽만
 * 고치는 실수(코드 리뷰 2026-09-06 지적)를 막는다.
 */
function ChoiceGroup({
  legend,
  name,
  choices,
  checkedValue,
  onPick,
}: {
  legend: string;
  name: string;
  choices: { n: 1 | 2 | 3; text: string }[];
  checkedValue: number | undefined;
  onPick: (n: number) => void;
}) {
  return (
    <fieldset className={s.choices}>
      <legend className="sr-only">{legend}</legend>
      {choices.map((c) => {
        const id = `${name}-${c.n}`;
        return (
          <div key={c.n}>
            <input
              type="radio"
              id={id}
              name={name}
              className="gender__input"
              checked={checkedValue === c.n}
              onChange={() => onPick(c.n)}
            />
            <label className="gender__btn" htmlFor={id}>
              {c.text}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

export default function MeQuestions({
  token,
  data,
  onSubmitted,
}: {
  token: string;
  data: MeQuestionsData;
  onSubmitted: () => void | Promise<void>;
}) {
  const [answers, setAnswers] = useState<Draft>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const submitting = status === "submitting" || status === "success";
  const answeredCount = data.questions.filter((q) => isAnswered(answers[q.code])).length;
  const complete = answeredCount === data.questions.length;

  const pickSingle = (code: string, n: number) => {
    setAnswers((prev) => ({ ...prev, [code]: n }));
  };

  const pickPaired = (code: string, slot: 0 | 1, n: number) => {
    setAnswers((prev) => {
      const cur = prev[code];
      const pair: SlotPair = Array.isArray(cur) ? [...cur] : [undefined, undefined];
      pair[slot] = n;
      return { ...prev, [code]: pair };
    });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (!complete) {
      setShowIncomplete(true);
      return;
    }

    setShowIncomplete(false);
    setServerError(null);
    setStatus("submitting");
    try {
      const res = await fetch(`/api/me/${encodeURIComponent(token)}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ answers }),
      });
      const body: MeAnswersApiResponse | null = await res.json().catch(() => null);
      if (!body || body.ok !== true) {
        setServerError(
          body && "message" in body ? body.message : "잠시 문제가 있었습니다. 다시 시도해주세요.",
        );
        setStatus("error");
        return;
      }
      setStatus("success");
      await onSubmitted();
    } catch {
      setServerError("잠시 문제가 있었습니다. 다시 시도해주세요.");
      setStatus("error");
    }
  };

  return (
    <MeShell>
      <p className={s.eyebrow}>사전 질문</p>
      {/* 🔴 문항 수를 문구에 박지 않는다 — `PRE_QUESTION_FORM_VERSION`이 오르면
          문항 개수도 바뀔 수 있고, 그때 제목만 옛 숫자로 남으면 바로 아래 줄의
          실제 개수와 어긋나 보인다. */}
      <h1 className={s.title}>
        {data.name}님, {data.questions.length}가지만 답해주세요
      </h1>
      <p className={s.body}>
        정답은 없습니다. 지금의 나에 가까운 쪽을 고르시면 됩니다. 당일 2부
        대화는 이 답에서 시작됩니다.
      </p>
      <p className={s.progress}>
        {answeredCount} / {data.questions.length}개 답변
      </p>

      <form className="form" onSubmit={onSubmit} noValidate>
        {data.questions.map((q, i) => (
          <div className={s.question} key={q.code}>
            <p className={s.questionNum}>
              질문 {i + 1} · {q.topic}
            </p>
            <p className={s.scene}>{q.scene}</p>

            {q.paired ? (
              q.paired.map((branch, slotIdx) => {
                const slot = slotIdx as 0 | 1;
                const cur = answers[q.code];
                return (
                  <div key={branch.label}>
                    <p className={s.pairLabel}>{branch.label}</p>
                    <ChoiceGroup
                      legend={`${q.topic} · ${branch.label}`}
                      name={`${q.code}-${slot}`}
                      choices={branch.choices}
                      checkedValue={Array.isArray(cur) ? cur[slot] : undefined}
                      onPick={(n) => pickPaired(q.code, slot, n)}
                    />
                  </div>
                );
              })
            ) : (
              <ChoiceGroup
                legend={q.topic}
                name={q.code}
                choices={q.choices ?? []}
                checkedValue={typeof answers[q.code] === "number" ? (answers[q.code] as number) : undefined}
                onPick={(n) => pickSingle(q.code, n)}
              />
            )}
          </div>
        ))}

        {showIncomplete && !complete && (
          <p className="form__error" role="alert">
            아직 안 고른 질문이 있습니다. 열 가지 모두 답해야 제출할 수 있습니다.
          </p>
        )}

        <button type="submit" className="pill form__submit" disabled={submitting}>
          {status === "success"
            ? "제출 완료! 불러오는 중…"
            : status === "submitting"
              ? "제출하는 중…"
              : "제출하기"}
        </button>

        {status === "error" && serverError && (
          <p className="form__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </MeShell>
  );
}
