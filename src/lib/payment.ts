import { EVENT_SCHEMA } from "./event";

/**
 * 입금 확인·돈 줄 — 순수 판정 로직만 모은 자리 (이슈 #35).
 *
 * `admin-list.ts`·`seats.ts`와 같은 자리다 — DB·시계를 직접 읽지 않고, 부르는 쪽
 * (`admin-data.ts`)이 값을 가져와 넘긴다. ⚠️ 이 파일만 따로 검사하는 테스트를 만들지
 * 않는다(`CLAUDE.md` "테스트") — 실제 라우트(`tests/admin-payment.test.ts`)를 통해서만 검사한다.
 */

/**
 * 기대 입금액. `EVENT_SCHEMA.priceKRW`(schema.org용 숫자 문자열, `event.ts`)에서
 * 그대로 파생한다 — 39000이라는 숫자를 여기 다시 적으면 참가비가 바뀔 때 한 곳을 놓친다.
 */
export const EXPECTED_DEPOSIT_KRW = Number(EVENT_SCHEMA.priceKRW);

/**
 * 🔴 금액이 기대값과 달라도 **막지 않는다**(이슈 #35) — 표시만 한다.
 *    40,000원을 보내는 사람, 두 번에 나눠 보내는 사람이 반드시 생긴다.
 */
export function isAmountMismatch(amount: number): boolean {
  return amount !== EXPECTED_DEPOSIT_KRW;
}

export type MoneyRow = { kind: "입금" | "환불"; amount: number };

/**
 * 그 사람이 실제로 낸 돈 — 「입금 합 − 환불 합」(`CONTEXT.md` "돈 줄").
 *
 * 🔴 돈 줄은 덧붙이기만 하는 표다(insert-only) — 이 함수가 매번 전체 줄을 다시
 *    더해서 지금 값을 만든다. 어딘가에 "누적 잔액" 칸을 따로 두면 그 칸이
 *    거짓말을 하기 시작하는 순간을 아무도 알아채지 못한다.
 */
export function netPaid(rows: readonly MoneyRow[]): number {
  return rows.reduce((sum, r) => sum + (r.kind === "입금" ? r.amount : -r.amount), 0);
}

/**
 * `<input type="datetime-local">`이 주는 값("2026-09-10T14:30")에는 시간대가 없다.
 * 운영자가 은행 앱에서 본 시각은 항상 한국 시각이므로, 시간대가 안 붙어 있으면
 * KST(+09:00)로 못박는다 — 안 그러면 서버가 UTC로 읽어 9시간이 밀린 「통장에 찍힌
 * 시각」이 저장된다(배포 환경과 로컬 개발 환경의 서버 시간대가 다를 때만 드러나는
 * 종류의 버그라 눈에 잘 안 띈다).
 */
function withKstIfMissing(raw: string): string {
  return /[zZ]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}${raw.length <= 16 ? ":00" : ""}+09:00`;
}

export type MoneyBodyInput = {
  amount?: unknown;
  occurredAt?: unknown;
  depositorName?: unknown;
  note?: unknown;
};

export type ParsedMoneyInput =
  | {
      ok: true;
      amount: number;
      occurredAt: Date;
      depositorName: string | null;
      note: string | null;
    }
  | { ok: false; error: string; message: string };

/**
 * 요청 본문에서 돈 줄 한 줄에 필요한 값을 꺼내 검증한다. 순수 함수 — DB도, 시계도
 * 보지 않는다. 🔴 **금액 크기는 검증하되 "39,000원인가"는 검증하지 않는다** —
 * 그건 표시 규칙(`isAmountMismatch`)이지 입력 거부 규칙이 아니다(이슈 #35).
 */
export function parseMoneyBody(
  body: MoneyBodyInput,
  opts: { requireDepositorName: boolean },
): ParsedMoneyInput {
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount", message: "금액을 원 단위 양수로 입력해주세요." };
  }

  if (typeof body.occurredAt !== "string" || body.occurredAt.trim() === "") {
    return { ok: false, error: "invalid_occurred_at", message: "입금 시각을 입력해주세요." };
  }
  const occurredAt = new Date(withKstIfMissing(body.occurredAt));
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false, error: "invalid_occurred_at", message: "입금 시각을 확인해주세요." };
  }

  const depositorNameRaw = typeof body.depositorName === "string" ? body.depositorName.trim() : "";
  if (opts.requireDepositorName && !depositorNameRaw) {
    return { ok: false, error: "invalid_depositor_name", message: "입금자명을 입력해주세요." };
  }

  const noteRaw = typeof body.note === "string" ? body.note.trim() : "";

  return {
    ok: true,
    amount,
    occurredAt,
    depositorName: depositorNameRaw || null,
    note: noteRaw || null,
  };
}
