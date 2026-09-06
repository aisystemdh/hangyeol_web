import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { recordRefund } from "@/lib/admin-data";
import { parseMoneyBody, type MoneyBodyInput } from "@/lib/payment";

/**
 * POST /api/admin/applications/[id]/refund — 환불을 돈 줄에 쌓는다 (이슈 #35 AC).
 *
 * 🔴 상태는 건드리지 않는다 — 취소는 `.../cancel`로 따로 한다. 부분 환불처럼
 *    자리를 유지한 채 돈만 돌려주는 경우가 있어 둘을 하나로 묶지 않는다
 *    (`admin-data.ts`의 `recordRefund` 주석 참고).
 *
 * body: `{ amount, occurredAt, depositorName?, note?, actor }` — 환불은 입금과 달리
 * 입금자명이 없어도(예: 계좌 확인 없이 처리한 경우) 기록할 수 있게 선택으로 둔다.
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

  const parsed = parseMoneyBody(body, { requireDepositorName: false });
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error, message: parsed.message }, { status: 400 });
  }

  const result = await recordRefund(id, {
    amount: parsed.amount,
    occurredAt: parsed.occurredAt,
    depositorName: parsed.depositorName,
    note: parsed.note,
    actor,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
