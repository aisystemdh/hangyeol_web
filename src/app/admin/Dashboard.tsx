"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminApplicationRow, AdminStatus } from "@/lib/admin-list";
import { isDueSoon } from "@/lib/admin-list";
import type { SeatsSummary } from "@/lib/admin-data";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import ApplicationDrawer from "./ApplicationDrawer";
import st from "./admin.module.css";

/**
 * 신청 목록 (이슈 #34). 옛 `Board.tsx`(#30에서 지움, 상태 9개 전제)에서
 * **살아남을 만한 패턴 둘**을 그대로 가져왔다 — "조작하는 사람"을 DOM에
 * 직접 쓰는 하이드레이션 회피, 그리고 "서버가 첫 데이터를 넘기고 30초마다
 * 갱신"(`docs/decisions/003…` §7). 나머지(상태 아홉 개, 성비 카운터 형태)는
 * 새 데이터 모델(상태 셋)에 맞게 다시 짰다.
 *
 * 🔴 코드리뷰(2026-09-06) — 검색·상태·성별 거르기는 **서버에**(`/api/admin/
 *    applications`의 query 파라미터 → `admin-list.ts`의 `filterApplications`)만
 *    있다. 처음엔 클라이언트에서 같은 함수를 한 번 더 불러 "타이핑하자마자 거르기"를
 *    노렸는데, 그러면 진짜로 쓰이는 필터링 규칙(서버 쪽)은 `tests/admin.test.ts`의
 *    쿼리스트링 호출로만 확인되고 실제 화면은 그 경로를 한 번도 안 타는 채로 남는다
 *    — 규칙이 두 벌이 되면 한쪽만 조용히 낡는다(`CLAUDE.md` "검증 자리는 하나다"와
 *    같은 이유). 그래서 화면도 서버 쪽 규칙을 그대로 쓰게 만들었다 — 검색어는
 *    300ms 정도 끊어 보내 타이핑마다 요청이 나가지 않게만 한다.
 */

const STATUS_FILTERS: readonly (AdminStatus | "전체")[] = ["전체", "신청함", "입금완료", "취소됨"];
const GENDER_FILTERS: readonly ("전체" | "M" | "F")[] = ["전체", "M", "F"];

