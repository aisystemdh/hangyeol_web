"use client";

import { useState } from "react";
import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MeRegisterApiResponse, MeRegisterData } from "@/lib/me-response";

/**
 * 우선순위 5 — 정식등록 화면 (이슈 #33).
 *
 * 🔴 **여기에 계좌·문항이 없다.** `data`의 타입(`MeRegisterData`)에 애초에 그 필드가
 *    없어서, 실수로 넣으려 해도 타입 검사가 막는다(`docs/decisions/003…` §6 정보
 *    노출 표 — 등록 화면은 사업자 신원·환불 규정·금액까지만). 계좌는 등록이 끝난
 *    **뒤에** `MeClient`가 `GET`을 다시 불러 새로 고른 "payment" 화면에서만 온다.
 *
 * 🔴 **환불 동의 없이는 제출 버튼이 눌리지 않는다.** 순서가 이유다 — 환불 규정에
 *    동의하지 않은 사람에게 돈부터 받으면, 나중에 다툼이 났을 때 근거가 없다
 *    (`docs/decisions/003…` §6, 이슈 #33 본문).
 */

type Marital = "미혼" | "기혼" | null;
// 🔴 "success"를 따로 둔다 — 등록 자체(POST)는 끝났지만 다음 화면을 고르려면
//    `onRegistered()`가 부른 `GET`이 한 번 더 돌아야 한다(`MeClient.tsx`). 그 사이를
//    "submitting"으로 두면 "아직도 보내는 중인가" 하는 정지 신호로 읽힌다.
type Status = "idle" | "submitting" | "success" | "error";

function validateJob(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 1) return "직업을 입력해주세요.";
  if (v.length > 40) return "직업은 40자 이내로 입력해주세요.";
  return null;
}

function validateEmail(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null; // 선택 항목이다.
  if (v.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "이메일 주소를 확인해주세요.";
  }
  return null;
}

function validateDepositorName(raw: string): string | null {
  if (raw.trim().length > 20) return "입금자명은 20자 이내로 입력해주세요.";
  return null;
}

