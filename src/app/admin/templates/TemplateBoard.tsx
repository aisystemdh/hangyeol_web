"use client";

import { useRef, useState, type FormEvent } from "react";
import type { AdminTemplateRow, Approval } from "@/lib/admin-templates";
import { looksLikeAccountNumber } from "@/lib/account-guard";
import { formatDT } from "@/lib/admin-format";
import { ActorSelect } from "../ActorSelect";
import { postAdminAction } from "../postAdminAction";
import st from "../admin.module.css";

/**
 * 문구 관리 화면 (이슈 #38). 운영자 셋이 배포 없이 알림톡 문구를 고친다.
 *
 * 🔴 **`id`는 만들 때만 정하고 이후 못 바꾼다** — `notification.ts`의 `TEMPLATE`
 *    상수가 이 문자열을 그대로 참조한다(`admin-templates.ts` 상단 주석과 같은 이유).
 *    수정 폼에는 아예 입력칸을 두지 않는다 — 지울 수 없게 만드는 것이 아니라
 *    처음부터 존재하지 않게 만든다.
 */

type ApprovalOption = { value: Approval; label: string };
const APPROVAL_OPTIONS: ApprovalOption[] = [
  { value: "REG", label: "REG · 등록만 함" },
  { value: "REQ", label: "REQ · 심사 요청함" },
  { value: "APR", label: "APR · 승인됨" },
  { value: "REJ", label: "REJ · 반려됨" },
];

type FormState = {
  id: string;
  label: string;
  body: string;
  whenHint: string;
  templateCode: string;
  approval: Approval;
  buttonName: string;
  smsBody: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: "",
  label: "",
  body: "",
  whenHint: "",
  templateCode: "",
  approval: "REG",
  buttonName: "",
  smsBody: "",
  active: true,
};

function toForm(t: AdminTemplateRow): FormState {
  return {
    id: t.id,
    label: t.label,
    body: t.body,
    whenHint: t.whenHint ?? "",
    templateCode: t.templateCode ?? "",
    approval: t.approval,
    buttonName: t.buttonName ?? "",
    smsBody: t.smsBody ?? "",
    active: t.active,
  };
}

