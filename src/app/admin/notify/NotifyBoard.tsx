"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminApplicationRow } from "@/lib/admin-list";
import type {
  NotifyFailedRow,
  NotifyPreviewItem,
  NotifyTemplateOption,
  NotifyTodoRow,
} from "@/lib/admin-notify";
import { formatDT } from "@/lib/admin-format";
import { ActorSelect } from "../ActorSelect";
import st from "../admin.module.css";

/**
 * 알림톡 발송 화면 (이슈 #37).
 *
 * 순서: 사람을 고른다(위 두 안전장치 목록 또는 아래 전체 명단에서 체크) → 문구를
 * 고른다 → 「미리보기」로 그 사람에게 갈 문구 그대로 확인한다 → 「보내기」.
 *
 * 🔴 **채우지 못한 변수가 있으면 보내기 버튼을 잠근다**(AC). 미리보기 결과의
 *    `missing`을 보고 여기서 막는다 — 서버(`/api/admin/notify/send` →
 *    `sendTemplate`)도 같은 이유로 다시 막으므로 이건 사용성을 위한 **첫 번째 문**일
 *    뿐이다(`CLAUDE.md` "화면에서 한 번, API 하나하나에서 또 한 번"과 같은 태도).
 * 🔴 **미리보기와 실제 발송의 짝이 어긋나지 않게 한다.** 미리보기를 만든 뒤 선택이나
 *    문구를 바꾸면 그 미리보기는 못 믿는다 — `selectionKey`로 "이 미리보기가 지금
 *    선택과 같은가"를 판정해, 다르면 다시 미리보기부터 하게 한다. (그 반대 —
 *    미리보기를 만든 뒤 다른 운영자가 그 사이 돈 줄·정식등록 값을 바꿔 실제로
 *    나가는 문구가 살짝 달라지는 경우 — 는 막지 않는다. `seats.ts`가 자리 세기를
 *    잠그지 않은 것과 같은 태도다: 운영자 셋이 몇 초 사이에 같은 사람의 같은 값을
 *    동시에 건드릴 일은 사실상 없고, 그걸 막으려는 장치가 오히려 "미리보기 후 3초
 *    안에 보내야 한다" 같은 새 제약을 만든다.)
 */

const REASON_LABEL: Record<string, string> = {
  기한임박: "기한 임박",
  확정후미발송: "확정 후 미발송",
  행사임박: "행사 임박",
};

type ItemsBody = { ok: boolean; data?: { items: AdminApplicationRow[] } };
type NotifyBody = {
  ok: boolean;
  data?: { todo: NotifyTodoRow[]; failed: NotifyFailedRow[]; templates: NotifyTemplateOption[] };
};
type PreviewBody = {
  ok: boolean;
  data?: { items: NotifyPreviewItem[]; notFoundIds: string[] };
  message?: string;
  error?: string;
};
type SendBody = {
  ok: boolean;
  data?: {
    results: { applicationId: string; ok: boolean; notificationId: string | null; reason?: string }[];
    notFoundIds: string[];
  };
  message?: string;
  error?: string;
};

