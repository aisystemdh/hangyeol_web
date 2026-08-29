"use client";

import { useState } from "react";
import st from "../admin.module.css";

export default function LoginForm() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) {
      window.location.href = "/admin";
    } else {
      setErr("비밀번호가 맞지 않습니다.");
      setBusy(false);
    }
  };

  return (
    <main className={st.loginWrap}>
      <form className={st.loginBox} onSubmit={submit}>
        <h1 className={st.loginTitle}>한결 운영</h1>
        <p className={st.loginNote}>참가자 개인정보가 있는 화면입니다.</p>
        <input
          type="password"
          className={st.input}
          placeholder="비밀번호"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
        />
        <button type="submit" className={st.btnPrimary} disabled={busy || !pw}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
        {err && (
          <p className={st.err} role="alert">
            {err}
          </p>
        )}
      </form>
    </main>
  );
}
