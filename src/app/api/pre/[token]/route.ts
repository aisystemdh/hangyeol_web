import { NextResponse } from "next/server";
import { q, tx } from "@/lib/db";
import { isRealDate } from "@/lib/age";
import { dueAtFrom, isClosed } from "@/lib/deadline";
import { COPY, QUESTIONS, PAIRED_INDEXES } from "@/lib/form9-copy";
import { biz } from "@/lib/biz";

/**
 * 폼 9 — 사전 10문항 + 결제 정보
 *
 * 근거: `7_폼/한결_폼9_개발명세.md` §2·§3 · `8_참가자모집/한결_폼9_최종본_문항결제.md`
 *
 * 🔴 **로그인이 없다. 링크에 박힌 토큰이 곧 신원이다.**
 * 🔴 문항은 영업비밀이다. 토큰이 확인된 뒤에만 내려간다 — form9-copy.ts 주석 참조.
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

const err = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

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

    // 이미 낸 사람이 우선이다 — 마감됐어도 "이미 제출하셨습니다"를 보여준다.
    if (a.submitted_at) {
      return NextResponse.json({
        ok: true,
        submitted: true,
        due_at: a.due_at,
        copy: { already: COPY.already, done: COPY.done },
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
      questions: QUESTIONS,
      pairedIndexes: PAIRED_INDEXES,
      copy: COPY,
      biz: biz(),
    });
  } catch (e) {
    console.error("[api/pre GET] 실패", e);
    return err("server", 500);
  }
}

type Body = {
  profile?: Record<string, unknown>;
  answers?: unknown;
  consent?: unknown;
  payment?: Record<string, unknown>;
};

/** 자리가 없다는 것을 트랜잭션 밖으로 전달하기 위한 표식. */
class SlotFull extends Error {}

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const a = await findByToken(token);
    if (!a) return err("unknown_token", 404);

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

    // ── 응답 ────────────────────────────────────────────────────
    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return err("bad_answers", 400);
    }
    for (let i = 0; i < answers.length; i++) {
      const max = QUESTIONS[i].choices?.length ?? 2;
      const ok = PAIRED_INDEXES.includes(i)
        ? Array.isArray(answers[i]) &&
          (answers[i] as unknown[]).length === 2 &&
          (answers[i] as unknown[]).every((v) => v === 1 || v === 2)
        : typeof answers[i] === "number" &&
          Number.isInteger(answers[i]) &&
          (answers[i] as number) >= 1 &&
          (answers[i] as number) <= max;
      if (!ok) return err("bad_answers", 400, { at: i + 1 });
    }
    if (typeof body.consent !== "boolean") return err("bad_consent", 400);

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

    try {
      await tx(async (c) => {
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
          `insert into answer_pre (applicant_id, a, consent) values ($1, $2, $3)`,
          [a.id, JSON.stringify(answers), body.consent],
        );

        await c.query(
          `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
           values ($1, $2, 'awaiting_payment', '폼9 제출 — 자리 확보', 'system')`,
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
           values ($1, $2, 'waitlist', '폼9 제출 시점에 해당 성별 자리 마감', 'system')`,
          [a.id, a.status],
        );
        return err("full", 409, { gender });
      }
      throw e;
    }

    return NextResponse.json({ ok: true, due_at: dueAt.toISOString() }, { status: 201 });
  } catch (e) {
    console.error("[api/pre POST] 실패", e);
    return err("server", 500);
  }
}
