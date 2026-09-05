import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { recordPayment } from "@/lib/admin-data";
import { parseMoneyBody, type MoneyBodyInput } from "@/lib/payment";
import { EVENT } from "@/lib/event";
import { paidSeats, remainingSeats } from "@/lib/seats";

/**
 * POST /api/admin/applications/[id]/payment — 입금 확인 (이슈 #35).
 *
 * 🔴 **이 시스템에서 자리가 차는 유일한 순간이다.** 상태를 `입금완료`로 바꾸는 것과
 *    돈 줄에 「+금액 입금」 한 줄을 쌓는 것이 `recordPayment`(admin-data.ts) 안에서
 *    **한 트랜잭션**으로 함께 일어난다 — 여기서는 입력을 검증해 넘기기만 한다.
 *
 * body: `{ amount, occurredAt, depositorName, note?, actor }`.
 * 🔴 금액이 39,000원이 아니어도 **막지 않는다** — 그대로 저장하고 `amountMismatch`만
 *    응답에 실어 화면이 표시하게 한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = MoneyBodyInput & { actor?: unknown };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const actor = normalizeActor(body.actor);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "invalid_actor", message: "조작하는 사람을 목록에서 골라주세요." },
      { status: 400 },
    );
  }

  const parsed = parseMoneyBody(body, { requireDepositorName: true });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error, message: parsed.message }, { status: 400 });
  }

  const result = await recordPayment(id, {
    amount: parsed.amount,
    occurredAt: parsed.occurredAt,
    depositorName: parsed.depositorName,
    note: parsed.note,
    actor,
  });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: "cancelled", message: "취소된 신청에는 입금을 확인할 수 없습니다." },
      { status: 400 },
    );
  }

  /**
   * 🔴 정원이 찼어도 입금 확인 자체는 막지 않는다(이슈 #35 AC — 돈은 이미 들어왔다).
   *    대신 방금 반영된 **실제** 자리 현황을 함께 돌려줘 화면이 경고 문구를 띄우게
   *    한다 — `confirm()` 금지 규칙과 부딪히지 않으면서, 클라이언트가 들고 있던
   *    (30초 전에 받았을 수도 있는) 자리 수 대신 서버가 방금 커밋한 값을 기준으로
   *    판단하게 한다.
   */
  const taken = await paidSeats(EVENT.id);
  const remaining = remainingSeats(taken);
  const overCapacity = remaining[result.gender] <= 0;

  return NextResponse.json({
    ok: true,
    data: { amountMismatch: result.amountMismatch, overCapacity, remaining },
  });
}
