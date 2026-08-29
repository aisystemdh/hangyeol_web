"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import st from "./form9.module.css";

/**
 * 폼 9 · 1단계 — 참가 신청 확인 + 결제 정보.
 *
 * 🔴 이 화면에는 **문항이 없다.** 문항은 입금이 확인된 뒤 2단계(`/q/:token`)에서만 뜬다.
 * 🔴 문구는 서버가 내려준 것만 쓴다. 여기에 문자열을 새로 적지 말 것 —
 *    문안 정본은 `src/lib/form9-copy.ts` 한 곳이다.
 */

type Biz = {
  bank: string; account: string; holder: string;
  name: string; ceo: string; regno: string; mailorder: string; address: string;
  missing: string[];
};

// 서버가 내려주는 문구 묶음. 구조는 form9-copy.ts의 COPY와 같다.
type Copy = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Loaded = {
  ok: boolean;
  submitted?: boolean;
  closed?: boolean;
  name?: string;
  due_at?: string | null;
  prefill?: { name: string; gender: "M" | "F"; phone: string; birth: string };
  copy?: Copy;
  biz?: Biz;
  error?: string;
};

type Step = "start" | "identity" | "payment" | "done" | "full";

/** 「2026년 9월 2일(화) 오후 6시」 처럼 사람이 읽는 형태로. */
function fmtDue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const h = d.getHours();
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${
    h < 12 ? "오전" : "오후"
  } ${h % 12 === 0 ? 12 : h % 12}시`;
}

export default function PreForm({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [finalDepositor, setFinalDepositor] = useState("");

  // 신원
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F" | null>(null);
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [marital, setMarital] = useState<"미혼" | "기혼" | null>(null);
  const [job, setJob] = useState("");
  const [email, setEmail] = useState("");
  const [privacyOk, setPrivacyOk] = useState(false);
  const [truthOk, setTruthOk] = useState(false);
  // 결제
  const [sameDepositor, setSameDepositor] = useState<boolean | null>(null);
  const [depositor, setDepositor] = useState("");
  const [refundOk, setRefundOk] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/pre/${token}`);
      const j: Loaded = await r.json().catch(() => ({ ok: false, error: "server" }));
      if (!alive) return;
      setData(j);
      if (j.prefill) {
        setName(j.prefill.name);
        setGender(j.prefill.gender);
        setPhone(j.prefill.phone);
        setBirth(j.prefill.birth);
      }
      if (j.submitted) {
        setStep("done");
        setDueAt(j.due_at ?? null);
        setFinalDepositor(j.name ?? "");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const submit = async () => {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/pre/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          name: name.trim(), phone: phone.replace(/\D/g, ""), birth, gender, marital,
          job: job.trim(), email: email.trim() || null,
          email_agreed: Boolean(email.trim()),
          privacy_agreed: privacyOk, truth_agreed: truthOk,
        },
        payment: {
          depositor_name: sameDepositor === false ? depositor.trim() : null,
          refund_policy_agreed: refundOk,
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    // 🔴 자리가 없으면 결제 안내를 띄우지 않는다. 자리 없이 돈을 받으면 환불 분쟁이 된다.
    if (r.status === 409 && j.error === "full") { setStep("full"); return; }
    if (r.status === 409) { setStep("done"); return; }
    if (!r.ok) { setErr("보내지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
    setDueAt(j.due_at ?? null);
    setFinalDepositor(j.depositor ?? name.trim());
    setStep("done");
  };

  if (!data) return <Shell><p className={st.center}>불러오는 중…</p></Shell>;

  const C = data.copy ?? {};
  if (!data.ok && data.error === "unknown_token") return <Shell><Msg t={C.unknown?.title ?? "링크를 확인해 주세요"} b={C.unknown?.body ?? ""} /></Shell>;
  if (data.closed) return <Shell><Msg t={C.closed.title} b={C.closed.body} /></Shell>;
  if (step === "full") return <Shell><Msg t={C.full.title} b={C.full.body} /></Shell>;
  if (!data.ok) return <Shell><p className={st.center}>잠시 문제가 있었습니다. 다시 열어주세요.</p></Shell>;

  const biz = data.biz;
  const identityOk =
    name.trim().length >= 2 && gender && /^010\d{8}$/.test(phone.replace(/\D/g, "")) &&
    /^\d{4}-\d{2}-\d{2}$/.test(birth) && marital && job.trim() && privacyOk && truthOk;
  const paymentOk =
    refundOk && (sameDepositor === true || (sameDepositor === false && depositor.trim().length >= 2));

  return (
    <Shell>
      {/* 🔴 계좌·사업자 값이 비면 조용히 빈칸으로 내보내지 않는다.
             전자상거래법 §10①은 「소비자가 쉽게 알 수 있도록」 표시하라고 정한다. */}
      {biz && biz.missing.length > 0 && (
        <div className={st.bizWarn}>
          ⚠️ 개발 확인용 — 참가자에게 이대로 내보내면 안 됩니다.
          <br />
          빠진 값: {biz.missing.join(" · ")}
        </div>
      )}

      {step === "start" && (
        <>
          <h1 className={st.title}>{C.start.title}</h1>
          <p className={st.lead}>{C.start.lead}</p>
          {C.start.body.map((line: string) => (
            <p key={line} className={st.body}>{line}</p>
          ))}
          <div className={st.nav}>
            <button className="pill" onClick={() => setStep("identity")}>{C.start.cta}</button>
          </div>
        </>
      )}

      {step === "identity" && (
        <>
          <h1 className={st.title}>{C.identity.title}</h1>
          <p className={st.lead}>{C.identity.lead}</p>

          <div className={st.field}>
            <label className={st.label} htmlFor="f-name">{C.identity.fields.name}</label>
            <input id="f-name" className="input" value={name} maxLength={20}
                   onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={st.field}>
            <span className={st.label}>{C.identity.fields.gender}</span>
            <div className={st.seg}>
              {(["M", "F"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)}
                        className={gender === g ? st.segOn : undefined}>
                  {g === "M" ? "남" : "여"}
                </button>
              ))}
            </div>
          </div>

          <div className={st.field}>
            <label className={st.label} htmlFor="f-phone">{C.identity.fields.phone}</label>
            <input id="f-phone" className="input" type="tel" inputMode="tel" value={phone}
                   maxLength={20} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className={st.field}>
            <label className={st.label} htmlFor="f-birth">{C.identity.fields.birth}</label>
            <input id="f-birth" className="input" type="date" value={birth}
                   onChange={(e) => setBirth(e.target.value)} />
          </div>

          <div className={st.field}>
            <span className={st.label}>{C.identity.fields.marital}</span>
            <div className={st.seg}>
              {(["미혼", "기혼"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMarital(m)}
                        className={marital === m ? st.segOn : undefined}>{m}</button>
              ))}
            </div>
            {/* 🟡 기혼 선택을 막지 않는다. 막으면 거짓으로 적게 만든다(2026-08-24 정책). */}
            {marital === "기혼" && <p className={st.note}>{C.identity.maritalWarning}</p>}
          </div>

          <div className={st.field}>
            <label className={st.label} htmlFor="f-job">{C.identity.fields.job}</label>
            <input id="f-job" className="input" value={job} maxLength={30}
                   onChange={(e) => setJob(e.target.value)} />
            <p className={st.note}>{C.identity.jobNote}</p>
          </div>

          <div className={st.field}>
            <label className={st.label} htmlFor="f-email">{C.identity.fields.email}</label>
            <input id="f-email" className="input" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} />
            <p className={st.note}>{C.identity.emailNote}</p>
          </div>

          <div className="consent">
            <input type="checkbox" id="c-privacy" className="consent__input" checked={privacyOk}
                   onChange={(e) => setPrivacyOk(e.target.checked)} />
            <label className="consent__label" htmlFor="c-privacy">{C.identity.consents.privacy}</label>
          </div>
          <div className="consent">
            <input type="checkbox" id="c-truth" className="consent__input" checked={truthOk}
                   onChange={(e) => setTruthOk(e.target.checked)} />
            <label className="consent__label" htmlFor="c-truth">{C.identity.consents.truth}</label>
          </div>
          <p className={st.note}>{C.identity.consents.truthDetail}</p>

          <div className={st.nav}>
            <button type="button" className={st.back} onClick={() => setStep("start")}>이전</button>
            <button className="pill" disabled={!identityOk}
                    onClick={() => setStep("payment")}>{C.identity.cta}</button>
          </div>
        </>
      )}

      {step === "payment" && (
        <>
          <h1 className={st.title}>{C.payment.title}</h1>
          <div className={st.facts}>
            {C.payment.facts.map((f: { k: string; v: string }) => (
              <div key={f.k} className={st.factRow}>
                <span className={st.factKey}>{f.k}</span>
                <span className={st.factVal}>{f.v}</span>
              </div>
            ))}
          </div>

          <p className={st.body}>{C.payment.depositorQuestion}</p>
          <div className={st.field}>
            <div className={st.choices}>
              <button type="button" onClick={() => setSameDepositor(true)}
                      className={sameDepositor === true ? `${st.choice} ${st.choiceOn}` : st.choice}>
                {C.payment.depositorSame.replace("{name}", name.trim())}
              </button>
              <button type="button" onClick={() => setSameDepositor(false)}
                      className={sameDepositor === false ? `${st.choice} ${st.choiceOn}` : st.choice}>
                {C.payment.depositorDiff}
              </button>
            </div>
            {sameDepositor === false && (
              <input className="input" placeholder={C.payment.depositorLabel} value={depositor}
                     maxLength={20} onChange={(e) => setDepositor(e.target.value)} />
            )}
          </div>

          {/* ⚠️ 동의 문구가 「**아래** 취소·환불 규정을 확인했습니다」다.
                 규정을 위에 두면 문구와 화면이 어긋난다 — 정본(폼9 최종본 §3)의 순서를 지킨다. */}
          <div className="consent">
            <input type="checkbox" id="c-refund" className="consent__input" checked={refundOk}
                   onChange={(e) => setRefundOk(e.target.checked)} />
            <label className="consent__label" htmlFor="c-refund">{C.payment.refundConsent}</label>
          </div>

          <div className={st.refund}>
            {C.payment.refundRows.map((r: { when: string; what: string }) => (
              <div key={r.when} className={st.refundRow}>
                <span>{r.when}</span><span>{r.what}</span>
              </div>
            ))}
            {C.payment.refundNotes.map((n: string) => (
              <p key={n} className={st.refundNote}>※ {n}</p>
            ))}
          </div>

          {err && <p className={st.error} role="alert">{err}</p>}
          <div className={st.nav}>
            <button type="button" className={st.back} onClick={() => setStep("identity")}>이전</button>
            <button className="pill" disabled={!paymentOk || busy} onClick={submit}>
              {busy ? "보내는 중…" : "자리 잡기"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <h1 className={st.title}>{C.done?.title ?? C.already?.title}</h1>
          <p className={st.lead}>{C.done?.lead}</p>

          {biz && (
            <div className={st.account}>
              <div className={st.factRow}>
                <span className={st.factKey}>입금 계좌</span>
                <span className={st.factVal}>{biz.bank} {biz.account || "—"}</span>
              </div>
              <div className={st.factRow}>
                <span className={st.factKey}>예금주</span><span className={st.factVal}>{biz.holder}</span>
              </div>
              <div className={st.factRow}>
                <span className={st.factKey}>금액</span><span className={st.factVal}>39,000원</span>
              </div>
              <div className={st.factRow}>
                <span className={st.factKey}>입금자명</span>
                <span className={st.factVal}>{finalDepositor}</span>
              </div>
              <div className={st.factRow} style={{ borderBottom: "none" }}>
                <span className={st.factKey}>입금 기한</span>
                <span className={st.factVal}>{fmtDue(dueAt) || "안내드린 시각으로부터 3일"}</span>
              </div>
            </div>
          )}

          <p className={st.body}><b>{C.done?.checkTitle}</b></p>
          <ul className={st.checks}>
            {(C.done?.checks ?? []).map((c: string) => (
              <li key={c}>{c.replace("{depositor}", finalDepositor)}</li>
            ))}
          </ul>
          <p className={st.body} style={{ marginTop: 20 }}>{C.done?.tail}</p>

          {biz && biz.regno && (
            <p className={st.note} style={{ paddingLeft: 0, marginTop: 28 }}>
              {biz.name} · 사업자등록번호 {biz.regno} · 대표 {biz.ceo}
            </p>
          )}
        </>
      )}
    </Shell>
  );
}

/**
 * 폼 화면 공통 껍데기. 헤더를 뺐으므로 로고로 「진짜 한결」임을 알린다.
 *
 * ⚠️ `<main>`이 아니라 `<div>`다. layout.tsx가 이미 `<main id="main">`으로 감싸고 있어서
 *    여기서 또 쓰면 `<main>`이 겹친다 — 한 문서에 두 개면 스크린리더가 「본문」을
 *    어디로 잡을지 알 수 없다.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={st.wrap}>
      <div className={st.brand}>
        <Image src="/hangyeol-mark-v2.png" alt="" width={28} height={25} priority />
        <span className={st.brandName}>한결</span>
      </div>
      {children}
    </div>
  );
}

function Msg({ t, b }: { t: string; b: string }) {
  return (
    <div style={{ padding: "48px 0" }}>
      <h1 className={st.title}>{t}</h1>
      <p className={st.lead}>{b}</p>
    </div>
  );
}