export default function MeRegister({
  token,
  data,
  onRegistered,
}: {
  token: string;
  data: MeRegisterData;
  onRegistered: () => void | Promise<void>;
}) {
  // 제어 컴포넌트로 둔다 — 제출이 서버 오류(예: `bad_email`)로 거절돼도 입력값이
  // 그대로 남아 있어야 처음부터 다시 치지 않는다(`ApplyForm.tsx`와 같은 이유).
  const [marital, setMarital] = useState<Marital>(null);
  const [job, setJob] = useState("");
  const [email, setEmail] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [truthAgreed, setTruthAgreed] = useState(false);
  const [refundAgreed, setRefundAgreed] = useState(false);
  const [emailAgreed, setEmailAgreed] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const submitting = status === "submitting" || status === "success";
  const emailProvided = email.trim().length > 0;

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
    if (!marital) found.marital = "혼인 여부를 선택해주세요.";
    const jobErr = validateJob(job);
    if (jobErr) found.job = jobErr;
    const emailErr = validateEmail(email);
    if (emailErr) found.email = emailErr;
    const depositorErr = validateDepositorName(depositorName);
    if (depositorErr) found.depositorName = depositorErr;
    if (!truthAgreed) found.truthAgreed = "입력하신 내용이 사실임에 동의해주세요.";
    if (!refundAgreed) found.refundAgreed = "환불 규정에 동의해주세요.";
    if (emailProvided && !emailAgreed) {
      found.emailAgreed = "이메일 수신에 동의해주세요.";
    }

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setServerError(null);
    setStatus("submitting");
    try {
      const res = await fetch(`/api/me/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          marital,
          job: job.trim(),
          email: email.trim() || null,
          depositor_name: depositorName.trim() || null,
          truth_agreed: truthAgreed,
          refund_agreed: refundAgreed,
          // 이메일을 안 적었으면 동의를 물을 대상이 없다 — 체크 여부와 무관하게
          // 서버는 이 값을 보지 않는다(`route.ts`의 `email &&` 검사).
          email_agreed: emailProvided ? emailAgreed : undefined,
        }),
      });
      const body: MeRegisterApiResponse | null = await res.json().catch(() => null);
      if (!body || body.ok !== true) {
        setServerError(
          body && "message" in body ? body.message : "잠시 문제가 있었습니다. 다시 시도해주세요.",
        );
        setStatus("error");
        return;
      }
      // 🔴 화면 전환은 서버가 다시 판정한다 — 여기서 직접 "payment"로 넘기지 않는다.
      //    등록(POST) 자체는 이미 끝났으니 버튼 문구를 바꿔, 다음 화면을 불러오는
      //    이 짧은 순간이 "아직도 보내는 중"으로 보이지 않게 한다.
      setStatus("success");
      await onRegistered();
    } catch {
      setServerError("잠시 문제가 있었습니다. 다시 시도해주세요.");
      setStatus("error");
    }
  };

  return (
    <MeShell>
      <p className={s.eyebrow}>참가 등록</p>
      <h1 className={s.title}>{data.name}님, 등록을 마쳐주세요</h1>
      <p className={s.body}>
        참가비 {data.price} · {data.ageRange} · 미혼 대상입니다. 등록을 마치면
        입금 계좌를 안내해 드립니다.
      </p>

      <div className={s.facts}>
        {data.refund.map((r) => (
          <div className={s.fact} key={r.when}>
            <span className={s.factKey}>{r.when}</span>
            <span className={s.factVal}>{r.what}</span>
          </div>
        ))}
      </div>
      {data.refundLaw.map((line) => (
        <p className={s.body} key={line}>
          {line}
        </p>
      ))}

      <p className={s.body}>
        {data.bizIdentity.name} · 대표 {data.bizIdentity.ceo}
        {data.bizIdentity.regno ? ` · 사업자등록번호 ${data.bizIdentity.regno}` : ""}
      </p>
      {data.bizIdentity.missing.length > 0 && (
        <p className={s.warn}>
          표시 의무 정보가 비어 있습니다: {data.bizIdentity.missing.join(", ")}
        </p>
      )}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <fieldset className="gender">
            <legend className="field__label">혼인 여부</legend>
            <input
              type="radio"
              id="marital-single"
              name="marital"
              className="gender__input"
              checked={marital === "미혼"}
              onChange={() => {
                setMarital("미혼");
                checkField("marital", null);
              }}
            />
            <label className="gender__btn" htmlFor="marital-single">
              미혼
            </label>
            <input
              type="radio"
              id="marital-married"
              name="marital"
              className="gender__input"
              checked={marital === "기혼"}
              onChange={() => {
                setMarital("기혼");
                checkField("marital", null);
              }}
            />
            <label className="gender__btn" htmlFor="marital-married">
              기혼
            </label>
          </fieldset>
          {errors.marital && (
            <p className="field__error" role="alert">
              {errors.marital}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="job">
            직업
          </label>
          <input
            id="job"
            name="job"
            type="text"
            className="input"
            placeholder="예: 회사원"
            maxLength={40}
            value={job}
            onChange={(e) => setJob(e.target.value)}
            onBlur={() => checkField("job", validateJob(job))}
            aria-invalid={Boolean(errors.job)}
            aria-describedby={errors.job ? "job-error" : undefined}
          />
          {errors.job && (
            <p id="job-error" className="field__error" role="alert">
              {errors.job}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="email">
            이메일 <span className="consent__opt">(선택 — 리포트를 메일로도 받고 싶다면)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            placeholder="이메일"
            maxLength={60}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => checkField("email", validateEmail(email))}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="field__error" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="depositor-name">
            입금자명 <span className="consent__opt">(선택 — 본인 명의가 아니라면)</span>
          </label>
          <input
            id="depositor-name"
            name="depositor-name"
            type="text"
            className="input"
            placeholder="본인 명의로 입금하시면 비워두세요"
            maxLength={20}
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            onBlur={() => checkField("depositorName", validateDepositorName(depositorName))}
            aria-invalid={Boolean(errors.depositorName)}
            aria-describedby={errors.depositorName ? "depositor-name-error" : undefined}
          />
          {errors.depositorName && (
            <p id="depositor-name-error" className="field__error" role="alert">
              {errors.depositorName}
            </p>
          )}
        </div>

        <div className="field">
          <div className="consent">
            <input
              type="checkbox"
              id="truth-agreed"
              className="consent__input"
              checked={truthAgreed}
              onChange={(e) => {
                setTruthAgreed(e.target.checked);
                if (e.target.checked) checkField("truthAgreed", null);
              }}
              aria-describedby={errors.truthAgreed ? "truth-agreed-error" : undefined}
            />
            <label className="consent__label" htmlFor="truth-agreed">
              위에 입력한 내용이 사실입니다{" "}
              <span className="consent__req">(필수)</span>
            </label>
          </div>
          {errors.truthAgreed && (
            <p id="truth-agreed-error" className="field__error" role="alert">
              {errors.truthAgreed}
            </p>
          )}
        </div>

        <div className="field">
          <div className="consent">
            <input
              type="checkbox"
              id="refund-agreed"
              className="consent__input"
              checked={refundAgreed}
              onChange={(e) => {
                setRefundAgreed(e.target.checked);
                if (e.target.checked) checkField("refundAgreed", null);
              }}
              aria-describedby={errors.refundAgreed ? "refund-agreed-error" : undefined}
            />
            <label className="consent__label" htmlFor="refund-agreed">
              위 환불 규정에 동의합니다{" "}
              <span className="consent__req">(필수)</span>
            </label>
          </div>
          {errors.refundAgreed && (
            <p id="refund-agreed-error" className="field__error" role="alert">
              {errors.refundAgreed}
            </p>
          )}
        </div>

        {emailProvided && (
          <div className="field">
            <div className="consent">
              <input
                type="checkbox"
                id="email-agreed"
                className="consent__input"
                checked={emailAgreed}
                onChange={(e) => {
                  setEmailAgreed(e.target.checked);
                  if (e.target.checked) checkField("emailAgreed", null);
                }}
                aria-describedby={errors.emailAgreed ? "email-agreed-error" : undefined}
              />
              <label className="consent__label" htmlFor="email-agreed">
                입력하신 이메일로 리포트를 받는 데 동의합니다{" "}
                <span className="consent__req">(필수)</span>
              </label>
            </div>
            {errors.emailAgreed && (
              <p id="email-agreed-error" className="field__error" role="alert">
                {errors.emailAgreed}
              </p>
            )}
          </div>
        )}

        <button type="submit" className="pill form__submit" disabled={submitting}>
          {status === "success"
            ? "등록 완료! 불러오는 중…"
            : status === "submitting"
              ? "등록하는 중…"
              : "등록 완료"}
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
