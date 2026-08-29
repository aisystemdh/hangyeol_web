"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminRow, Counts } from "@/lib/admin-data";
import st from "./admin.module.css";

const STATUS_KO: Record<string, string> = {
  pre_registered: "사전등록", approved: "승인", awaiting_payment: "입금대기",
  confirmed: "확정", waitlist: "대기", rejected: "부적격",
  expired: "기한초과", refund_requested: "환불요청", refunded: "환불완료",
};

const NEXT: Record<string, string[]> = {
  pre_registered: ["approved", "waitlist", "rejected"],
  approved: ["awaiting_payment", "waitlist", "rejected"],
  awaiting_payment: ["confirmed", "expired", "waitlist"],
  waitlist: ["approved"], confirmed: ["refund_requested"],
  refund_requested: ["refunded"], expired: ["waitlist"],
  rejected: [], refunded: [],
};

const FILTERS = ["전체", "확정", "입금대기", "사전등록", "대기", "그 밖"] as const;

export default function Board({ initial }: { initial: { counts: Counts; items: AdminRow[] } }) {
  const [rows, setRows] = useState<AdminRow[]>(initial.items);
  const [counts, setCounts] = useState<Counts | null>(initial.counts);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  /**
   * 🔴 공유 비밀번호라 서버는 누가 눌렀는지 모른다. 여기서 이름을 받아 기록에 남긴다.
   *
   * ⚠️ 이 칸만 React 상태로 두지 않고 DOM을 직접 읽는다. localStorage 값을 상태
   *    초깃값으로 쓰면 서버 렌더에는 없는 값이라 하이드레이션이 어긋나고,
   *    이펙트에서 setState로 채우면 렌더가 한 번 더 돈다. 저장된 이름 한 줄에
   *    그만한 값이 없다.
   */
  const actorRef = useRef<HTMLInputElement>(null);
  const getActor = () => actorRef.current?.value.trim() ?? "";
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/applicants");
    if (r.status === 401) { window.location.href = "/admin/login"; return; }
    const j = await r.json();
    setRows(j.items ?? []);
    setCounts(j.counts ?? null);
  }, []);

  useEffect(() => {
    // setState가 아니라 DOM에 직접 쓴다 — 위 주석 참조.
    if (actorRef.current) actorRef.current.value = localStorage.getItem("hg-actor") ?? "";
    // ⚠️ 첫 데이터는 서버가 이미 넘겨줬다. 여기서 또 부르지 않는다 —
    //    화면이 뜨자마자 같은 걸 한 번 더 읽게 된다.
    //    모집 중에는 신청이 계속 들어오므로 30초마다 새로 읽기만 한다.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const transition = async (row: AdminRow, to: string) => {
    const actor = getActor();
    if (!actor) return setMsg("먼저 「조작하는 사람」에 이름을 적어주세요.");
    if (!confirm(`${row.name} — ${STATUS_KO[row.status]} → ${STATUS_KO[to]} 로 바꿉니다.`)) return;
    const reason = prompt("이유 (기록에 남습니다)") ?? "";
    const r = await fetch(`/api/admin/applicants/${row.id}/transition`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, reason, actor }),
    });
    const j = await r.json();
    setMsg(r.ok ? `${row.name} → ${STATUS_KO[to]}` : `실패: ${j.error ?? r.status}`);
    load();
  };

  const pay = async (row: AdminRow) => {
    const actor = getActor();
    if (!actor) return setMsg("먼저 「조작하는 사람」에 이름을 적어주세요.");
    const who = prompt("통장에 찍힌 입금자명", row.depositor_name ?? row.name);
    if (who === null) return;
    const amt = prompt("입금액 (숫자만)", "39000");
    if (amt === null) return;
    const r = await fetch("/api/admin/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_id: row.id, amount: Number(amt.replace(/\D/g, "")),
        depositor: who, verified_by: actor,
      }),
    });
    const j = await r.json();
    if (!r.ok) setMsg(`실패: ${j.error ?? r.status}`);
    else setMsg(j.warn ? `${row.name} 확정 (${j.nick}) — ⚠️ ${j.warn}` : `${row.name} 확정 · ${j.nick}`);
    load();
  };

  const shown = rows.filter((r) => {
    if (filter === "전체") return true;
    if (filter === "그 밖")
      return !["confirmed", "awaiting_payment", "pre_registered", "waitlist"].includes(r.status);
    return STATUS_KO[r.status] === filter;
  });

  const c = counts;
  return (
    <main className={st.wrap}>
      <header className={st.head}>
        <h1 className={st.h1}>한결 운영 · 1차</h1>
        <div className={st.actor}>
          <label htmlFor="actor">조작하는 사람</label>
          <input id="actor" ref={actorRef} className={st.inputSm} placeholder="이름"
                 defaultValue=""
                 onChange={(e) => localStorage.setItem("hg-actor", e.target.value)} />
        </div>
      </header>

      {c && (
        <section className={st.counters} aria-label="성비 현황">
          {([["확정", "confirmed"], ["입금대기", "awaiting_payment"],
             ["사전등록", "pre_registered"], ["대기", "waitlist"],
             ["남은 자리", "remaining"]] as const).map(([label, key]) => (
            <div key={key} className={key === "remaining" ? st.cardHi : st.card}>
              <div className={st.cardLabel}>{label}</div>
              <div className={st.cardNum}>
                <span>남 {c[key]?.M ?? 0}</span>
                <span className={st.sep}>·</span>
                <span>여 {c[key]?.F ?? 0}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <nav className={st.tabs}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
                  className={f === filter ? st.tabOn : st.tab}>{f}</button>
        ))}
        <button className={st.tab} onClick={load}>새로고침</button>
      </nav>

      {msg && <p className={st.msg} role="status">{msg}</p>}

      <div className={st.tableWrap}>
        <table className={st.table}>
          <thead>
            <tr>
              <th>#</th><th>이름</th><th>성</th><th>나이</th><th>혼인</th><th>직업</th>
              <th>연락처</th><th>상태</th><th>닉</th><th>입금자명</th><th>기한</th><th>할 일</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={r.ageFlag || r.marital === "기혼" ? st.flag : undefined}>
                <td>{r.seq}</td>
                <td>{r.name}</td>
                <td>{r.gender === "M" ? "남" : "여"}</td>
                <td>{r.age}{r.ageFlag && <span title="참가 조건 밖" className={st.warn}> ⚠️</span>}</td>
                <td>{r.marital ?? "—"}{r.marital === "기혼" && <span className={st.warn}> ⚠️</span>}</td>
                <td>{r.job ?? "—"}</td>
                <td className={st.mono}>{r.phone}</td>
                <td>{STATUS_KO[r.status] ?? r.status}</td>
                <td>{r.nick ?? "—"}</td>
                <td>{r.depositor_name ?? "—"}</td>
                {/* 기한은 «입금을 기다리는 동안»에만 뜻이 있다.
                    확정된 사람에게 남은 시간을 보여주면 아직 안 낸 것처럼 읽힌다. */}
                <td className={r.status === "awaiting_payment" && r.hours_left !== null && r.hours_left < 12 ? st.warn : undefined}>
                  {r.status !== "awaiting_payment" || r.hours_left === null
                    ? "—"
                    : r.hours_left < 0
                      ? "지남"
                      : `${r.hours_left}h`}
                </td>
                <td className={st.actions}>
                  {r.status === "awaiting_payment" && (
                    <button className={st.btnPay} onClick={() => pay(r)}>입금 확인</button>
                  )}
                  {(NEXT[r.status] ?? []).filter((t) => t !== "confirmed").map((t) => (
                    <button key={t} className={st.btnSm} onClick={() => transition(r, t)}>
                      {STATUS_KO[t]}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={12} className={st.empty}>아직 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
