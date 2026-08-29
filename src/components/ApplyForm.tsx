"use client";

import { useEffect, useRef, useState } from "react";
import { AGE_RANGE, EVENT } from "@/lib/event";
import { track } from "@/lib/track";

type Gender = "M" | "F" | null;
type Status = "idle" | "submitting" | "done" | "error" | "duplicate";

/**
 * 사전 등록은 이제 **우리 서버로 간다**(`/api/apply` → Neon Postgres).
 *
 * ⚠️ 예전에는 `NEXT_PUBLIC_FORM_ENDPOINT`(Formspree)로 브라우저가 직접 쐈다.
 *    그래서 ① 신청이 메일로만 남고 어디에도 쌓이지 않았고 ② 주소가 브라우저
 *    번들에 박혀 누구나 직접 쏠 수 있었다. 둘 다 이 변경으로 닫힌다.
 *    Formspree는 서버 쪽 `APPLY_NOTIFY_ENDPOINT`로 자리를 옮겨 **알림 전용**이 됐다.
 *
 * ⚠️ 엔드포인트가 없으면 버튼을 잠그던 장치는 사라졌다(주소가 항상 같은 출처다).
 *    **원칙은 그대로다 — 보내지 못하면 접수됐다고 말하지 않는다.**
 *    완료 화면은 오직 서버가 201을 돌려줬을 때만 뜬다.
 */
const ENDPOINT = "/api/apply";

/**
 * 연락처: 휴대전화만 받는다.
 *
 * ⚠️ 예전에는 02 지역번호까지 받았다(숫자 9~11자리). 안내가 전부 **카카오 알림톡**
 *    으로 나가고 못 받으면 문자로 대체되는 구조라, 휴대전화가 아니면 아무 안내도
 *    닿지 않는다. 받아놓고 못 보내는 것이 안 받는 것보다 나쁘다.
 */
function validateTel(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "연락처를 입력해주세요.";
  if (!/^[0-9-]+$/.test(v)) return "연락처는 숫자와 하이픈(-)만 입력해주세요.";
  const digits = v.replace(/\D/g, "");
  if (!/^010\d{8}$/.test(digits)) {
    return "안내가 문자로 나가서 휴대전화 번호가 필요합니다. 010으로 시작하는 11자리로 입력해주세요.";
  }
  return null;
}

function validateName(raw: string): string | null {
  if (!raw.trim()) return "이름을 입력해주세요.";
  return null;
}

