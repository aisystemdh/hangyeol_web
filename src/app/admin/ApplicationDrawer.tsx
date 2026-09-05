"use client";

import { useEffect, useState } from "react";
import type { AdminApplicationDetail } from "@/lib/admin-data";
import { isMeScreenName, type MeScreenName } from "@/lib/me-screen";
import st from "./admin.module.css";

/**
 * 상세 서랍 (이슈 #34 AC) — 답변·돈 줄·발송 이력·조작 로그를 한 화면에 모은다.
 *
 * 🔴 `prompt()`/`confirm()`을 쓰지 않는다 — 화면 고정은 `<select>` 두 개(화면·조작자)와
 *    버튼 하나로 끝낸다.
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

function formatDT(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ApplicationDrawer({
  id,
  onClose,
  getActor,
  onScreenChanged,
  onMessage,
}: {
  id: string;
  onClose: () => void;
  getActor: () => string;
  onScreenChanged: () => void;
  onMessage: (msg: string) => void;
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

  useEffect(() => {
    // ⚠️ 여기서 `setLoading(true)`를 부르지 않는다 — 이펙트 본문에서 곧바로
    //    setState를 부르면 렌더가 한 번 더 겹친다(react-hooks/set-state-in-effect).
    //    `loading`의 초깃값이 이미 `true`이고, `Dashboard`가 이 컴포넌트를
    //    `key={id}`로 매번 새로 마운트하므로 사람이 바뀔 때도 다시 `true`로
    //    시작한다 — 그래서 이 이펙트는 끝날 때 `false`로 내리기만 한다.
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

  const applyScreen = async (screen: MeScreenName | null) => {
    const actor = getActor();
    if (!actor) {
      onMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/admin/applications/${id}/screen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screen, actor }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      onMessage(`실패: ${j.message ?? j.error ?? r.status}`);
      return;
    }
    onMessage(screen ? `화면을 「${SCREEN_LABELS[screen]}」로 고정했습니다.` : "화면 고정을 풀었습니다.");
    onScreenChanged();
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
                <dt>닉네임</dt>
                <dd>{detail.application.nick ?? "—"}</dd>
                <dt>메모</dt>
                <dd>{detail.application.memo ?? "—"}</dd>
              </dl>
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
              <h3>돈 줄 ({detail.money.length})</h3>
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
                        <td className={st.mono}>{m.amount.toLocaleString()}원</td>
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