export default function TemplateBoard({ initial }: { initial: AdminTemplateRow[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** `null` = 닫힘, `"new"` = 추가 폼, 그 외 = 그 id를 수정 중. */
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const actorRef = useRef<HTMLSelectElement>(null);
  const getActor = () => actorRef.current?.value ?? "";

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
    setMessage(null);
  };
  const openEdit = (t: AdminTemplateRow) => {
    setForm(toForm(t));
    setEditing(t.id);
    setMessage(null);
  };
  const close = () => setEditing(null);

  const accountWarning = looksLikeAccountNumber(form.body) || looksLikeAccountNumber(form.smsBody);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const actor = getActor();
    if (!actor) {
      setMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    if (!form.label.trim() || !form.body.trim()) {
      setMessage("이름과 본문은 비워둘 수 없습니다.");
      return;
    }

    const isNew = editing === "new";
    const url = isNew ? "/api/admin/templates" : `/api/admin/templates/${editing}`;
    const payload = {
      ...(isNew ? { id: form.id.trim() } : {}),
      label: form.label.trim(),
      body: form.body,
      whenHint: form.whenHint.trim() || undefined,
      templateCode: form.templateCode.trim() || undefined,
      approval: form.approval,
      buttonName: form.buttonName.trim() || undefined,
      smsBody: form.smsBody.trim() || undefined,
      active: form.active,
      actor,
    };

    setBusy(true);
    const res = await postAdminAction<{ items: AdminTemplateRow[] }>(url, payload, "저장 실패");
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setItems(res.data.items);
    setMessage(isNew ? "문구를 추가했습니다." : "문구를 저장했습니다.");
    setEditing(null);
  };

  const toggleActive = async (t: AdminTemplateRow) => {
    const actor = getActor();
    if (!actor) {
      setMessage("먼저 「조작하는 사람」을 골라주세요.");
      return;
    }
    setBusy(true);
    const res = await postAdminAction<{ items: AdminTemplateRow[] }>(
      `/api/admin/templates/${t.id}`,
      { ...toForm(t), active: !t.active, actor },
      "저장 실패",
    );
    setBusy(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setItems(res.data.items);
    setMessage(t.active ? `「${t.label}」을 비활성화했습니다.` : `「${t.label}」을 다시 켰습니다.`);
  };

  return (
    <>
      <header className={st.head}>
        <h1 className={st.h1}>문구 관리</h1>
        <ActorSelect id="actor" label="조작하는 사람" ref={actorRef} />
        <button className={st.btnPay} onClick={openNew} disabled={busy}>
          새 문구 추가
        </button>
      </header>

      {message && <p className={st.msg}>{message}</p>}

      <div className={st.tableWrap}>
        <table className={st.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>언제</th>
              <th>승인</th>
              <th>버튼</th>
              <th>상태</th>
              <th>고친 사람 · 시각</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className={t.active ? undefined : st.flag}>
                <td>
                  {t.label}
                  <div className={st.loginNote}>{t.id}</div>
                </td>
                <td>{t.whenHint ?? "—"}</td>
                <td className={st.mono}>
                  {t.approval}
                  {t.templateCode && <div className={st.loginNote}>{t.templateCode}</div>}
                </td>
                <td>{t.buttonName ?? "—"}</td>
                <td>{t.active ? "켜짐" : "꺼짐"}</td>
                <td>
                  {t.updatedBy ?? "—"}
                  <div className={st.loginNote}>{formatDT(t.updatedAt)}</div>
                </td>
                <td className={st.actions}>
                  <button className={st.btnSm} onClick={() => openEdit(t)} disabled={busy}>
                    수정
                  </button>
                  <button className={st.btnSm} onClick={() => toggleActive(t)} disabled={busy}>
                    {t.active ? "비활성화" : "다시 켜기"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className={st.empty}>
                  아직 문구가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className={st.drawerBackdrop} onClick={close}>
          <aside
            className={st.drawer}
            onClick={(e) => e.stopPropagation()}
            aria-label={editing === "new" ? "문구 추가" : "문구 수정"}
          >
            <div className={st.drawerHead}>
              <h2 className={st.h1}>{editing === "new" ? "문구 추가" : `문구 수정 — ${form.label}`}</h2>
              <button className={st.btnSm} onClick={close}>
                닫기
              </button>
            </div>

            <form onSubmit={submit} className={st.form}>
              {editing === "new" && (
                <label>
                  코드 (영문·숫자·한글·-·_, 이후 못 바꿉니다)
                  <input
                    className={st.input}
                    value={form.id}
                    onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    required
                  />
                </label>
              )}
              <label>
                이름
                <input
                  className={st.input}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  required
                />
              </label>
              <label>
                언제 보내는지 (참고용)
                <input
                  className={st.input}
                  value={form.whenHint}
                  onChange={(e) => setForm((f) => ({ ...f, whenHint: e.target.value }))}
                />
              </label>
              <label>
                승인 상태
                <select
                  className={st.input}
                  value={form.approval}
                  onChange={(e) => setForm((f) => ({ ...f, approval: e.target.value as Approval }))}
                >
                  {APPROVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                승인받은 코드 (뿌리오 template code)
                <input
                  className={st.input}
                  value={form.templateCode}
                  onChange={(e) => setForm((f) => ({ ...f, templateCode: e.target.value }))}
                />
              </label>
              <label>
                버튼 이름 (비워두면 버튼 없음)
                <input
                  className={st.input}
                  value={form.buttonName}
                  onChange={(e) => setForm((f) => ({ ...f, buttonName: e.target.value }))}
                />
              </label>
              <label>
                본문 (변수는 <code>#{"{이름}"}</code> 형태로 — 이름·입금액·입금기한·링크·행사일·시간·장소·환불액·처리일만 쓸 수 있습니다)
                <textarea
                  className={st.input}
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  required
                />
              </label>
              <label>
                대체문자 문구 (알림톡 실패 시 발송, 90바이트 — 비워두면 대체 발송 안 함)
                <textarea
                  className={st.input}
                  rows={3}
                  value={form.smsBody}
                  onChange={(e) => setForm((f) => ({ ...f, smsBody: e.target.value }))}
                />
              </label>
              {accountWarning && (
                <p className={st.err}>
                  🔴 계좌번호처럼 보이는 숫자가 있습니다. 계좌는 문구에 직접 적지 않고 링크로만
                  보냅니다 — 계좌가 바뀔 때마다 문구를 다시 심사받게 됩니다.
                </p>
              )}
              {editing !== "new" && (
                <label className={st.actor}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  활성
                </label>
              )}
              <button type="submit" className={st.btnPay} disabled={busy}>
                저장
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
