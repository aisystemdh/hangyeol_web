import "server-only";
import { isUniqueViolation, q } from "./db";

/**
 * 문구 관리 화면이 읽고 쓰는 데이터 한 벌 (이슈 #38).
 *
 * 🔴 **문구가 바뀌어도 과거 발송 기록은 안 바뀐다** — `notification.body`는 보낼 때
 *    이미 채워 넣은 문구의 **복사본**이다(`005_rebuild.sql`의 같은 주석). 이 파일은
 *    `notification_template`만 건드리고 `notification`은 절대 쓰지 않는다.
 *
 * 🔴 **`id`·`channel`·`auto_send`·`sort_order`는 수정 화면에서 못 바꾼다.**
 *    - `id` — `notification.ts`의 `TEMPLATE` 상수와 코드 곳곳이 이 문자열을 그대로
 *      참조한다. 바꾸면 그 참조들이 조용히 문구를 못 찾게 된다.
 *    - `channel` — 지금 발송 코드(`notification.ts`)는 이 값을 보지 않고 무조건
 *      알림톡으로 보낸다. `sms`·`email`을 고를 수 있게 하면 "그 채널로 나간다"는
 *      거짓 기대를 만든다 — 그 배선이 생기기 전까지는 항상 `alimtalk`로 심는다.
 *    - `auto_send` — 자동 발송 여부는 이 깃발이 아니라 코드가 어디서 `sendTemplate`을
 *      부르는지가 정한다(`notification.ts` 상단 주석). 화면에서 켜고 꺼도 실제
 *      동작은 안 바뀌니 아예 노출하지 않는다.
 *    - `sort_order` — 목록 정렬용. 새 문구는 항상 맨 뒤에 붙는다.
 */

export type Approval = "REG" | "REQ" | "APR" | "REJ";
const APPROVALS: readonly Approval[] = ["REG", "REQ", "APR", "REJ"];
export function isApproval(v: unknown): v is Approval {
  return typeof v === "string" && (APPROVALS as readonly string[]).includes(v);
}

export type AdminTemplateRow = {
  id: string;
  label: string;
  body: string;
  whenHint: string | null;
  autoSend: boolean;
  templateCode: string | null;
  approval: Approval;
  /** 버튼 이름. 지금 아홉 개는 전부 버튼이 0개 아니면 1개뿐이라 그 모양만 다룬다. */
  buttonName: string | null;
  smsBody: string | null;
  sortOrder: number;
  active: boolean;
  updatedBy: string | null;
  updatedAt: string;
};

type Row = {
  id: string;
  label: string;
  body: string;
  when_hint: string | null;
  auto_send: boolean;
  template_code: string | null;
  approval: Approval;
  buttons: { name: string; type: string }[] | null;
  sms_body: string | null;
  sort_order: number;
  active: boolean;
  updated_by: string | null;
  updated_at: Date;
};

function toRow(r: Row): AdminTemplateRow {
  return {
    id: r.id,
    label: r.label,
    body: r.body,
    whenHint: r.when_hint,
    autoSend: r.auto_send,
    templateCode: r.template_code,
    approval: r.approval,
    buttonName: r.buttons?.[0]?.name ?? null,
    smsBody: r.sms_body,
    sortOrder: r.sort_order,
    active: r.active,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at.toISOString(),
  };
}

const COLUMNS = `id, label, body, when_hint, auto_send, template_code, approval, buttons, sms_body, sort_order, active, updated_by, updated_at`;

/** 활성·비활성 전부. 비활성도 보여야 운영자가 다시 켤 수 있다. */
export async function loadTemplates(): Promise<AdminTemplateRow[]> {
  const rows = await q<Row>(`select ${COLUMNS} from notification_template order by sort_order, id`);
  return rows.map(toRow);
}

export type TemplateInput = {
  label: string;
  body: string;
  whenHint: string | null;
  templateCode: string | null;
  approval: Approval;
  buttonName: string | null;
  smsBody: string | null;
};

function buttonsJson(name: string | null): string | null {
  return name ? JSON.stringify([{ name, type: "WL" }]) : null;
}

export type WriteResult = { ok: true } | { ok: false; error: string; message: string };

/** 새 문구. `id`는 만들 때만 정하고 이후 못 바꾼다. */
export async function createTemplate(
  id: string,
  input: TemplateInput,
  actor: string,
): Promise<WriteResult> {
  try {
    await q(
      `insert into notification_template
         (id, label, body, when_hint, template_code, approval, buttons, sms_body, sort_order, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8,
         coalesce((select max(sort_order) + 1 from notification_template), 1), $9)`,
      [
        id,
        input.label,
        input.body,
        input.whenHint,
        input.templateCode,
        input.approval,
        buttonsJson(input.buttonName),
        input.smsBody,
        actor,
      ],
    );
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "duplicate_id", message: `이미 있는 코드입니다: ${id}` };
    }
    throw err;
  }
}

