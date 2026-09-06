import { NextResponse } from "next/server";
import { q, tx } from "@/lib/db";
import {
  PRE_QUESTION_FORM,
  PRE_QUESTION_FORM_VERSION,
  validatePreQuestionAnswers,
} from "@/lib/form9-copy";
import type { ApplicationStatus } from "@/lib/me-screen";

/**
 * POST /api/me/[token]/answers — 사전질문 제출(이슈 #36).
 *
 * 🔴 **별도 sub-route로 둔 이유.** 같은 `/api/me/[token]` 파일에 얹을 수도 있었지만,
 *    정식등록(POST, 이슈 #33)과 사전질문 제출은 검증 규칙도 저장 대상 표(`application`
 *    vs `answer`)도 전혀 다르다. 한 파일에 넣으면 body 모양으로 "이게 등록 요청인가
 *    사전질문 제출인가"를 먼저 갈라야 하는데, 그 분기 자체가 실수로 서로의 검증을
 *    건너뛰게 하기 쉽다. 주소를 하나 더 두는 대가로 각자의 파일이 자기 규칙만
 *    책임지게 한다.
 *
 * 🔴 **문항 방어의 실체는 토큰이 아니라 「입금완료」다**(`docs/decisions/003…` §6).
 *    `GET`이 "questions" 화면을 입금완료가 아니면 고르지 않는 것만으로는 부족하다 —
 *    화면 검증을 믿지 않으므로(`CLAUDE.md` "라우팅") 주소만 알면 이 POST를 직접
 *    때릴 수 있는 사람을 막으려면 **쓰는 경로에도** 같은 조건을 걸어야 한다.
 *
 * ⚠️ **동시성 — 등록 POST와 같은 자리에서 같은 함정이 있다.** 상태를 확인하는
 *    SELECT와 실제 저장 사이에 운영자가 그 신청을 취소할 수 있다. 그래서 실제
 *    저장 문장 자체를 `insert … select … from application where … and status =
 *    '입금완료'`로 써서, "지금 이 순간에도 입금완료인가"를 저장과 **한 문장**으로
 *    묶는다 — 두 번 SELECT하고 그 사이를 믿는 대신, 두 번째 확인을 저장 문장에
 *    박아 넣는다.
 *
 * 🔴 **재제출은 최신 값으로 덮어쓴다(upsert).** 새로고침으로 두 번 제출되는 것을
 *    막는 게 목적이지 "한 번 내면 못 고친다"가 목적이 아니다(정식등록 POST가
 *    "덮어쓴다"로 정한 것과 같은 결정). DB의 부분 UNIQUE(`answer_form_uq`,
 *    `005_rebuild.sql`)가 물리적으로 두 번째 행을 막아 주므로, 애플리케이션은
 *    그 위에서 "이미 있으면 갱신"만 하면 된다 — 거부(409)로 만들면 정말로 새로고침
 *    때문에 두 번 누른 사람이 "이미 제출하셨습니다"만 보고 자기 답이 실제로
 *    저장됐는지 확인할 길이 없어진다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error, message }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("bad_json", "요청을 읽지 못했습니다.");
  }

  const answers = validatePreQuestionAnswers(
    body && typeof body === "object" ? (body as { answers?: unknown }).answers : undefined,
  );
  if (!answers) return bad("bad_answers", "답변을 확인해주세요.");

  const rows = await q<{ id: string; status: ApplicationStatus }>(
    `select id, status from application where token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row) return bad("not_found", "링크를 확인해주세요.", 404);
  // 🔴 화면 검증을 믿지 않는다 — 취소됐거나 아직 입금 전인 사람은 이 시점에서 이미
  //    거절한다. 아래 저장 문장이 같은 조건을 한 번 더 걸어 그 사이의 취소도 잡는다.
  if (row.status !== "입금완료") {
    return bad("not_paid", "아직 열리지 않았습니다.", 403);
  }

  const now = new Date();
  const submitted = await tx(async (client) => {
    const upserted = await client.query(
      `insert into answer (application_id, form, round, form_version, a)
       select id, $2, null, $3, $4::jsonb
         from application
        where id = $1 and status = '입금완료'
       on conflict (application_id, form) where form <> 'round'
       do update set form_version = excluded.form_version, a = excluded.a`,
      [row.id, PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION, JSON.stringify(answers)],
    );
    if (upserted.rowCount === 0) return false;

    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, '사전질문제출', 'guest', $2)`,
      [row.id, JSON.stringify({ formVersion: PRE_QUESTION_FORM_VERSION })],
    );
    return true;
  });

  if (!submitted) return bad("not_paid", "아직 열리지 않았습니다.", 403);

  return NextResponse.json({ ok: true, data: { submittedAt: now.toISOString() } });
}
