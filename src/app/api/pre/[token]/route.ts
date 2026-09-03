import { NextResponse } from "next/server";
import { q, tx } from "@/lib/db";
import { isRealDate } from "@/lib/age";
import { dueAtFrom, isClosed } from "@/lib/deadline";
import { COPY } from "@/lib/form9-copy";
import { biz } from "@/lib/biz";

/**
 * 폼 9 · **1단계** — 참가 신청 확인 + 결제 정보 (자리 확보)
 *
 * 근거: `7_폼/한결_폼9_개발명세.md` §2·§3 · 2026-08-30 소유자 결정(2단계 분리)
 *
 * 🔴 **여기서는 문항을 한 글자도 내려보내지 않는다.** 문항은 영업비밀이고,
 *    입금이 확인된 사람만 2단계(`/api/q/:token`)에서 받는다.
 * 🔴 **자리는 이 단계의 제출 시점에 잡는다.** 입금 시점으로 옮기지 말 것 —
 *    25명이 동시에 입금하면 5명을 환불해야 하고 그게 그대로 분쟁이 된다.
 * 🔴 로그인이 없다. 링크에 박힌 토큰이 곧 신원이다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

type Applicant = {
  id: string;
  name: string;
  gender: "M" | "F";
  phone: string;
  birth: string;
  status: string;
  submitted_at: string | null;
  due_at: string | null;
};

/**
 * 1단계 화면이 쓰는 문구만 골라 보낸다.
 * 🔴 `COPY`를 통째로 보내지 않는다 — 2단계 문안까지 같이 나가면 경계가 흐려지고,
 *    나중에 문항을 COPY에 얹는 사람이 생기면 그대로 샌다.
 */
const STAGE1_COPY = {
  start: COPY.start,
  identity: COPY.identity,
  payment: COPY.payment,
  done: COPY.done,
  already: COPY.already,
  full: COPY.full,
  closed: COPY.closed,
  unknown: COPY.unknown,
};

const err = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

// 🔴 #9 핫픽스 — 운영자 전이표(transition/route.ts)의 HOLDS_SLOT/ALLOWED와 뜻을 맞춘다.
//    이미 자리를 쥔 상태(awaiting_payment/confirmed)에서 제출하면 +1을 또 하지 않고,
//    더는 후보가 아닌 상태(rejected/expired/refunded)면 pre_token이 살아 있어도 거절한다.
const HOLDS_SLOT_STATUS = new Set(["awaiting_payment", "confirmed"]);
const NOT_ELIGIBLE_STATUS = new Set(["rejected", "expired", "refunded"]);