/** 문구 수정 · 활성/비활성 전환. `id`는 여기서 절대 바꾸지 않는다. */
export async function updateTemplate(
  id: string,
  input: TemplateInput & { active: boolean },
  actor: string,
): Promise<WriteResult> {
  const updated = await q<{ id: string }>(
    `update notification_template
        set label = $2, body = $3, when_hint = $4, template_code = $5, approval = $6,
            buttons = $7::jsonb, sms_body = $8, active = $9, updated_by = $10
      where id = $1
      returning id`,
    [
      id,
      input.label,
      input.body,
      input.whenHint,
      input.templateCode,
      input.approval,
      buttonsJson(input.buttonName),
      input.smsBody,
      input.active,
      actor,
    ],
  );
  if (updated.length === 0) {
    return { ok: false, error: "not_found", message: "문구를 찾지 못했습니다." };
  }
  return { ok: true };
}

export type RawTemplateBody = {
  id?: unknown;
  label?: unknown;
  body?: unknown;
  whenHint?: unknown;
  templateCode?: unknown;
  approval?: unknown;
  buttonName?: unknown;
  smsBody?: unknown;
  active?: unknown;
};

export type ParsedTemplateInput =
  | { ok: true; id: string; input: TemplateInput & { active: boolean } }
  | { ok: false; error: string; message: string };

const ID_PATTERN = /^[a-zA-Z0-9가-힣_-]{1,50}$/;

/**
 * 🔴 **화면 검증을 믿지 않는다** — 다른 운영자 API와 같은 이유로 서버에서 다시 본다.
 *    생성·수정 두 라우트가 이 함수 하나를 같이 쓴다 — 필드 이름이 하나라도 어긋나면
 *    두 화면(추가 폼·수정 폼)이 같은 오류에 다르게 반응하게 된다.
 */
export function parseTemplateInput(
  raw: RawTemplateBody,
  opts: { requireId: boolean },
): ParsedTemplateInput {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (opts.requireId && !ID_PATTERN.test(id)) {
    return {
      ok: false,
      error: "invalid_id",
      message: "코드는 영문·숫자·한글·-·_ 1~50자여야 합니다.",
    };
  }

  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label) return { ok: false, error: "invalid_label", message: "이름을 입력해주세요." };

  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!body) return { ok: false, error: "invalid_body", message: "본문을 입력해주세요." };

  if (!isApproval(raw.approval)) {
    return { ok: false, error: "invalid_approval", message: "승인 상태를 골라주세요." };
  }

  const optional = (v: unknown): string | null => {
    const t = typeof v === "string" ? v.trim() : "";
    return t || null;
  };
  const templateCode = optional(raw.templateCode);

  // 🔴 코드리뷰(2026-09-06) — 승인됨(APR)인데 코드가 비어 있으면 화면은 "승인됨"으로
  //    보이지만 발송은 계속 `template_code`가 없어 실패한다. 그 어긋남을 저장 시점에 잡는다.
  if (raw.approval === "APR" && !templateCode) {
    return {
      ok: false,
      error: "missing_template_code",
      message: "승인(APR) 상태에는 승인받은 코드를 함께 적어야 합니다.",
    };
  }

  // 🔴 대체문자는 90바이트뿐이다(`docs/decisions/003…` §5 결정 9 · `notification.ts`
  //    `AlimtalkButton.smsBody`). 넘으면 그 자리에서 조용히 잘리거나 대행사가 거절한다 —
  //    저장할 때 미리 막아야 발송 실패로 처음 알게 되는 일이 없다.
  const smsBody = optional(raw.smsBody);
  if (smsBody && Buffer.byteLength(smsBody, "utf8") > 90) {
    return {
      ok: false,
      error: "sms_body_too_long",
      message: `대체문자 문구는 90바이트까지입니다(지금 ${Buffer.byteLength(smsBody, "utf8")}바이트).`,
    };
  }

  if (raw.active !== undefined && raw.active !== true && raw.active !== false) {
    return { ok: false, error: "invalid_active", message: "활성 여부가 올바르지 않습니다." };
  }

  return {
    ok: true,
    id,
    input: {
      label,
      body,
      whenHint: optional(raw.whenHint),
      templateCode,
      approval: raw.approval,
      buttonName: optional(raw.buttonName),
      smsBody,
      active: raw.active !== false,
    },
  };
}
