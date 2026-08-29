import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { COPY, QUESTIONS, PAIRED_INDEXES } from "@/lib/form9-copy";

/**
 * 폼 9 · **2단계** — 사전 10문항
 *
 * 🔴 **입금이 확인된 사람(`status='confirmed'`)에게만 문항이 내려간다.**
 *    문항은 영업비밀이다(지식베이스 「비공개 · 대외 반출 금지」). 사전등록은 무료라
 *    1단계에 문항을 두면 답만 받아가고 결제하지 않아도 문항이 전부 샌다.
 *    2026-08-30 소유자 결정.
 *
 * 🔴 **1단계 토큰(`pre_token`)으로는 열리지 않는다.** `q_token`은 별도로 발급한다.
 *    같은 토큰을 쓰면 1단계 링크를 받은 사람이 주소만 바꿔 문항을 열 수 있다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

type Row = {
  id: string;
  name: string;
  status: string;
  answered: boolean;
};

const err = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

async function findByQToken(token: string): Promise<Row | null> {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) return null;
  const rows = await q<Row>(
    `select a.id, a.name, a.status,
            (ans.applicant_id is not null) as answered
       from applicant a
       left join answer_pre ans on ans.applicant_id = a.id
      where a.q_token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const a = await findByQToken(token);
    if (!a) return err("unknown_token", 404);

    if (a.answered) {
      return NextResponse.json({
        ok: true,
        submitted: true,
        copy: { already: COPY.already, qDone: COPY.qDone },
      });
    }

    // 🔴 여기가 이 라우트의 존재 이유다. 확정되지 않았으면 문항을 내려보내지 않는다.
    if (a.status !== "confirmed") {
      return NextResponse.json(
        { ok: false, error: "not_paid", copy: { notPaid: COPY.notPaid } },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      submitted: false,
      name: a.name,
      questions: QUESTIONS,
      pairedIndexes: PAIRED_INDEXES,
      copy: {
        qStart: COPY.qStart,
        questions: COPY.questions,
        compare: COPY.compare,
        qDone: COPY.qDone,
        already: COPY.already,
        unknown: COPY.unknown,
      },
    });
  } catch (e) {
    console.error("[api/q GET] 실패", e);
    return err("server", 500);
  }
}

type Body = { answers?: unknown; consent?: unknown };

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const a = await findByQToken(token);
    if (!a) return err("unknown_token", 404);

    // 🔴 두 번째 제출은 거절한다. upsert 금지 —
    //    덮어쓰면 어느 게 진짜 답인지 영원히 알 수 없다.
    if (a.answered) return err("already_submitted", 409);
    if (a.status !== "confirmed") return err("not_paid", 403);

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return err("bad_json", 400);
    }

    // ── 응답 검증 · 화면 검증을 믿지 않는다 ─────────────────────
    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
      return err("bad_answers", 400);
    }
    for (let i = 0; i < answers.length; i++) {
      const max = QUESTIONS[i].choices?.length ?? 2;
      // 🔴 4번·6번만 `[나, 상대]` 두 값 배열이다(페어드 문항).
      //    10번만 3지선다라 3이 올 수 있다.
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

    await q(
      `insert into answer_pre (applicant_id, a, consent) values ($1, $2, $3)`,
      [a.id, JSON.stringify(answers), body.consent],
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    // 동시에 두 번 눌렀을 때 PK 충돌. 화면에는 「이미 제출」로 보이는 것이 맞다.
    if (typeof e === "object" && e && (e as { code?: string }).code === "23505") {
      return err("already_submitted", 409);
    }
    console.error("[api/q POST] 실패", e);
    return err("server", 500);
  }
}