async function findByToken(token: string): Promise<Applicant | null> {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) return null;
  const rows = await q<Applicant>(
    `select id, name, gender, phone, birth::text as birth, status,
            submitted_at::text as submitted_at, due_at::text as due_at
       from applicant where pre_token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const a = await findByToken(token);
    if (!a) return err("unknown_token", 404);

    // 이미 낸 사람이 우선이다 — 마감됐어도 완료 화면(계좌·기한)을 다시 보여준다.
    // 링크를 다시 열어보는 가장 흔한 이유가 「계좌번호가 뭐였지」이기 때문이다.
    if (a.submitted_at) {
      return NextResponse.json({
        ok: true,
        submitted: true,
        due_at: a.due_at,
        name: a.name,
        copy: { already: COPY.already, done: COPY.done },
        biz: biz(),
      });
    }

    if (isClosed()) {
      return NextResponse.json({
        ok: true,
        submitted: false,
        closed: true,
        copy: { closed: COPY.closed },
      });
    }

    return NextResponse.json({
      ok: true,
      submitted: false,
      closed: false,
      // 화면이 미리 채워 보여줄 값. 참가자가 자기 이름을 다시 타이핑하게 하지 않는다.
      prefill: { name: a.name, gender: a.gender, phone: a.phone, birth: a.birth },
      copy: STAGE1_COPY,
      biz: biz(),
    });
  } catch (e) {
    console.error("[api/pre GET] 실패", e);
    return err("server", 500);
  }
}

type Body = {
  profile?: Record<string, unknown>;
  payment?: Record<string, unknown>;
};

/** 자리가 없다는 것을 트랜잭션 밖으로 전달하기 위한 표식. */
class SlotFull extends Error {}

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const a = await findByToken(token);
    if (!a) return err("unknown_token", 404);
    if (NOT_ELIGIBLE_STATUS.has(a.status)) return err("not_eligible", 403);

    // 🔴 두 번째 제출은 **거절**한다. upsert로 바꾸지 말 것 —
    //    덮어쓰면 어느 게 진짜인지 영원히 알 수 없고 되돌릴 방법이 없다.
    //    새로고침·뒤로가기·다른 기기가 전부 여기서 막힌다.
    if (a.submitted_at) return err("already_submitted", 409);
    if (isClosed()) return err("closed", 410);

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return err("bad_json", 400);
    }

    // ── 검증 · 화면 검증을 믿지 않는다 ──────────────────────────
    const p = body.profile ?? {};
    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");

    const name = str("name");
    if (name.length < 2) return err("bad_name", 400);

    const phone = str("phone").replace(/\D/g, "");
    if (!/^010\d{8}$/.test(phone)) return err("bad_phone", 400);

    const birth = str("birth");
    if (!isRealDate(birth)) return err("bad_birth", 400);

    const gender = p.gender === "M" || p.gender === "F" ? p.gender : null;
    if (!gender) return err("bad_gender", 400);

    const marital = p.marital === "미혼" || p.marital === "기혼" ? p.marital : null;
    if (!marital) return err("bad_marital", 400);

    const job = str("job");
    if (!job) return err("bad_job", 400);

    // 🟡 이메일은 선택이다. 안 적으면 null. 적었으면 형식과 동의를 함께 본다.
    const emailRaw = str("email");
    const email = emailRaw || null;
    const emailAgreed = p.email_agreed === true;
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !emailAgreed)) {
      return err("bad_email", 400);
    }

    if (p.privacy_agreed !== true) return err("need_privacy", 400);
    // 🔴 개인정보 동의와 **별개로** 저장한다(개인정보보호법 §22).
    if (p.truth_agreed !== true) return err("need_truth", 400);

    // ── 결제 정보 ───────────────────────────────────────────────
    const pay = body.payment ?? {};
    // 🔴 전자상거래법상 표시·동의의 근거다. false면 저장하지 않는다.
    if (pay.refund_policy_agreed !== true) return err("need_refund_agree", 400);
    const depositor =
      typeof pay.depositor_name === "string" && pay.depositor_name.trim()
        ? pay.depositor_name.trim()
        : null;

    // ── 저장 · 자리 확보 ────────────────────────────────────────
    const now = new Date();
    const dueAt = dueAtFrom(now);

    // 🔴 #9 — 운영자가 이미 approved→awaiting_payment로 자리를 잡아준 사람이면
    //    (또는 admin이 손으로 confirmed까지 만들어준 사람이면) 여기서 또 세지 않는다.
    //    안 그러면 한 사람이 두 칸을 쥐어 정원이 실질 18명으로 준다.
    const alreadyHoldsSlot = HOLDS_SLOT_STATUS.has(a.status);

    try {
      await tx(async (c) => {
        if (!alreadyHoldsSlot) {
          // 🔴 이 한 줄이 선착순의 전부다. `taken < capacity` 조건이 붙은 UPDATE는
          //    행 잠금을 스스로 잡으므로, 세었다가 나중에 넣는 방식과 달리
          //    **21번째 참가자가 생길 수 없다.** 남·여를 따로 센다.
          const slot = await c.query(
            `update gender_slot set taken = taken + 1
              where gender = $1 and taken < capacity
              returning taken`,
            [gender],
          );
          if (slot.rowCount === 0) throw new SlotFull();
        }

        await c.query(
          `update applicant
              set name = $2, phone = $3, gender = $4, birth = $5,
                  marital = $6, job = $7, email = $8,
                  email_agreed_at = $9, truth_agreed_at = now(),
                  refund_agreed_at = now(), depositor_name = $10,
                  status = 'awaiting_payment',
                  held_at = $11, submitted_at = $11, due_at = $12
            where id = $1`,
          [a.id, name, phone, gender, birth, marital, job, email,
           email && emailAgreed ? now : null, depositor, now, dueAt],
        );

        await c.query(
          `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
           values ($1, $2, 'awaiting_payment', '1단계 제출 — 자리 확보', 'system')`,
          [a.id, a.status],
        );
      });
    } catch (e) {
      if (e instanceof SlotFull) {
        // 🔴 마감된 사람에게 **결제 안내를 띄우지 않는다.** 자리가 없는데 돈을 받으면
        //    그대로 환불 분쟁이 된다.
        await q(
          `update applicant set status = 'waitlist' where id = $1 and status <> 'confirmed'`,
          [a.id],
        );
        await q(
          `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
           values ($1, $2, 'waitlist', '1단계 제출 시점에 해당 성별 자리 마감', 'system')`,
          [a.id, a.status],
        );
        return err("full", 409, { gender, copy: { full: COPY.full } });
      }
      throw e;
    }

    return NextResponse.json(
      { ok: true, due_at: dueAt.toISOString(), depositor: depositor ?? name },
      { status: 201 },
    );
  } catch (e) {
    console.error("[api/pre POST] 실패", e);
    return err("server", 500);
  }
}
