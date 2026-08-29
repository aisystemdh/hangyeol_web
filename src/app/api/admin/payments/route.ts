import { NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { isAdmin, newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 참가비. 문자열 "39,000원"에서 숫자만 뽑아 쓴다 — 두 곳에 적지 않는다. */
const FEE = Number(EVENT.priceLabel.replace(/\D/g, ""));

/**
 * POST /api/admin/payments — 입금 기록
 *
 * 🔴 **네 가지를 한 트랜잭션으로 묶는다.**
 *      ① payment 행 생성 ② status → confirmed ③ 전이 로그 ④ participant + 토큰 발급
 *    중간에 끊기면 **돈은 받았는데 참가자가 없는** 상태가 된다.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as {
    applicant_id?: string;
    amount?: number;
    depositor?: string;
    deposited_at?: string;
    verified_by?: string;
    note?: string;
  };

  if (!b.applicant_id || !b.depositor || !b.verified_by || typeof b.amount !== "number") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const depositedAt = b.deposited_at ? new Date(b.deposited_at) : new Date();
  if (Number.isNaN(depositedAt.getTime())) {
    return NextResponse.json({ ok: false, error: "bad_date" }, { status: 400 });
  }

  try {
    const out = await tx(async (c) => {
      const cur = await c.query<{ status: string; gender: "M" | "F"; name: string }>(
        `select status, gender, name from applicant where id = $1 for update`,
        [b.applicant_id],
      );
      if (cur.rowCount === 0) return { code: 404, error: "not_found" };
      const from = cur.rows[0].status;
      // 자리를 쥐고 있지 않은 사람의 입금은 기록하지 않는다 —
      // 자리가 없는데 돈을 받은 상태가 그대로 환불 분쟁이 된다.
      if (from !== "awaiting_payment") {
        return { code: 409, error: "not_awaiting", from };
      }

      const pay = await c.query<{ id: string }>(
        `insert into payment (applicant_id, amount, depositor, deposited_at, verified_by, note)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [b.applicant_id, b.amount, b.depositor, depositedAt, b.verified_by, b.note ?? null],
      );

      await c.query(`update applicant set status = 'confirmed' where id = $1`, [b.applicant_id]);

      await c.query(
        `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
         values ($1,'awaiting_payment','confirmed',$2,$3)`,
        [b.applicant_id, `입금 확인 ${b.amount}원 · 입금자 ${b.depositor}`, b.verified_by],
      );

      // ④ 닉네임과 현장 토큰. 결1~결20 중 **가장 작은 빈 번호**를 준다.
      //
      // ⚠️ 번호 뽑기를 SQL 정규식으로 하지 말 것. `regexp_replace(nick, '\D', ...)`로
      //    짰다가 백슬래시가 한 겹 더 먹혀 「결1」이 그대로 정수 캐스팅으로 넘어갔다.
      //    첫 참가자는 표가 비어 있어 통과하고 **두 번째 입금에서 터진다**(실측).
      //    자바스크립트에서 자르면 이스케이프가 낄 자리가 없다.
      const used = await c.query<{ nick: string }>(`select nick from participant`);
      const taken = new Set(used.rows.map((r) => Number(r.nick.replace(/\D/g, ""))));
      let n = 1;
      while (taken.has(n)) n += 1;

      await c.query(
        `insert into participant (nick, applicant_id, site_token) values ($1,$2,$3)`,
        [`결${n}`, b.applicant_id, newToken()],
      );

      // 🟡 금액이 참가비와 다르면 저장은 하되 경고를 돌려준다.
      //    부분·초과 입금은 실제로 생긴다. 막아버리면 기록이 아예 안 남는다.
      const warn = b.amount !== FEE ? `금액이 ${FEE}원과 다릅니다 (${b.amount}원)` : null;
      return { code: 200, payment_id: pay.rows[0].id, nick: `결${n}`, warn };
    });

    if (out.code !== 200) {
      return NextResponse.json({ ok: false, ...out }, { status: out.code });
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: "already_paid" }, { status: 409 });
    }
    console.error("[admin/payments] 실패", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
