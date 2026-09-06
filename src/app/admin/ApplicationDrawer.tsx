"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminApplicationDetail } from "@/lib/admin-data";
import { formatDT } from "@/lib/admin-format";
import { isMeScreenName, type MeScreenName } from "@/lib/me-screen";
import { EXPECTED_DEPOSIT_KRW } from "@/lib/payment";
import { EVENT } from "@/lib/event";
import type { SeatCount } from "@/lib/seats";
import st from "./admin.module.css";

/**
 * 상세 서랍 (이슈 #34 AC · #35 AC) — 답변·돈 줄·발송 이력·조작 로그를 한 화면에 모으고,
 * 여기서 입금 확인·환불·취소까지 처리한다.
 *
 * 🔴 `prompt()`/`confirm()`을 쓰지 않는다 — 모든 조작은 이 서랍 안의 `<form>`·`<select>`·
 *    버튼으로 끝낸다(`docs/decisions/003…` §7).
 */

const SCREEN_LABELS: Record<MeScreenName, string> = {
  cancelled: "취소 안내",
  ended: "후기 · 리포트",
  eventDay: "당일 안내",
  waitlisted: "대기 안내",
  register: "등록 화면",
  payment: "계좌 안내",
  questions: "사전질문",
  confirmed: "확정 안내",
};

const SCREEN_OPTIONS = Object.keys(SCREEN_LABELS) as MeScreenName[];

/**
 * `<input type="datetime-local">`의 기본값. 운영자가 방금 확인한 입금은 대개 "지금
 * 막" 찍힌 시각이라 매번 새로 타이핑하지 않도록 지금 시각을 채워 둔다 — 다른 시각이면
 * 직접 고치면 된다. 🔴 이 값은 시간대 표기가 없는 「로컬 시각 문자열」이고,
 * 서버(`payment.ts`의 `parseMoneyBody`)가 이걸 **한국 시각**으로 못박아 해석한다.
 */
function nowLocalInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PostResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * 서랍의 조작 버튼 넷(화면 고정·입금 확인·환불·취소)이 공유하는 fetch 뼈대.
 *
 * 🔴 코드리뷰(2026-09-06) — 네트워크 오류 시 `busy`를 풀어주는 try/catch/finally를
 *    네 곳에 각각 복붙했더니, 그중 하나(`applyScreen`)를 빠뜨렸었다 — 하나를
 *    빠뜨리기 쉬운 바로 그 모양이라 한 곳으로 모은다. `busy`를 여기서 풀지 않는
 *    이유는 성공했을 때 호출부가 후속 처리(로컬 상태 갱신 등)를 마칠 때까지
 *    버튼이 다시 눌리지 않게 하기 위해서다 — 호출부가 자기 타이밍에 풀어준다.
 */
async function postAdminAction<T>(
  url: string,
  body: unknown,
  failPrefix: string,
): Promise<PostResult<T>> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: `${failPrefix}: ${j.message ?? j.error ?? r.status}` };
    return { ok: true, data: j.data as T };
  } catch {
    return { ok: false, message: `${failPrefix}: 네트워크 오류. 다시 시도해주세요.` };
  }
}