function formatShort(iso: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * 「N시간 남음」 문구와 강조 여부를 **같은 시각 하나**에서 함께 계산한다.
 *
 * 🔴 코드리뷰(2026-09-06)에서 잡힌 버그 — 강조(`dueSoon`, 행 배경·기한 칸 빨간
 *    글자)는 서버가 응답을 만든 시각 기준이고, 문구("N시간 남음")는 브라우저가
 *    렌더링하는 시각 기준이었다. 두 시각이 다르면(운영자 컴퓨터 시계가 몇 분
 *    어긋나 있거나 폴링 사이 시간이 지났으면) "강조는 안 됐는데 문구는 마이너스
 *    시간"처럼 둘이 서로 다른 말을 하는 화면이 생긴다. 그래서 `admin-list.ts`의
 *    `isDueSoon`을 **클라이언트에서 다시** 불러 강조와 문구를 같은 순간의
 *    같은 계산으로 통일한다 — 서버가 내려준 `row.dueSoon`은 API 응답 검사
 *    (`tests/admin.test.ts`)용으로만 남긴다.
 */
function dueDisplay(row: AdminApplicationRow, now: Date): { label: string; soon: boolean } {
  if (row.status !== "신청함" || !row.dueAt) return { label: "—", soon: false };
  const dueAt = new Date(row.dueAt);
  const hours = (dueAt.getTime() - now.getTime()) / 3_600_000;
  const label = hours < 0 ? "지남" : `${Math.floor(hours)}h`;
  return { label, soon: isDueSoon(row.status, dueAt, now) };
}

export default function Dashboard({
  initial,
  initialSeats,
}: {
  initial: AdminApplicationRow[];
  initialSeats: SeatsSummary;
}) {
  const [rows, setRows] = useState<AdminApplicationRow[]>(initial);
  // 🔴 「남은 자리가 성별로 보인다」(이슈 #35 AC) — 목록과 같은 30초 폴링을 탄다.
  //    입금 확인 라우트가 도는 자리 계산과 같은 함수(`seats.ts`)를 쓰므로 둘이 어긋나지 않는다.
  const [seats, setSeats] = useState<SeatsSummary>(initialSeats);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminStatus | "전체">("전체");
  const [genderFilter, setGenderFilter] = useState<"전체" | "M" | "F">("전체");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  /**
   * 🔴 공유 비밀번호라 서버는 누가 눌렀는지 모른다. 이 선택값을 조작 API에 실어
   *    보내 기록에 이름을 남긴다(`CONTEXT.md` "운영자가 하는 일").
   *
   * ⚠️ localStorage 값을 상태 초깃값으로 쓰면 서버 렌더에는 없는 값이라 하이드레이션이
   *    어긋난다. `<select>`를 DOM으로 직접 읽고 쓰는 이유가 그것이다(옛 `Board.tsx`와
   *    같은 회피).
   */
  const actorRef = useRef<HTMLSelectElement>(null);
  const getActor = useCallback(() => actorRef.current?.value ?? "", []);

  // 필터는 상태가 바뀔 때마다(디바운스로) 다시 부르고, 30초 폴링도 그때그때
  // 최신 필터를 봐야 한다 — 그래서 setInterval 클로저 대신 ref로 최신값을 들고 있는다.
  const filtersRef = useRef({ query: "", statusFilter: "전체" as AdminStatus | "전체", genderFilter: "전체" as "전체" | "M" | "F" });
  useEffect(() => {
    filtersRef.current = { query, statusFilter, genderFilter };
  }, [query, statusFilter, genderFilter]);

  const load = useCallback(async () => {
    const { query: q, statusFilter: status, genderFilter: gender } = filtersRef.current;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "전체") params.set("status", status);
    if (gender !== "전체") params.set("gender", gender);
    const qs = params.toString();
    const r = await fetch(`/api/admin/applications${qs ? `?${qs}` : ""}`);
    if (r.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    const j = await r.json();
    setRows(j.data?.items ?? []);
    if (j.data?.seats) setSeats(j.data.seats);
  }, []);

  // 사람이 바뀌기 전에 마지막으로 고른 조작자를 되살린다(위 주석 참조) + 30초 폴링.
  useEffect(() => {
    if (actorRef.current) actorRef.current.value = localStorage.getItem("hg-actor") ?? "";
    // ⚠️ 첫 데이터는 서버가 이미 넘겼다. 여기서 또 부르지 않고 30초 뒤부터 갱신한다.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // 검색어·상태·성별이 바뀌면 서버에 새로 거른 목록을 요청한다. 첫 렌더(=서버가
  // 이미 준 초깃값과 같은 "전체"·빈 검색어)에는 부르지 않는다.
  const skipFirstFilter = useRef(true);
  useEffect(() => {
    if (skipFirstFilter.current) {
      skipFirstFilter.current = false;
      return;
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [query, statusFilter, genderFilter, load]);

  const shown = rows;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * 🔴 코드리뷰(2026-09-06)에서 잡힌 버그 — `selected.size === shown.length`로만
   *    "전체 선택"을 판정하면, 필터를 바꿔 화면에 안 보이게 된 사람도 `selected`
   *    안에는 그대로 남아 있어 개수가 어긋난다. 그 상태에서 전체선택을 다시 누르면
   *    "지금 보이는 것만 새 Set으로" 만들어 **화면 밖 선택이 조용히 사라진다.**
   *    지금 보이는 행(`shown`)만 넣고 빼고, 그 밖의 선택은 손대지 않는다.
   */
  const toggleAll = () => {
    const shownIds = shown.map((r) => r.id);
    const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of shownIds) {
        if (allShownSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  // 화면 고정·입금 확인·환불·취소 — 어느 쪽이든 목록(자리 현황 포함)을 다시 그려야
  // 다른 사람 행을 계속 클릭해 나가도 방금 바뀐 상태·자리 수가 바로 보인다.
  const afterMutation = () => {
    load();
  };

  return (
    <>
      <header className={st.head}>
        <h1 className={st.h1}>신청 목록</h1>
        <div className={st.actor}>
          <label htmlFor="actor">조작하는 사람</label>
          {/* 🔴 자유 입력이 아니라 명단(`SITE.operators`, `site.ts`)에서 고른다 —
              서버(`/api/admin/applications/[id]/screen`)도 이 명단에 없는 이름은 거절한다. */}
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

      {/* 🔴 이슈 #35 AC "남은 자리가 성별로 보인다" — 이 화면에서 가장 자주 확인하는
          숫자라 목록 위에 크게 둔다. 정원이 차도(강조만 하고) 계속 보여준다 —
          입금 확인 자체를 막지 않는 규칙과 같은 이유다. */}
      <div className={st.counters}>
        <div className={seats.remaining.M === 0 ? st.cardHi : st.card}>
          <div className={st.cardLabel}>남은 자리 · 남</div>
          <div className={st.cardNum}>
            {seats.remaining.M} / {seats.capacityPerGender}
            <span className={st.sep}>·</span>
            <span className={st.cardSub}>입금완료 {seats.taken.M}명</span>
          </div>
        </div>
        <div className={seats.remaining.F === 0 ? st.cardHi : st.card}>
          <div className={st.cardLabel}>남은 자리 · 여</div>
          <div className={st.cardNum}>
            {seats.remaining.F} / {seats.capacityPerGender}
            <span className={st.sep}>·</span>
            <span className={st.cardSub}>입금완료 {seats.taken.F}명</span>
          </div>
        </div>
      </div>

      <div className={st.filters}>
        <input
          type="search"
          className={st.inputSm}
          placeholder="이름 또는 연락처 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <nav className={st.tabs} aria-label="상태로 거르기">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              className={f === statusFilter ? st.tabOn : st.tab}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </nav>
        <nav className={st.tabs} aria-label="성별로 거르기">
          {GENDER_FILTERS.map((f) => (
            <button
              key={f}
              className={f === genderFilter ? st.tabOn : st.tab}
              onClick={() => setGenderFilter(f)}
            >
              {f === "전체" ? "전체" : f === "M" ? "남" : "여"}
            </button>
          ))}
        </nav>
        <button className={st.tab} onClick={load}>
          새로고침
        </button>
      </div>

      {selected.size > 0 && (
        <p className={st.msg} role="status">
          {selected.size}명 선택됨 —{" "}
          <button className={st.btnSm} onClick={() => setSelected(new Set())}>
            선택 해제
          </button>
        </p>
      )}
      {msg && (
        <p className={st.msg} role="status">
          {msg}
        </p>
      )}

      <div className={st.tableWrap}>
        <table className={st.table}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  // 🔴 `selected.size === shown.length`가 아니다 — 필터 밖에 숨은
                  //    선택이 있으면 개수가 안 맞아도 "지금 보이는 행은 전부 선택됨"일
                  //    수 있다(위 `toggleAll` 주석과 같은 이유).
                  checked={shown.length > 0 && shown.every((r) => selected.has(r.id))}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th>#</th>
              <th>상태</th>
              <th>이름</th>
              <th>성</th>
              <th>나이</th>
              <th>연락처</th>
              <th>신청일</th>
              <th>기한</th>
              <th>마지막 발송</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // 한 렌더 안의 모든 행이 같은 순간을 기준으로 강조·문구를 계산하게
              // 한 번만 읽는다(위 `dueDisplay` 주석 참조).
              const now = new Date();
              return shown.map((r) => {
                const due = dueDisplay(r, now);
                return (
                  <tr
                    key={r.id}
                    className={due.soon ? st.flag : undefined}
                    onClick={() => setOpenId(r.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        aria-label={`${r.name} 선택`}
                      />
                    </td>
                    <td>{r.seq}</td>
                    <td>
                      {r.status}
                      {r.waitlisted && <span className={st.badgeWait}> 대기</span>}
                      {r.screenLocked && <span className={st.badgeLock}> 화면 고정됨</span>}
                      {r.amountMismatch && (
                        <span className={st.badgeMismatch}> {EVENT.priceLabel}과 다름</span>
                      )}
                    </td>
                    <td>{r.name}</td>
                    <td>{r.gender === "M" ? "남" : "여"}</td>
                    <td>{r.age}</td>
                    <td className={st.mono}>{r.phone}</td>
                    <td className={st.mono}>{formatShort(r.appliedAt)}</td>
                    <td className={due.soon ? st.warn : undefined}>
                      {r.dueAt ? `${formatShort(r.dueAt)} (${due.label})` : "—"}
                    </td>
                    <td>
                      {r.lastNotifiedAt
                        ? `${formatShort(r.lastNotifiedAt)} · ${r.lastNotifiedLabel ?? "—"}${
                            r.lastNotifiedStatus === "실패" ? " ⚠️" : ""
                          }`
                        : "—"}
                    </td>
                  </tr>
                );
              });
            })()}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className={st.empty}>
                  조건에 맞는 신청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <ApplicationDrawer
          // 🔴 다른 사람 행을 잇달아 클릭해도 `id`만 바뀌고 컴포넌트는 안 바뀐다.
          //    `key`로 강제 재마운트해야 서랍이 이전 사람의 상세를 들고 있다가
          //    한 프레임 보여주는 일 없이 "불러오는 중"부터 다시 시작한다.
          key={openId}
          id={openId}
          onClose={() => setOpenId(null)}
          getActor={getActor}
          onChanged={afterMutation}
          onMessage={setMsg}
          seatsRemaining={seats.remaining}
        />
      )}
    </>
  );
}
