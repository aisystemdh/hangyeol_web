"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminApplicationRow } from "@/lib/admin-list";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import st from "../admin.module.css";

/**
 * 닉네임 배정 탭 화면 (이슈 #39). `Dashboard`(#34)·`MarketingBoard`(#41)와 같은
 * 패턴 — 서버가 첫 데이터를 넘기고, "조작하는 사람"은 `<select>`를 DOM으로 직접
 * 읽고 써서 하이드레이션 어긋남을 피한다(`Dashboard`와 같은 회피, 주석 참조).
 *
 * 🔴 `prompt()`/`confirm()`을 쓰지 않는다 — 배정은 이 화면의 `<select>` + 버튼
 *    하나로 끝난다(`docs/decisions/003…` §7).
 */
export default function NicknameBoard({ initial }: { initial: AdminApplicationRow[] }) {
  const [rows, setRows] = useState<AdminApplicationRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const actorRef = useRef<HTMLSelectElement>(null);
  const getActor = useCallback(() => actorRef.current?.value ?? "", []);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/nicknames");
    if (r.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    const j = (await r.json()) as { data?: { items: AdminApplicationRow[] } };
    if (j.data) setRows(j.data.items);
  }, []);

  useEffect(() => {
    // 마지막으로 고른 조작자를 되살린다(`Dashboard`와 같은 이유) + 30초 폴링 —
    // 다른 운영자가 방금 배정을 마쳤을 수 있어 이 화면도 최신 상태를 따라간다.
    if (actorRef.current) actorRef.current.value = localStorage.getItem("hg-actor") ?? "";
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const unassignedCount = rows.filter((r) => r.nick === null).length;

  const assign = async () => {
    const actor = getActor();
    if (!actor) {
      setMsg("조작하는 사람을 먼저 골라주세요.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/nicknames", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor }),
      });
      if (r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const j = (await r.json()) as {
        ok: boolean;
        data?: { assignedCount: number; overCapacityCount: number; items: AdminApplicationRow[] };
        message?: string;
      };
      if (!j.ok) {
        setMsg(j.message ?? "배정하지 못했습니다.");
        return;
      }
      if (j.data) {
        const { assignedCount, overCapacityCount, items } = j.data;
        setRows(items);
        // 🔴 코드리뷰(2026-09-06) — "새로 붙은 사람이 0명"인 이유가 서로 다른 세
        //    경우(대상이 아예 없음 · 이미 전원 배정됨 · 정원 초과라 못 받음)를
        //    하나의 문구로 뭉치면 운영자가 왜 안 바뀌었는지 알 수 없다.
        if (assignedCount > 0) {
          setMsg(
            overCapacityCount > 0
              ? `${assignedCount}명에게 새 번호를 붙였습니다. 정원(${EVENT.capacity}명)을 넘는 ${overCapacityCount}명은 번호를 받지 못했습니다.`
              : `${assignedCount}명에게 새 번호를 붙였습니다.`,
          );
        } else if (items.length === 0) {
          setMsg("아직 입금완료인 신청이 없습니다.");
        } else if (overCapacityCount > 0) {
          setMsg(
            `이미 번호가 정원(${EVENT.capacity}명)만큼 다 찼습니다. ${overCapacityCount}명은 정원 초과라 번호를 받지 못했습니다.`,
          );
        } else {
          setMsg("이미 전원 번호가 있어 바뀐 것이 없습니다.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className={st.head}>
        <h1 className={st.h1}>닉네임 배정</h1>
        <div className={st.actor}>
          <label htmlFor="actor">조작하는 사람</label>
          <select
            id="actor"
            ref={actorRef}
            className={st.inputSm}
            defaultValue=""
            onChange={(e) => localStorage.setItem("hg-actor", e.target.value)}
          >
            <option value="" disabled>
              선택
            </option>
            {SITE.operators.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <p className={st.loginNote}>
        지금 「입금완료」 상태인 신청 전체에 접수 순서(신청일)대로 1번부터 이름표
        번호를 붙입니다. 이미 번호를 받은 사람은 건너뛰고, 아직 없는 사람에게만
        지금까지 쓰인 가장 큰 번호 다음부터 이어 붙입니다 — 그래서 몇 번을 눌러도
        이미 붙은 번호는 바뀌지 않고, 중간에 취소된 사람이 있어도 나머지가
        연속된 번호를 받습니다. 번호에는 성별이 드러나지 않습니다.
      </p>

      <button className={st.btnPay} onClick={assign} disabled={busy}>
        {busy ? "배정 중…" : "닉네임 배정"}
      </button>
      {msg && (
        <p className={st.msg} role="status">
          {msg}
        </p>
      )}

      <div className={st.tableWrap}>
        <table className={st.table}>
          <thead>
            <tr>
              <th>번호</th>
              <th>#</th>
              <th>이름</th>
              <th>연락처</th>
              <th>신청일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={st.mono}>{r.nick ?? "—"}</td>
                <td>{r.seq}</td>
                <td>{r.name}</td>
                <td className={st.mono}>{r.phone}</td>
                <td className={st.mono}>{new Date(r.appliedAt).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={st.empty}>
                  아직 입금완료인 신청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className={st.loginNote}>
          {rows.length}명 중 {rows.length - unassignedCount}명 번호 있음 · {unassignedCount}명 대기
        </p>
      )}
    </>
  );
}
