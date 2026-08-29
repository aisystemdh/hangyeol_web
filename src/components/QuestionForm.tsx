"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import st from "./form9.module.css";

/**
 * 폼 9 · 2단계 — 사전 10문항.
 *
 * 🔴 **입금이 확인된 사람에게만 열린다.** 문항은 영업비밀이라 서버가 `status='confirmed'`
 *    를 확인한 뒤에만 내려준다. 이 파일에는 문항이 한 글자도 없다 — 전부 서버에서 온다.
 * 🔴 문항을 여기에 상수로 옮기지 말 것. 그 순간 브라우저 번들에 박혀 다 샌다.
 */

type Choice = { n: 1 | 2 | 3; text: string };
type Question = {
  code: string; topic: string; scene: string;
  paired?: { label: string; choices: Choice[] }[];
  choices?: Choice[];
};
// 서버가 내려주는 문구 묶음. 구조는 form9-copy.ts의 COPY와 같다.
type Copy = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type Loaded = {
  ok: boolean;
  submitted?: boolean;
  error?: string;
  name?: string;
  questions?: Question[];
  pairedIndexes?: number[];
  copy?: Copy;
};

/** 일반 문항은 숫자, 페어드 문항은 [나, 상대]. */
type Answer = number | [number | null, number | null] | null;

export default function QuestionForm({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [step, setStep] = useState(-1); // -1 시작 · 0~n-1 문항 · n 비교표동의 · 999 완료
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const draftKey = `hg-q-${token}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/q/${token}`);
      const j: Loaded = await r.json().catch(() => ({ ok: false, error: "server" }));
      if (!alive) return;
      setData(j);
      if (j.questions) {
        // 중간에 닫아도 답이 남아 있어야 한다. 서버에는 마지막에 한 번만 보낸다.
        let saved: Answer[] | null = null;
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) saved = JSON.parse(raw) as Answer[];
        } catch { /* 손상된 초안은 그냥 버린다 */ }
        setAnswers(
          saved && saved.length === j.questions.length
            ? saved
            : j.questions.map((qq) => (qq.paired ? [null, null] : null)),
        );
      }
    })();
    return () => { alive = false; };
  }, [token, draftKey]);

  const save = (next: Answer[]) => {
    setAnswers(next);
    try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* 사파리 비공개 모드 */ }
  };

  const pick = (i: number, value: number, pairIdx?: number) => {
    const next = [...answers];
    if (pairIdx === undefined) next[i] = value;
    else {
      const prev = Array.isArray(next[i])
        ? ([...(next[i] as [number | null, number | null])] as [number | null, number | null])
        : ([null, null] as [number | null, number | null]);
      prev[pairIdx] = value;
      next[i] = prev;
    }
    save(next);
  };

  const submit = async () => {
    setBusy(true); setErr("");
    const r = await fetch(`/api/q/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, consent }),
    });
    setBusy(false);
    if (r.status === 409) { setStep(999); return; }
    if (!r.ok) { setErr("보내지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
    try { localStorage.removeItem(draftKey); } catch { /* noop */ }
    setStep(999);
  };

  if (!data) return <Shell><p className={st.center}>불러오는 중…</p></Shell>;

  const C = data.copy ?? {};
  if (data.error === "unknown_token")
    return <Shell><Msg t="링크를 확인해 주세요" b="안내드린 링크가 맞는지 확인해 주시고, 계속 안 되면 이 채팅으로 알려주세요." /></Shell>;
  // 🔴 「돈을 안 냈다」고 말하지 않는다 — 이미 넣고 확인을 기다리는 중일 수 있다.
  if (data.error === "not_paid")
    return <Shell><Msg t={C.notPaid.title} b={C.notPaid.body} /></Shell>;
  if (data.submitted || step === 999)
    return <Shell><Msg t={C.qDone.title} b={C.qDone.body} /></Shell>;
  if (!data.ok)
    return <Shell><p className={st.center}>잠시 문제가 있었습니다. 다시 열어주세요.</p></Shell>;

  const qs = data.questions ?? [];
  const total = qs.length;

  if (step === -1) {
    return (
      <Shell>
        <h1 className={st.title}>{C.qStart.title}</h1>
        <p className={st.lead}>{C.qStart.lead}</p>
        {C.qStart.body.map((line: string) => <p key={line} className={st.body}>{line}</p>)}
        <div className={st.nav}>
          <button className="pill" onClick={() => setStep(0)}>{C.qStart.cta}</button>
        </div>
      </Shell>
    );
  }

  if (step === total) {
    return (
      <Shell>
        <h1 className={st.title}>{C.compare.title}</h1>
        {C.compare.body.map((line: string) => <p key={line} className={st.body}>{line}</p>)}
        <div className="consent" style={{ marginTop: 20 }}>
          <input type="checkbox" id="c-cmp" className="consent__input" checked={consent}
                 onChange={(e) => setConsent(e.target.checked)} />
          <label className="consent__label" htmlFor="c-cmp">{C.compare.consent}</label>
        </div>
        <p className={st.note} style={{ paddingLeft: 0, marginTop: 10 }}>{C.compare.note}</p>
        {err && <p className={st.error} role="alert">{err}</p>}
        <div className={st.nav}>
          <button type="button" className={st.back} onClick={() => setStep(total - 1)}>{C.questions.prev}</button>
          <button className="pill" disabled={busy} onClick={submit}>
            {busy ? "보내는 중…" : C.compare.cta}
          </button>
        </div>
      </Shell>
    );
  }

  const q = qs[step];
  const a = answers[step];
  const answered = q.paired
    ? Array.isArray(a) && a[0] !== null && a[1] !== null
    : typeof a === "number";

  return (
    <Shell>
      {/* 「몇 개 남았나」를 모르면 중간에 그만두는 사람이 늘어난다. */}
      <div className={st.progress}>
        <div className={st.progressBar}>
          <div className={st.progressFill} style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <span className={st.progressNum}>
          {C.questions.progress.replace("{n}", String(step + 1)).replace("{total}", String(total))}
        </span>
      </div>

      <div className={st.topic}>{q.topic}</div>
      <p className={st.scene}>{q.scene}</p>

      {q.paired ? (
        // 🔴 4번·6번만 페어드다. 「나」와 「상대에게 바라는 것」을 따로 묻는다.
        q.paired.map((grp, pi) => (
          <div key={grp.label}>
            <div className={st.pairLabel}>{grp.label}</div>
            <div className={st.choices}>
              {grp.choices.map((c) => {
                const on = Array.isArray(a) && a[pi] === c.n;
                return (
                  <button key={c.n} type="button" onClick={() => pick(step, c.n, pi)}
                          className={on ? `${st.choice} ${st.choiceOn}` : st.choice}>
                    {c.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className={st.choices}>
          {(q.choices ?? []).map((c) => (
            <button key={c.n} type="button" onClick={() => pick(step, c.n)}
                    className={a === c.n ? `${st.choice} ${st.choiceOn}` : st.choice}>
              {c.text}
            </button>
          ))}
        </div>
      )}

      <div className={st.nav}>
        <button type="button" className={st.back} disabled={step === 0}
                onClick={() => setStep(step - 1)}>{C.questions.prev}</button>
        <button className="pill" disabled={!answered} onClick={() => setStep(step + 1)}>
          {C.questions.next}
        </button>
      </div>
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