export default function ApplicationDrawer({
  id,
  onClose,
  getActor,
  onChanged,
  onMessage,
  seatsRemaining,
}: {
  id: string;
  onClose: () => void;
  getActor: () => string;
  /** 화면 고정·입금 확인·환불·취소 중 무엇이든 바뀐 뒤 목록(자리 현황 포함)을 다시 부른다. */
  onChanged: () => void;
  onMessage: (msg: string) => void;
  /** 목록이 30초마다 갱신하는 자리 현황. 서랍을 열 때의 스냅샷이라 약간 낡을 수 있어
   *  최종 판단은 서버(입금 확인 응답의 `overCapacity`)가 한다 — 여기서는 미리 보여주는 용도. */
  seatsRemaining: SeatCount;
}) {
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * 🔴 코드리뷰(2026-09-06)에서 잡힌 버그 — 401이 아닌 실패(예: 삭제된 신청의 404)를
   *    그냥 `r.json()`으로 읽어버리면 `detail`이 계속 null인 채 `loading`만 꺼져서,
   *    헤더 제목이 "불러오는 중…"에서 영영 안 바뀌는데 이유를 알려주는 문구도 없다.
   *    성공/실패를 명시적으로 나눠 실패는 이 칸에 담는다.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screenPick, setScreenPick] = useState<"" | MeScreenName>("");
  const [busy, setBusy] = useState(false);

  // ── 입금 확인 폼 ──
  const [payAmount, setPayAmount] = useState(String(EXPECTED_DEPOSIT_KRW));
  const [payOccurredAt, setPayOccurredAt] = useState(nowLocalInputValue());
  const [payDepositor, setPayDepositor] = useState("");
  const [payNote, setPayNote] = useState("");

  // ── 환불 폼 ──
  const [refundAmount, setRefundAmount] = useState("");
  const [refundOccurredAt, setRefundOccurredAt] = useState(nowLocalInputValue());
  const [refundDepositor, setRefundDepositor] = useState("");
  const [refundNote, setRefundNote] = useState("");

  const loadDetail = useCallback(() => {
    let cancelled = false;
    fetch(`/api/admin/applications/${id}`)
      .then(async (r) => {
        // 🔴 세션이 12시간 만료됐을 때 서랍만 다른 취급을 하지 않는다 — 목록의
        //    30초 폴링(`Dashboard.load`)과 **같은 반응**(로그인 화면으로)이어야
        //    "목록은 로그인으로 튕겼는데 서랍은 에러 문구만 뜬다"가 안 생긴다.
        if (r.status === 401) {
          window.location.href = "/admin/login";
          return null;
        }
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          throw new Error(j?.message ?? j?.error ?? `상세 정보를 불러오지 못했습니다 (${r.status}).`);
        }
        return j.data as AdminApplicationDetail;
      })
      .then((data) => {
        if (cancelled || data === null) return;
        setDetail(data);
        setPayDepositor((prev) => prev || data.application.depositorName || "");
        setScreenPick(isMeScreenName(data.application.viewOverride) ? data.application.viewOverride : "");
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "상세 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    // ⚠️ 여기서 `setLoading(true)`를 부르지 않는다 — 이펙트 본문에서 곧바로
    //    setState를 부르면 렌더가 한 번 더 겹친다(react-hooks/set-state-in-effect).
    //    `loading`의 초깃값이 이미 `true`이고, `Dashboard`가 이 컴포넌트를
    //    `key={id}`로 매번 새로 마운트하므로 사람이 바뀔 때도 다시 `true`로
    //    시작한다 — 그래서 이 이펙트는 끝날 때 `false`로 내리기만 한다.
    return loadDetail();
  }, [loadDetail]);

  const applyScreen = async (screen: MeScreenName | null) => {
    const actor = getActor();
    if (!actor) {
      onMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    setBusy(true);
    const res = await postAdminAction(`/api/admin/applications/${id}/screen`, { screen, actor }, "실패");
    setBusy(false);
    if (!res.ok) {
      onMessage(res.message);
      return;
    }
    onMessage(screen ? `화면을 「${SCREEN_LABELS[screen]}」로 고정했습니다.` : "화면 고정을 풀었습니다.");
    onChanged();
    /**
     * 🔴 코드리뷰(2026-09-06) — 방금 서버에 적어 넣은 값을 이미 알고 있는데
     *    다섯 개 표(답변·돈 줄·발송 이력·조작 로그 포함) 전체를 다시 긁어오는
     *    두 번째 GET을 부르지 않는다. `viewOverride` 한 칸만 로컬에서 갱신하고,
     *    조작 로그도 방금 서버가 남긴 줄과 같은 모양으로 하나 앞에 붙인다 —
     *    다음에 서랍을 다시 열면 어차피 진짜 값으로 맞춰진다.
     */
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            application: { ...prev.application, viewOverride: screen },
            eventLog: [
              {
                id: -Date.now(),
                kind: screen ? "화면고정" : "화면고정해제",
                actor,
                meta: { screen },
                at: new Date().toISOString(),
              },
              ...prev.eventLog,
            ],
          }
        : prev,
    );
  };

  /**
   * 입금 확인 — **이 시스템에서 자리가 차는 유일한 순간**(이슈 #35). 상태 변경과 돈 줄
   * 쌓기가 서버(`recordPayment`)에서 한 트랜잭션으로 함께 일어나므로, 여기서는 값만
   * 모아 한 번에 보낸다.
   *
   * 🔴 금액·정원 어느 쪽도 이 화면에서 막지 않는다. 정원 초과는 서버가 방금 커밋한
   *    진짜 자리 수(`overCapacity`)로 판단해 경고 문구만 띄운다 — `confirm()` 없이도
   *    "막지 않되 알린다"를 만족한다.
   */
  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    const actor = getActor();
    if (!actor) {
      onMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    const amount = Number(payAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      onMessage("금액을 원 단위 양수로 입력해주세요.");
      return;
    }
    if (!payDepositor.trim()) {
      onMessage("입금자명을 입력해주세요.");
      return;
    }
    setBusy(true);
    const res = await postAdminAction<{ amountMismatch?: boolean; overCapacity?: boolean }>(
      `/api/admin/applications/${id}/payment`,
      {
        amount,
        occurredAt: payOccurredAt,
        depositorName: payDepositor.trim(),
        note: payNote.trim() || undefined,
        actor,
      },
      "입금 확인 실패",
    );
    setBusy(false);
    if (!res.ok) {
      onMessage(res.message);
      return;
    }
    const parts = [`입금(${amount.toLocaleString()}원)을 확인해 자리를 채웠습니다.`];
    if (res.data?.amountMismatch) parts.push(`${EVENT.priceLabel}과 다른 금액입니다.`);
    if (res.data?.overCapacity) parts.push("정원 초과 상태입니다. 그래도 저장은 됐습니다.");
    onMessage(parts.join(" "));
    setPayNote("");
    onChanged();
    loadDetail();
  };

  /** 환불 — 돈 줄에 「−금액 환불」 한 줄을 쌓는다. 상태는 바꾸지 않는다(취소는 따로). */
  const submitRefund = async (e: FormEvent) => {
    e.preventDefault();
    const actor = getActor();
    if (!actor) {
      onMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    const amount = Number(refundAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      onMessage("환불 금액을 원 단위 양수로 입력해주세요.");
      return;
    }
    setBusy(true);
    const res = await postAdminAction(
      `/api/admin/applications/${id}/refund`,
      {
        amount,
        occurredAt: refundOccurredAt,
        depositorName: refundDepositor.trim() || undefined,
        note: refundNote.trim() || undefined,
        actor,
      },
      "환불 기록 실패",
    );
    setBusy(false);
    if (!res.ok) {
      onMessage(res.message);
      return;
    }
    onMessage(`환불(${amount.toLocaleString()}원)을 돈 줄에 남겼습니다.`);
    setRefundAmount("");
    setRefundNote("");
    onChanged();
    loadDetail();
  };

  /** 취소 — 돈 줄은 건드리지 않는다. 이미 낸 돈을 돌려주려면 환불을 따로 쌓는다. */
  const submitCancel = async () => {
    const actor = getActor();
    if (!actor) {
      onMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    setBusy(true);
    const res = await postAdminAction(`/api/admin/applications/${id}/cancel`, { actor }, "취소 실패");
    setBusy(false);
    if (!res.ok) {
      onMessage(res.message);
      return;
    }
    onMessage("신청을 취소됨으로 바꿨습니다.");
    onChanged();
    loadDetail();
  };

  return (
    <div className={st.drawerBackdrop} onClick={onClose}>
      <aside className={st.drawer} onClick={(e) => e.stopPropagation()} aria-label="신청 상세">
        <div className={st.drawerHead}>
          <h2 className={st.h1}>
            {detail?.application.name ?? (loading ? "불러오는 중…" : "불러오지 못함")}
          </h2>
          <button className={st.btnSm} onClick={onClose}>
            닫기
          </button>
        </div>

        {loading && <p className={st.empty}>불러오는 중…</p>}
        {!loading && loadError && <p className={st.err}>{loadError}</p>}

        {!loading && detail && (
          <>
            <section>
              <h3>기본 정보</h3>
              <dl className={st.dl}>
                <dt>상태</dt>
                <dd>{detail.application.status}</dd>
                <dt>성별 · 나이</dt>
                <dd>
                  {detail.application.gender === "M" ? "남" : "여"} · {detail.application.age}세
                </dd>
                <dt>연락처</dt>
                <dd className={st.mono}>{detail.application.phone}</dd>
                <dt>신청일</dt>
                <dd>{formatDT(detail.application.appliedAt)}</dd>
                <dt>기한</dt>
                <dd>{formatDT(detail.application.dueAt)}</dd>
                <dt>정식등록</dt>
                <dd>{formatDT(detail.application.registeredAt)}</dd>
                <dt>혼인 · 직업</dt>
                <dd>
                  {detail.application.marital ?? "—"} · {detail.application.job ?? "—"}
                </dd>
                <dt>이메일</dt>
                <dd>{detail.application.email ?? "—"}</dd>
                <dt>입금자명</dt>
                <dd>{detail.application.depositorName ?? "—"}</dd>
                <dt>입금 확인</dt>
                <dd>{formatDT(detail.application.paidAt)}</dd>
                <dt>낸 돈</dt>
                <dd className={st.mono}>{detail.netPaid.toLocaleString()}원</dd>
                <dt>닉네임</dt>
                <dd>{detail.application.nick ?? "—"}</dd>
                <dt>메모</dt>
                <dd>{detail.application.memo ?? "—"}</dd>
              </dl>
            </section>

            <section>
              <h3>입금 확인</h3>
              <p className={st.loginNote}>
                은행 앱에 찍힌 입금자명·금액·시각을 그대로 적는다. {EVENT.priceLabel}이 아니어도
                막지 않고 그대로 저장한다 — 다르면 목록·상세에 표시만 남는다.
                {seatsRemaining[detail.application.gender] <= 0 && (
                  <strong className={st.warn}> 지금 이 성별 자리가 이미 다 찼습니다.</strong>
                )}
              </p>
              <form className={st.moneyForm} onSubmit={submitPayment}>
                <label>
                  금액(원)
                  <input
                    type="number"
                    className={st.inputSm}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    min={1}
                    step={1}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  입금 시각
                  <input
                    type="datetime-local"
                    className={st.inputSm}
                    value={payOccurredAt}
                    onChange={(e) => setPayOccurredAt(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  입금자명
                  <input
                    type="text"
                    className={st.inputSm}
                    value={payDepositor}
                    onChange={(e) => setPayDepositor(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  메모(선택)
                  <input
                    type="text"
                    className={st.inputSm}
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button type="submit" className={st.btnPay} disabled={busy}>
                  입금 확인
                </button>
              </form>
            </section>

            <section>
              <h3>환불</h3>
              <p className={st.loginNote}>상태는 바꾸지 않는다 — 취소는 아래에서 따로 한다.</p>
              <form className={st.moneyForm} onSubmit={submitRefund}>
                <label>
                  금액(원)
                  <input
                    type="number"
                    className={st.inputSm}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    min={1}
                    step={1}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  환불 시각
                  <input
                    type="datetime-local"
                    className={st.inputSm}
                    value={refundOccurredAt}
                    onChange={(e) => setRefundOccurredAt(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <label>
                  받는 사람(선택)
                  <input
                    type="text"
                    className={st.inputSm}
                    value={refundDepositor}
                    onChange={(e) => setRefundDepositor(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  메모(선택)
                  <input
                    type="text"
                    className={st.inputSm}
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button type="submit" className={st.btnSm} disabled={busy}>
                  환불 기록
                </button>
              </form>
            </section>

            <section>
              <h3>취소</h3>
              <p className={st.loginNote}>
                돈 줄은 그대로 둔다. 이미 낸 돈을 돌려주려면 위 환불을 따로 남긴다.
              </p>
              <button
                className={st.btnSm}
                disabled={busy || detail.application.status === "취소됨"}
                onClick={submitCancel}
              >
                {detail.application.status === "취소됨" ? "이미 취소됨" : "취소로 바꾸기"}
              </button>
            </section>

            <section>
              <h3>화면 고정 (결정 13)</h3>
              <p className={st.loginNote}>
                고정하면 손님의 마이페이지가 상태와 무관하게 이 화면으로 고정된다. 금액을 잘못
                보내 계좌 화면을 다시 띄워야 할 때처럼, 자동 판정 순서를 예외적으로 무시해야 할
                때 쓴다.
              </p>
              <div className={st.actor}>
                <select
                  className={st.inputSm}
                  value={screenPick}
                  onChange={(e) => setScreenPick(e.target.value as "" | MeScreenName)}
                  disabled={busy}
                >
                  <option value="" disabled>
                    화면 선택
                  </option>
                  {SCREEN_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {SCREEN_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  className={st.btnPay}
                  disabled={busy || !screenPick}
                  onClick={() => screenPick && applyScreen(screenPick)}
                >
                  고정하기
                </button>
                {detail.application.viewOverride && (
                  <button className={st.btnSm} disabled={busy} onClick={() => applyScreen(null)}>
                    고정 해제
                  </button>
                )}
              </div>
              {detail.application.viewOverride && (
                <p className={st.msg}>
                  지금 「{SCREEN_LABELS[detail.application.viewOverride]}」로 고정돼 있습니다.
                </p>
              )}
            </section>

            <section>
              <h3>답변 ({detail.answers.length})</h3>
              {detail.answers.length === 0 ? (
                <p className={st.empty}>아직 없습니다.</p>
              ) : (
                <ul className={st.plainList}>
                  {detail.answers.map((a, i) => (
                    <li key={i}>
                      <strong>{a.round != null ? `라운드 ${a.round}` : a.form}</strong>
                      <span className={st.loginNote}> · {a.formVersion} · {formatDT(a.createdAt)}</span>
                      <pre className={st.pre}>{JSON.stringify(a.a, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>돈 줄 ({detail.money.length}) · 낸 돈 {detail.netPaid.toLocaleString()}원</h3>
              {detail.money.length === 0 ? (
                <p className={st.empty}>아직 없습니다.</p>
              ) : (
                <table className={st.table}>
                  <thead>
                    <tr>
                      <th>종류</th>
                      <th>금액</th>
                      <th>일시</th>
                      <th>입금자명</th>
                      <th>확인한 사람</th>
                      <th>메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.money.map((m) => (
                      <tr key={m.id}>
                        <td>{m.kind}</td>
                        <td className={st.mono}>
                          {m.amount.toLocaleString()}원
                          {m.amountMismatch && (
                            <span className={st.badgeMismatch}> {EVENT.priceLabel}과 다름</span>
                          )}
                        </td>
                        <td>{formatDT(m.occurredAt)}</td>
                        <td>{m.depositorName ?? "—"}</td>
                        <td>{m.recordedBy}</td>
                        <td>{m.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h3>발송 이력 ({detail.notifications.length})</h3>
              {detail.notifications.length === 0 ? (
                <p className={st.empty}>아직 없습니다.</p>
              ) : (
                <table className={st.table}>
                  <thead>
                    <tr>
                      <th>문구</th>
                      <th>상태</th>
                      <th>보낸 사람</th>
                      <th>보낸 시각</th>
                      <th>실패 사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.notifications.map((n) => (
                      <tr key={n.id} className={n.status === "실패" ? st.flag : undefined}>
                        <td>{n.templateLabel ?? n.templateId ?? "—"}</td>
                        <td>{n.status}</td>
                        <td>{n.sentBy ?? "—"}</td>
                        <td>{formatDT(n.createdAt)}</td>
                        <td>{n.error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h3>조작 로그 ({detail.eventLog.length})</h3>
              {detail.eventLog.length === 0 ? (
                <p className={st.empty}>아직 없습니다.</p>
              ) : (
                <table className={st.table}>
                  <thead>
                    <tr>
                      <th>조작</th>
                      <th>누가</th>
                      <th>일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.eventLog.map((e) => (
                      <tr key={e.id}>
                        <td>{e.kind}</td>
                        <td>{e.actor}</td>
                        <td>{formatDT(e.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