export default function NotifyBoard({
  initialApplications,
  initialTodo,
  initialFailed,
  templates: initialTemplates,
}: {
  initialApplications: AdminApplicationRow[];
  initialTodo: NotifyTodoRow[];
  initialFailed: NotifyFailedRow[];
  templates: NotifyTemplateOption[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [todo, setTodo] = useState(initialTodo);
  const [failed, setFailed] = useState(initialFailed);
  const [templates, setTemplates] = useState(initialTemplates);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState("");
  const [query, setQuery] = useState("");

  const [preview, setPreview] = useState<PreviewBody["data"] | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 🔴 공유 비밀번호라 서버는 누가 눌렀는지 모른다 — `ActorSelect.tsx`가 되살리고
  //    저장하는 방법을 담당한다. 여기서는 값만 읽는다.
  const actorRef = useRef<HTMLSelectElement>(null);

  const load = useCallback(async () => {
    const [appsRes, notifyRes] = await Promise.all([
      fetch("/api/admin/applications"),
      fetch("/api/admin/notify"),
    ]);
    if (appsRes.status === 401 || notifyRes.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    const appsJson = (await appsRes.json()) as ItemsBody;
    const notifyJson = (await notifyRes.json()) as NotifyBody;
    setApplications(appsJson.data?.items ?? []);
    setTodo(notifyJson.data?.todo ?? []);
    setFailed(notifyJson.data?.failed ?? []);
    if (notifyJson.data?.templates) setTemplates(notifyJson.data.templates);
  }, []);

  useEffect(() => {
    // ⚠️ 첫 데이터는 서버가 이미 넘겼다 — `Dashboard.tsx`와 같은 이유로 30초 뒤부터 갱신한다.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMany = (ids: string[]) => {
    setSelected((prev) => {
      const allIn = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const filteredApplications = useMemo(() => {
    const needle = query.trim();
    if (!needle) return applications;
    const digits = needle.replace(/\D/g, "");
    return applications.filter(
      (a) => a.name.includes(needle) || (digits.length > 0 && a.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [applications, query]);

  // 지금 고른 사람들 + 문구를 하나의 열쇠로 — 미리보기가 이 값과 어긋나면 못 믿는다.
  const selectionKey = useMemo(
    () => `${templateId}::${[...selected].sort().join(",")}`,
    [templateId, selected],
  );
  const previewStale = preview !== null && previewKey !== selectionKey;

  const canPreview = selected.size > 0 && templateId !== "" && !previewLoading;
  const canSend =
    !previewStale &&
    !sendLoading &&
    (preview?.items.length ?? 0) > 0 &&
    (preview?.items.every((i) => i.missing.length === 0) ?? false);

  const doPreview = async () => {
    setPreviewLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/notify/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: [...selected], templateId }),
      });
      const j = (await r.json().catch(() => ({}))) as PreviewBody;
      if (!r.ok || !j.ok) {
        setMsg(`미리보기 실패: ${j.message ?? j.error ?? r.status}`);
        return;
      }
      setPreview(j.data ?? { items: [], notFoundIds: [] });
      setPreviewKey(selectionKey);
    } catch {
      // 🔴 네트워크가 끊기는 등 `fetch` 자체가 실패해도 로딩 상태에 갇히지 않는다 —
      //    finally에서 반드시 풀어야 「미리보기」·「보내기」 버튼이 영영 안 눌리는
      //    사고를 피한다(2026-09-06 코드리뷰).
      setMsg("미리보기 요청을 보내지 못했습니다. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const doSend = async () => {
    const actor = actorRef.current?.value ?? "";
    if (!actor) {
      setMsg("먼저 「보내는 사람」을 골라주세요.");
      return;
    }
    setSendLoading(true);
    try {
      const r = await fetch("/api/admin/notify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationIds: [...selected], templateId, actor }),
      });
      const j = (await r.json().catch(() => ({}))) as SendBody;
      if (!r.ok || !j.ok) {
        setMsg(`발송 실패: ${j.message ?? j.error ?? r.status}`);
        return;
      }
      const results = j.data?.results ?? [];
      const notFoundCount = j.data?.notFoundIds.length ?? 0;
      const okCount = results.filter((x) => x.ok).length;
      const failCount = results.length - okCount;
      const parts = [`${okCount}명에게 보냈습니다.`];
      if (failCount > 0) {
        parts.push(`${failCount}명은 실패했습니다 — 「보내다 실패한 것」에서 확인하세요.`);
      }
      // 🔴 미리보기 이후 다른 화면에서 취소되는 등 드문 경우에만 생긴다 — 이 사람들은
      //    "보냈다"에도 "실패했다"에도 안 들어가므로 조용히 넘기면 몇 명에게 실제로
      //    나갔는지 운영자가 착각한다.
      if (notFoundCount > 0) parts.push(`${notFoundCount}명은 찾을 수 없어 건너뛰었습니다.`);
      setMsg(parts.join(" "));
      setSelected(new Set());
      setPreview(null);
      setPreviewKey(null);
      await load();
    } catch {
      setMsg("발송 요청을 보내지 못했습니다. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setSendLoading(false);
    }
  };

  const todoIds = todo.map((r) => r.id);
  const failedAppIds = [...new Set(failed.map((r) => r.applicationId))];
  const shownIds = filteredApplications.map((r) => r.id);

  return (
    <>
      <header className={st.head}>
        <h1 className={st.h1}>알림톡</h1>
        <ActorSelect id="notify-actor" label="보내는 사람" ref={actorRef} />
      </header>

      {msg && (
        <p className={st.msg} role="status">
          {msg}
        </p>
      )}

      <section>
        <h2 className={st.h2}>
          오늘 보낼 것 ({todo.length})
        </h2>
        <p className={st.loginNote}>
          자동화는 신청 직후 입금 안내 하나뿐입니다. 기한이 임박했거나, 입금은 확인됐는데
          「자리확정」 안내를 아직 못 보냈거나, 행사가 이틀 앞으로 다가온 사람을 모았습니다.
        </p>
        {todo.length === 0 ? (
          <p className={st.empty}>지금 챙길 것이 없습니다.</p>
        ) : (
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={todoIds.length > 0 && todoIds.every((id) => selected.has(id))}
                      onChange={() => toggleMany(todoIds)}
                      aria-label="오늘 보낼 것 전체 선택"
                    />
                  </th>
                  <th>#</th>
                  <th>이름</th>
                  <th>상태</th>
                  <th>연락처</th>
                  <th>기한</th>
                  <th>이유</th>
                </tr>
              </thead>
              <tbody>
                {todo.map((r) => (
                  <tr key={r.id} className={st.flag}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={`${r.name} 선택`}
                      />
                    </td>
                    <td>{r.seq}</td>
                    <td>{r.name}</td>
                    <td>{r.status}</td>
                    <td className={st.mono}>{r.phone}</td>
                    <td className={st.mono}>{formatDT(r.dueAt)}</td>
                    <td>{r.reasons.map((x) => REASON_LABEL[x] ?? x).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className={st.h2}>
          보내다 실패한 것 ({failed.length})
        </h2>
        <p className={st.loginNote}>
          자동 재시도는 없습니다. 번호가 맞는지 확인한 뒤, 아래에서 다시 골라 보내세요.
        </p>
        {failed.length === 0 ? (
          <p className={st.empty}>실패한 발송이 없습니다.</p>
        ) : (
          <div className={st.tableWrap}>
            <table className={st.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={failedAppIds.length > 0 && failedAppIds.every((id) => selected.has(id))}
                      onChange={() => toggleMany(failedAppIds)}
                      aria-label="실패한 것 전체 선택"
                    />
                  </th>
                  <th>이름</th>
                  <th>연락처</th>
                  <th>문구</th>
                  <th>실패 사유</th>
                  <th>보낸 사람</th>
                  <th>시각</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((r) => (
                  <tr key={r.id} className={st.flag}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.applicationId)}
                        onChange={() => toggle(r.applicationId)}
                        aria-label={`${r.name} 선택`}
                      />
                    </td>
                    <td>{r.name}</td>
                    <td className={st.mono}>{r.phone}</td>
                    <td>{r.templateLabel ?? r.templateId ?? "—"}</td>
                    <td className={st.warn}>{r.error ?? "—"}</td>
                    <td>{r.sentBy ?? "—"}</td>
                    <td className={st.mono}>{formatDT(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className={st.h2}>
          보내기 — {selected.size}명 선택됨
        </h2>
        <div className={st.filters}>
          <select
            className={st.inputSm}
            style={{ width: 220 }}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">문구 선택</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.autoSend ? " (자동)" : ""}
              </option>
            ))}
          </select>
          <button className={st.btnSm} disabled={!canPreview} onClick={doPreview}>
            {previewLoading ? "미리보기 만드는 중…" : "미리보기"}
          </button>
          <button className={st.btnPay} disabled={!canSend} onClick={doSend}>
            {sendLoading ? "보내는 중…" : "보내기"}
          </button>
          {selected.size > 0 && (
            <button className={st.btnSm} onClick={() => setSelected(new Set())}>
              선택 해제
            </button>
          )}
        </div>

        {preview && (
          <div className={st.tableWrap} style={{ marginBottom: 16 }}>
            {previewStale && (
              <p className={st.msg} role="status">
                선택이나 문구가 바뀌었습니다 — 다시 「미리보기」를 눌러 확인하세요.
              </p>
            )}
            {preview.notFoundIds.length > 0 && (
              <p className={st.err}>
                {preview.notFoundIds.length}명은 찾을 수 없습니다(다른 화면에서 취소됐을 수 있습니다).
              </p>
            )}
            <ul className={st.plainList} style={{ padding: 12 }}>
              {preview.items.map((it) => (
                <li key={it.id}>
                  <strong>
                    {it.name} <span className={st.mono}>{it.phone}</span>
                  </strong>
                  {it.missing.length > 0 && (
                    <p className={st.err}>채우지 못한 변수: {it.missing.join(", ")}</p>
                  )}
                  <pre className={st.pre}>{it.text}</pre>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className={st.h2}>
          전체 신청자
        </h2>
        <div className={st.filters}>
          <input
            type="search"
            className={st.inputSm}
            placeholder="이름 또는 연락처 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={shownIds.length > 0 && shownIds.every((id) => selected.has(id))}
                    onChange={() => toggleMany(shownIds)}
                    aria-label="전체 선택"
                  />
                </th>
                <th>#</th>
                <th>이름</th>
                <th>상태</th>
                <th>연락처</th>
                <th>마지막 발송</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`${r.name} 선택`}
                    />
                  </td>
                  <td>{r.seq}</td>
                  <td>{r.name}</td>
                  <td>{r.status}</td>
                  <td className={st.mono}>{r.phone}</td>
                  <td>
                    {r.lastNotifiedAt
                      ? `${formatDT(r.lastNotifiedAt)} · ${r.lastNotifiedLabel ?? "—"}${
                          r.lastNotifiedStatus === "실패" ? " ⚠️" : ""
                        }`
                      : "—"}
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={6} className={st.empty}>
                    조건에 맞는 신청이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