/** 만 나이. 기준일은 오늘 — 서버가 저장할 때 birth로 다시 계산한다. */
function ageOf(birth: string): number {
  const b = new Date(birth + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * 나이 대신 **생년월일**을 받는다.
 *
 * ⚠️ 예전에는 나이를 숫자로 받았다. 그러면 ① 서버가 값을 검증할 방법이 없고
 *    (스스로 적은 숫자뿐이다) ② 생일이 지났는지에 따라 갈리는 경계(만 20세·32세)를
 *    판정할 수 없다. 사전 질문 폼에서 어차피 생년월일을 받으므로, 여기서 받아
 *    한 번만 묻는 편이 최소 수집에도 맞는다.
 */
function validateBirth(raw: string): string | null {
  if (!raw.trim()) return "생년월일을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "생년월일을 확인해주세요.";
  const age = ageOf(raw);
  if (Number.isNaN(age) || age < 10 || age > 100) return "생년월일을 확인해주세요.";
  if (age < EVENT.ageMin || age > EVENT.ageMax) {
    return AGE_RANGE + "만 신청하실 수 있습니다.";
  }
  return null;
}

export default function ApplyForm() {
  // 제어 컴포넌트로 두는 이유: 제출 뒤 "다시 등록하기"로 돌아왔을 때 입력값이
  // 남아 있어야 한다. 비제어 입력이면 폼이 다시 마운트되며 전부 날아간다.
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<Gender>(null);
  const [consent, setConsent] = useState(false);
  /**
   * 다음 회차 안내 — **선택**이다.
   *
   * 🔴 이 칸은 참가 조건이 아니다. 체크하지 않아도 제출이 되고, 제출을 막는 코드를
   *    붙이지 않는다. 그런데도 두는 이유는, 이번에 자리를 못 잡은 분이나 조건이
   *    안 맞는 분의 연락처를 **계속 보관하려면 별도 동의가 있어야 하기 때문**이다
   *    (개인정보보호법 §22 — 필수와 선택을 구분해 받는다).
   *    동의가 없으면 그 연락처는 목적을 다한 시점에 지운다.
   */
  const [marketing, setMarketing] = useState(false);
  /**
   * 스팸 봇용 미끼. 사람은 볼 수도 탭으로 닿을 수도 없는 칸이라 **항상 빈 문자열**이어야 한다.
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
    if (submitting) return;

    const found: Record<string, string> = {};
    const nameErr = validateName(name);
    const telErr = validateTel(tel);
    const birthErr = validateBirth(birth);
    if (nameErr) found.name = nameErr;
    if (telErr) found.tel = telErr;
    if (birthErr) found.birth = birthErr;
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
          name: name.trim(),
          phone: tel.replace(/\D/g, ""),
          gender,
          birth,
          privacy_agreed: true,
          marketing_agreed: marketing,
          _gotcha: gotcha,
        }),
      });
      // 같은 번호로 두 번 — 실패가 아니라 "이미 접수돼 있다"는 사실이다.
      // 일반 오류와 같은 문구를 띄우면 될 때까지 다시 누르게 된다.
      if (res.status === 409) {
        setStatus("duplicate");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      /* 성공했을 때만 센다 — 전송 실패는 신청이 아니다.
         성별만 싣는 이유: 남10·여10이라 성비를 매일 봐야 한다.
         이름·연락처·생년월일은 절대 싣지 않는다. */
      track("apply_submit", { gender: gender === "M" ? "남" : "여" });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="confirm">
        <div className="confirm__title">사전 등록이 접수되었습니다</div>
        <p>
          지금은 <b>사전 등록</b>입니다. 참가비를 받지 않습니다. 9월 28일에
          등록해주신 분들께 질문지와 참가 안내를 한 번에 보내드립니다.
        </p>
        {/* 연락처를 잘못 적었을 때 돌아갈 길. 입력값은 그대로 남아 있다. */}
        <button
          type="button"
          className="confirm__back"
          onClick={() => setStatus("idle")}
        >
          잘못 입력하셨나요? 다시 등록하기
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
          휴대전화 번호
        </label>
        <input
          id="tel"
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="input"
          placeholder="휴대전화 번호"
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
            checked={gender === "M"}
            onChange={() => {
              setGender("M");
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
            checked={gender === "F"}
            onChange={() => {
              setGender("F");
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

      {/* 날짜 입력은 placeholder가 보이지 않는다 — 라벨을 눈에 보이게 둔다.
          sr-only로 감추면 무슨 칸인지 알 수 없는 빈 상자가 된다. */}
      <div className="field">
        <label className="field__label" htmlFor="birth">
          생년월일
        </label>
        <input
          id="birth"
          name="birth"
          type="date"
          className="input"
          value={birth}
          onChange={(e) => setBirth(e.target.value)}
          onBlur={() => checkField("birth", validateBirth(birth))}
          aria-invalid={Boolean(errors.birth)}
          aria-describedby={errors.birth ? "birth-error" : undefined}
        />
        {errors.birth && (
          <p id="birth-error" className="field__error" role="alert">
            {errors.birth}
          </p>
        )}
      </div>

      {/* 이름·연락처·생년월일을 실제로 수집하므로 동의를 받는다.
          🔴 **참가 조건으로 걸리는 동의는 이 하나뿐이다.** 아래 선택 동의는
             체크하지 않아도 제출된다 — 그 성질을 바꾸지 말 것. */}
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

      <div className="field">
        <div className="consent">
          <input
            type="checkbox"
            id="marketing"
            className="consent__input"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <label className="consent__label" htmlFor="marketing">
            이번 회차에 함께하지 못하더라도 다음 회차 안내를 받겠습니다{" "}
            <span className="consent__opt">(선택)</span>
          </label>
        </div>
      </div>

      {/* 🔴 「보유 기간 — 행사 종료 후 30일 이내 파기」 한 줄로 되돌리지 말 것. 셋이 걸린다 —
             ① 참가 자격(연령·미혼) 확인이 **이용 목적에 없으면** 미혼 조건을 거는 근거가 없다
             ② 참가 자격 분쟁은 30일 뒤에 온다. 그때 아무 기록이 없다
             ③ 참가비를 받으므로 계약·결제 기록은 5년 보존 의무다(전자상거래법 제6조).
                30일에 지우겠다고 고지하면 **고지 자체가 위반**이 된다.
             ⚠️ 여기 적은 기간은 실제로 파기 배치가 돌아야 성립한다 — 고지만 하고
                안 지우면 그 고지가 새 문제가 된다. 폼 9와 DB를 공유하므로 배치도 하나로 묶는다.
             ⚠️ 변호사 검증 전 초안이다(2026-08-24 법적 점검 §4-1). */}
      <details className="rules">
        <summary>
          수집 항목 · 이용 목적 · 보유 기간 보기<span className="plus">+</span>
        </summary>
        <div data-answer>
          <p>
            <b>수집 항목</b> — 이름, 휴대전화 번호, 성별, 생년월일
            <br />
            <b>이용 목적</b> — 사전 등록 접수, 참가 자격(연령·미혼) 확인, 참가비
            입금 안내, 행사 진행 안내
            <br />
            <b>보유 기간</b> — 항목마다 다릅니다.
          </p>
          <ul>
            <li>
              사전 등록 기록(이름, 휴대전화 번호, 성별, 생년월일)과 동의 이력 —{" "}
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
          <p>동의를 거부하실 수 있으며, 이 경우 사전 등록 접수가 어렵습니다.</p>
          <p>
            <b>다음 회차 안내(선택)</b>에 동의하시면 이름과 휴대전화 번호를 동의를
            철회하실 때까지 보관하고, 다음 회차가 열릴 때 안내드립니다. 동의하지
            않으셔도 이번 회차 신청에는 아무 영향이 없습니다.
          </p>
          <p>
            사전 질문 폼을 보내드릴 때 혼인 여부·직업을 추가로 여쭙습니다. 그
            화면에서 다시 안내드리고 동의를 받습니다.
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

      <button type="submit" className="pill form__submit" disabled={submitting}>
        {submitting ? "보내는 중…" : "사전 등록하기"}
      </button>

      {/* 🔴 이 단계에서 돈 얘기를 하지 않는다. 「사전 등록」이지 「신청 확정」이 아니다. */}
      <p className="form__notice" role="status">
        지금은 사전 등록입니다. 참가비를 받지 않습니다.
      </p>

      {status === "duplicate" && (
        <p className="form__error" role="alert">
          이미 등록된 번호입니다. 접수돼 있으니 따로 다시 하지 않으셔도 됩니다.
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
