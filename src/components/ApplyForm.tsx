"use client";

import { useEffect, useRef, useState } from "react";
import { AGE_RANGE, EVENT } from "@/lib/event";
import { track } from "@/lib/track";

type Gender = "m" | "f" | null;
type Status = "idle" | "submitting" | "done" | "error";

/**
 * 폼 백엔드 서비스(Formspree / Web3Forms 등)가 발급해 준 주소.
 * `.env.local`에 `NEXT_PUBLIC_FORM_ENDPOINT=...` 로 넣는다.
 *
 * ⚠️ 비어 있으면 **제출 버튼을 잠근다.** 예전에는 아무 데도 보내지 않으면서
 *    "신청이 접수되었습니다"를 띄웠다. 다시 만들지 말 것:
 *    **보내지 못하면 접수됐다고 말하지 않는다.**
 *
 * Next는 이 값을 빌드 시점에 문자열로 박아 넣으므로 반드시 리터럴로 참조해야 한다
 * (`process.env[변수]` 같은 동적 접근은 undefined가 된다).
 */
const ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT;

/** 연락처: 숫자와 하이픈만, 숫자 9~11자리(02-123-4567 ~ 010-1234-5678) */
function validateTel(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "연락처를 입력해주세요.";
  if (!/^[0-9-]+$/.test(v)) return "연락처는 숫자와 하이픈(-)만 입력해주세요.";
  const digits = v.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) {
    return "연락처 자릿수를 확인해주세요.";
  }
  return null;
}

function validateName(raw: string): string | null {
  if (!raw.trim()) return "이름을 입력해주세요.";
  return null;
}

function validateAge(raw: string): string | null {
  if (!raw.trim()) return "나이를 입력해주세요.";
  const n = Number(raw);
  if (!Number.isInteger(n)) return "나이를 숫자로 입력해주세요.";
  if (n < EVENT.ageMin || n > EVENT.ageMax) {
    return `${AGE_RANGE}만 신청하실 수 있습니다.`;
  }
  return null;
}

