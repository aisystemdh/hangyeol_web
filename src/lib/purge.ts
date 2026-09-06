import "server-only";
import { tx } from "./db";
import { QUESTIONS, PRE_QUESTION_FORM } from "./form9-copy";

/**
 * 개인정보 파기 (이슈 #42) — 화면에 「3년 뒤 파기」라고 고지했으므로 실제로 돈다.
 * `docs/decisions/003-scenario-redesign-2026-09-05.md` §5(결정 15·16), `CONTEXT.md` "파기".
 *
 * 두 규칙을 한 트랜잭션에서 돈다.
 *
 * **신원3년** — 3년 지난 이름·연락처·생년월일(`applicant`)과 혼인 여부·직업·이메일
 * (`application`)을 지운다. 🔴 **더미 값으로 덮지 않는다** — 더미 값은 "그때 그 사람이
 * 실제로 이 이름이었다"는 새 거짓을 만든다. 지운다는 것은 NULL이 된다는 뜻이다
 * (`007_purge.sql`이 그래서 NOT NULL을 먼저 풀었다).
 *
 * 🔴 **기준은 "그 사람의 가장 최근 신청"이다.** `applicant`는 회차가 바뀌어도 같은
 *    사람이 다시 쓴다(`CONTEXT.md` "사람") — 1차 신청이 3년을 넘겼어도 2차를 최근에
 *    냈다면 아직 살아 있는 사람이다. 신원을 지우면 2차 신청 화면도 함께 깨진다.
 *
 * **주관식3년** — 자유 서술 답만 지우고 선택지 답은 남긴다(결정 16). 지금 사전질문
 * 열 문항은 전부 선택지형(`QUESTIONS[].freeText === false`)이라 실제로는 지울 게
 * 없다 — 나중에 자유 서술 문항이 생기면 그 코드가 자동으로 대상이 된다.
 *
 * 돈 줄(`money`)·회차 연결은 손대지 않는다 — 법정 5년 보존(결정 15) 대상이고,
 * `application` 행 자체를 지우지 않으므로 `money.application_id`도 그대로 남는다.
 *
 * 🔴 **두 번 돌려도 안전하다.** 이미 지운 사람은 `applicant.name is not null` 조건에서
 *    빠지고, 이미 지운 답은 더 이상 대상 키를 안 갖고 있어 `?|`에 안 걸린다 —
 *    그래서 `purge_log`에 같은 대상이 중복으로 쌓이지 않는다.
 */

const RETENTION_YEARS = 3;

export type PurgeResult = { identity: number; freeText: number };

function cutoff(now: Date): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - RETENTION_YEARS);
  return d;
}

const FREE_TEXT_CODES = QUESTIONS.filter((q) => q.freeText).map((q) => q.code);

export async function runPurge(now: Date = new Date()): Promise<PurgeResult> {
  const before = cutoff(now);

  return tx(async (client) => {
    // ── 신원3년 ──────────────────────────────────────────────────
    const targets = await client.query<{ id: string }>(
      `select a.id
         from applicant a
        where a.name is not null
          and not exists (
            select 1 from application ap
             where ap.applicant_id = a.id
               and ap.created_at >= $1
          )
          and exists (
            select 1 from application ap where ap.applicant_id = a.id
          )`,
      [before],
    );

    for (const { id } of targets.rows) {
      await client.query(
        `update applicant set name = null, phone = null, birth = null where id = $1`,
        [id],
      );
      await client.query(
        `update application set marital = null, job = null, email = null where applicant_id = $1`,
        [id],
      );
      await client.query(`insert into purge_log (rule, subject_id) values ('신원3년', $1)`, [id]);
    }

    // ── 주관식3년 ────────────────────────────────────────────────
    let freeTextCount = 0;
    if (FREE_TEXT_CODES.length > 0) {
      const answers = await client.query<{ id: string; application_id: string }>(
        `select id::text as id, application_id::text as application_id
           from answer
          where form = $1 and created_at < $2 and a ?| $3::text[]`,
        [PRE_QUESTION_FORM, before, FREE_TEXT_CODES],
      );
      for (const row of answers.rows) {
        await client.query(`update answer set a = a - $2::text[] where id = $1`, [
          row.id,
          FREE_TEXT_CODES,
        ]);
        await client.query(`insert into purge_log (rule, subject_id) values ('주관식3년', $1)`, [
          row.application_id,
        ]);
      }
      freeTextCount = answers.rows.length;
    }

    return { identity: targets.rows.length, freeText: freeTextCount };
  });
}
