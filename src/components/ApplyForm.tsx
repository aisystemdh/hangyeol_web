"use client";

import { useState } from "react";
import { EVENT } from "@/lib/event";

type Gender = "m" | "f" | null;

export default function ApplyForm() {
  const [gender, setGender] = useState<Gender>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 원본 목업에는 성별 검증이 없었다 — 핸드오프 README가 짚은 누락이라 채운다.
    if (!gender) {
      setError("성별을 선택해주세요.");
      return;
    }
    setError(null);
    // TODO(백엔드): 여기서 신청 정보를 서버로 보낸다. 지금은 화면 전환만 한다.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="confirm">
        <div className="confirm__title">신청이 접수되었습니다</div>
        <p>사전 질문 10개와 장소 안내를 연락처로 보내드립니다.</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      <label className="sr-only" htmlFor="name">
        이름
      </label>
      <input id="name" name="name" type="text" className="input" placeholder="이름" required />

      <label className="sr-only" htmlFor="tel">
        연락처
      </label>
      <input id="tel" name="tel" type="tel" className="input" placeholder="연락처" required />

      <div className="gender" role="group" aria-label="성별">
        <button
          type="button"
          className="gender__btn"
          aria-pressed={gender === "m"}
          onClick={() => {
            setGender("m");
            setError(null);
          }}
        >
          남
        </button>
        <button
          type="button"
          className="gender__btn"
          aria-pressed={gender === "f"}
          onClick={() => {
            setGender("f");
            setError(null);
          }}
        >
          여
        </button>
      </div>

      <label className="sr-only" htmlFor="age">
        나이
      </label>
      <input
        id="age"
        name="age"
        type="number"
        className="input"
        placeholder="나이"
        min={EVENT.ageMin}
        max={EVENT.ageMax}
        required
      />

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="pill form__submit">
        신청하기
      </button>
    </form>
  );
}
