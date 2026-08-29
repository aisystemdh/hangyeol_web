import { NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { dueAtFrom } from "@/lib/deadline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 상태 전이. **허용된 전이만 통과시킨다.**
 *
 * 🔴 자리를 쥔 상태는 `awaiting_payment` 와 `confirmed` 둘이다.
 *    그 밖으로 나가면 **성별 슬롯을 반드시 되돌려준다** — 안 그러면 자리가 새서
 *    20명을 못 채운 채로 마감된다.
 */
const ALLOWED: Record<string, string[]> = {
  pre_registered: ["approved", "waitlist", "rejected"],
  approved: ["awaiting_payment", "waitlist", "rejected"],
  awaiting_payment: ["confirmed", "expired", "waitlist"],
  waitlist: ["approved"],
  confirmed: ["refund_requested"],
  refund_requested: ["refunded"],
  expired: ["waitlist"],
  rejected: [],
  refunded: [],
};

/** 이 상태에 있으면 성별 슬롯을 한 칸 쥐고 있다. */
const HOLDS_SLOT = new Set(["awaiting_payment", "confirmed"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await ctx.params;
  const { to, reason, actor } = (await req.json().catch(() => ({}))) as {
    to?: string;
    reason?: string;
    actor?: string;
  };
  if (!to || !actor) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    const result = await tx(async (c) => {
      const cur = await c.query<{ status: string; gender: "M" | "F" }>(
        `select status, gender from applicant where id = $1 for update`,
        [id],
      );
      if (cur.rowCount === 0) return { code: 404, error: "not_found" };
      const from = cur.rows[0].status;
      const gender = cur.rows[0].gender;

      if (!(ALLOWED[from] ?? []).includes(to)) {
        return { code: 409, error: "not_allowed", from, to };
      }

      const held = HOLDS_SLOT.has(from);
      const willHold = HOLDS_SLOT.has(to);

      if (held && !willHold) {
        // 자리를 놓는다. greatest(0, ...)로 음수 방지.
        await c.query(
          `update gender_slot set taken = greatest(0, taken - 1) where gender = $1`,
          [gender],
        );
      }
      if (!held && willHold) {
        const got = await c.query(
          `update gender_slot set taken = taken + 1
            where gender = $1 and taken < capacity returning taken`,
          [gender],
        );
        if (got.rowCount === 0) return { code: 409, error: "full", gender };
      }

      const now = new Date();
      const setDue = to === "awaiting_payment";
      await c.query(
        `update applicant
            set status = $2,
                notified_at = case when $3 then now() else notified_at end,
                due_at      = case when $3 then $4 else due_at end
          where id = $1`,
        [id, to, setDue, setDue ? dueAtFrom(now) : null],
      );

      await c.query(
        `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
         values ($1, $2, $3, $4, $5)`,
        [id, from, to, reason ?? null, actor],
      );

      return { code: 200, from, to };
    });

    if (result.code !== 200) {
      return NextResponse.json({ ok: false, ...result }, { status: result.code });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[admin/transition] 실패", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