export default function ApplyForm() {
  // 제어 컴포넌트로 두는 이유: 제출 뒤 "다시 신청하기"로 돌아왔을 때 입력값이
  // 남아 있어야 한다. 비제어 입력이면 폼이 다시 마운트되며 전부 날아간다.
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>(null);
  const [consent, setConsent] = useState(false);
  /**
   * 스팸 봇용 미끼. 사람은 볼 수도 탭으로 닿을 수도 없는 칸이라 **항상 빈 문자열**이어야 한다.
   * 값이 차 있으면 Formspree가 서버에서 조용히 버린다(`_gotcha`는 Formspree 규약 이름).
   *
   * ⚠️ 여기서 미리 걸러내지 않고 그대로 보내는 이유: 브라우저 자동완성이 실수로 이 칸을
   *    채우는 드문 경우에, 클라이언트에서 잘라내면 진짜 신청자가 소리 없이 사라진다.
   *    판단은 서버에 맡기고 우리는 값을 실어 보내기만 한다.
   */
  const [gotcha, setGotcha] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");

  const submitting = status === "submitting";

  /**
   * 신청 폼이 실제로 화면에 들어온 순간을 1회 기록한다.
   *
   * 마운트 시점이 아니라 **보였을 때**인 이유: 이 폼은 /events/1 페이지 하단에 있어
   * 페이지를 연 사람 전부가 마운트시킨다. 마운트를 세면 "폼을 본 사람"이
   * 페이지 조회수와 같아져서 지표가 아무것도 구분하지 못한다.
   *
   * threshold 0.3 — 폼의 30%가 보이면 "봤다"로 친다. 0에 가깝게 두면 스크롤이
   * 스쳐 지나가는 것까지 세고, 1로 두면 화면보다 긴 폼은 영원히 안 잡힌다.
   */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        track("apply_view");
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** 포커스가 빠질 때 그 칸만 검사한다 — 다 채운 뒤 한꺼번에 틀렸다고 하면 대부분 이탈한다. */
  const checkField = (key: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ENDPOINT || submitting) return;

    const found: Record<string, string> = {};
    const nameErr = validateName(name);
    const telErr = validateTel(tel);
    const ageErr = validateAge(age);
    if (nameErr) found.name = nameErr;
    if (telErr) found.tel = telErr;
    if (ageErr) found.age = ageErr;
    if (!gender) found.gender = "성별을 선택해주세요.";
    if (!consent) found.consent = "개인정보 수집·이용에 동의해주세요.";

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setStatus("submitting");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          이름: name.trim(),
          연락처: tel.trim(),
          성별: gender === "m" ? "남" : "여",
          나이: age.trim(),
          개인정보동의: "동의함",
          행사: "1차 모임",
          // 밑줄로 시작하는 둘은 Formspree 예약어다. 화면에 보이는 값이 아니다.
          _subject: `한결 1차 모임 신청 — ${name.trim()}`,
          _gotcha: gotcha,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      /* 성공했을 때만 센다 — 전송 실패는 신청이 아니다.
         성별만 싣는 이유: 게이트 1의 판정 기준이 "여성 25명"이라 성비를 매일 봐야 한다.
         이름·연락처·나이는 절대 싣지 않는다. */
      track("apply_submit", { gender: gender === "m" ? "남" : "여" });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="confirm">
        <div className="confirm__title">신청이 접수되었습니다</div>
        <p>
          확인 후 남겨주신 연락처로 개별 연락드립니다. 참가비 입금 안내와 진행
          과정을 함께 보내드립니다.
        </p>
        {/* 연락처를 잘못 적었을 때 돌아갈 길. 입력값은 그대로 남아 있다. */}
        <button
          type="button"
          className="confirm__back"
          onClick={() => setStatus("idle")}
        >
          잘못 입력하셨나요? 다시 신청하기
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label className="sr-only" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          placeholder="이름"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => checkField("name", validateName(name))}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p id="name-error" className="field__error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div className="field">
        <label className="sr-only" htmlFor="tel">
          연락처
        </label>
        <input
          id="tel"
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="input"
          placeholder="연락처"
          maxLength={20}
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          onBlur={() => checkField("tel", validateTel(tel))}
          aria-invalid={Boolean(errors.tel)}
          aria-describedby={errors.tel ? "tel-error" : undefined}
        />
        {errors.tel && (
          <p id="tel-error" className="field__error" role="alert">
            {errors.tel}
          </p>
        )}
      </div>

      {/* 라디오 그룹이다. 예전에는 aria-pressed 버튼 두 개라 스크린리더가
          "남, 눌리지 않음"으로 읽었다 — 필수 단일 선택이라는 사실이 전달되지 않았다. */}
      <div className="field">
        <fieldset className="gender">
          <legend className="sr-only">성별</legend>
          <input
            type="radio"
            id="gender-m"
            name="gender"
            className="gender__input"
            checked={gender === "m"}
            onChange={() => {
              setGender("m");
              checkField("gender", null);
            }}
          />
          <label className="gender__btn" htmlFor="gender-m">
            남
          </label>
          <input
            type="radio"
            id="gender-f"
            name="gender"
            className="gender__input"
            checked={gender === "f"}
            onChange={() => {
              setGender("f");
              checkField("gender", null);
            }}
          />
          <label className="gender__btn" htmlFor="gender-f">
            여
          </label>
        </fieldset>
        {errors.gender && (
          <p className="field__error" role="alert">
            {errors.gender}
          </p>
        )}
      </div>

      <div className="field">
        <label className="sr-only" htmlFor="age">
          나이
        </label>
        <input
          id="age"
          name="age"
          type="number"
          inputMode="numeric"
          className="input"
          placeholder="나이"
          min={EVENT.ageMin}
          max={EVENT.ageMax}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onBlur={() => checkField("age", validateAge(age))}
          aria-invalid={Boolean(errors.age)}
          aria-describedby={errors.age ? "age-error" : undefined}
        />
        {errors.age && (
          <p id="age-error" className="field__error" role="alert">
            {errors.age}
          </p>
        )}
      </div>

      {/* 이름·연락처·나이를 실제로 수집하므로 동의를 받는다.
          받는 것은 **필수 최소 수집에 대한 동의 하나뿐**이다 — 마케팅 수신 같은
          선택 동의 항목을 만들어 참가 조건처럼 끼워 넣지 않는다. */}
      <div className="field">
        <div className="consent">
          <input
            type="checkbox"
            id="consent"
            className="consent__input"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (e.target.checked) checkField("consent", null);
            }}
            aria-describedby={errors.consent ? "consent-error" : undefined}
          />
          <label className="consent__label" htmlFor="consent">
            개인정보 수집·이용에 동의합니다{" "}
            <span className="consent__req">(필수)</span>
          </label>
        </div>
        {errors.consent && (
          <p id="consent-error" className="field__error" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      {/* 🔴 「보유 기간 — 행사 종료 후 30일 이내 파기」 한 줄로 되돌리지 말 것. 셋이 걸린다 —
             ① 참가 자격(연령·미혼) 확인이 **이용 목적에 없으면** 미혼 조건을 거는 근거가 없다
             ② 참가 자격 분쟁은 30일 뒤에 온다. 그때 아무 기록이 없다
             ③ 참가비를 받으므로 계약·결제 기록은 5년 보존 의무다(전자상거래법 제6조).
                30일에 지우겠다고 고지하면 **고지 자체가 위반**이 된다.
             ⚠️ 여기 적은 기간은 실제로 파기 배치가 돌아야 성립한다 — 고지만 하고
                안 지우면 그 고지가 새 문제가 된다. 폼 9와 DB를 공유하면 배치도 하나로 묶는다.
             ⚠️ 변호사 검증 전 초안이다(2026-08-24 법적 점검 §4-1). */}
      <details className="rules">
        <summary>
          수집 항목 · 이용 목적 · 보유 기간 보기<span className="plus">+</span>
        </summary>
        <div data-answer>
          <p>
            <b>수집 항목</b> — 이름, 연락처, 성별, 나이
            <br />
            <b>이용 목적</b> — 참가 신청 확인, 참가 자격(연령·미혼) 확인, 참가비
            입금 안내, 행사 진행 안내
            <br />
            <b>보유 기간</b> — 항목마다 다릅니다.
          </p>
          <ul>
            <li>
              참가 신청 기록(이름, 연락처, 성별, 나이)과 동의 이력 —{" "}
              <b>3년</b>. 참가 자격을 둘러싼 분쟁에 대비하기 위한 기간입니다.
            </li>
            <li>그 밖의 정보 — 행사 종료 후 30일 이내 파기</li>
            <li>
              법령에 따라 보존해야 하는 기록은 그 기간 동안 보관합니다. 계약·결제
              기록 5년, 소비자 불만·분쟁 처리 기록 3년 (「전자상거래 등에서의
              소비자보호에 관한 법률」 제6조)
            </li>
          </ul>
          <p>
            기간이 지나거나 목적을 다한 정보는 지체 없이 파기하며, 전자 파일은
            복구할 수 없는 방법으로 삭제합니다.
          </p>
          <p>동의를 거부하실 수 있으며, 이 경우 신청 접수가 어렵습니다.</p>
          <p>
            행사 2주 전에 사전 질문 폼을 보내드리며, 그때 생년월일·혼인
            여부·직업을 추가로 여쭙습니다. 그 화면에서 다시 안내드리고 동의를
            받습니다.
          </p>
          <p>
            행사 당일에는 실명·나이·직업을 서로 묻지 않으며, 신분증으로 나이를
            확인한 뒤 사본은 보관하지 않습니다.
          </p>
        </div>
      </details>

      {/* 봇용 미끼 칸. display:none으로 숨기지 않는 것이 핵심이다 —
          그건 봇도 건너뛴다. 화면 밖으로 밀어내야 봇이 "빈 칸이네" 하고 채운다.
          사람에게는 tabIndex -1 + aria-hidden으로 완전히 차단된다. */}
      <input
        type="text"
        name="_gotcha"
        className="honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={gotcha}
        onChange={(e) => setGotcha(e.target.value)}
      />

      <button
        type="submit"
        className="pill form__submit"
        disabled={!ENDPOINT || submitting}
      >
        {submitting ? "보내는 중…" : "신청하기"}
      </button>

      {!ENDPOINT && (
        <p className="form__notice" role="status">
          신청 접수를 준비하고 있습니다. 곧 열립니다.
        </p>
      )}

      {status === "error" && (
        <p className="form__error" role="alert">
          전송에 실패했습니다. 잠시 후 다시 시도해주세요. 계속 안 되면 인스타그램
          메시지로 연락 주세요.
        </p>
      )}
    </form>
  );
}
