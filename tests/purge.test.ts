import { describe, expect, it } from "vitest";
import { GET as purgeGET } from "@/app/api/cron/purge/route";
import { runPurge } from "@/lib/purge";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { callRoute, q } from "./helpers";

/**
 * 개인정보 파기 (이슈 #42).
 *
 * 🔴 DB의 `now()`는 흉내 낼 수 없으므로(`tests/helpers/clock.ts`), "3년 지났다"는
 *    `application.created_at`을 직접 옛 시각으로 심어서 만든다. `runPurge()`에
 *    "지금이 언제인가"도 직접 넘긴다 — 실제 시계에 기대면 테스트가 실행되는 날짜에
 *    따라 결과가 달라진다.
 */

let 카운터 = 0;

async function 신청심기(opts: {
  createdAt: string;
  eventId?: number;
  marital?: string;
  job?: string;
  email?: string;
}): Promise<{ applicantId: string; applicationId: string }> {
  카운터 += 1;
  const rows = await q<{ applicant_id: string; application_id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, 'M', '1996-01-01')
       returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, created_at, marital, job, email)
     select id, $3, '입금완료', $4, $5, $5, $6, $7, $8 from 사람
     returning applicant_id::text as applicant_id, id::text as application_id`,
    [
      `파기테스트${카운터}`,
      `010${String(70000000 + 카운터).padStart(8, "0")}`,
      opts.eventId ?? EVENT.id,
      newToken(),
      opts.createdAt,
      opts.marital ?? "미혼",
      opts.job ?? "개발자",
      opts.email ?? `test${카운터}@example.com`,
    ],
  );
  return { applicantId: rows[0].applicant_id, applicationId: rows[0].application_id };
}

const 아주오래전 = "2000-01-01T00:00:00Z";
const 파기시점 = new Date("2029-10-01T00:00:00Z"); // 아주오래전보다 3년 넘게 지난 시각
const 최근 = "2027-01-01T00:00:00Z"; // 파기시점(2029-10-01)의 3년 전(2026-10-01)보다 뒤 — 아직 3년이 안 지났다

describe("runPurge — 신원3년", () => {
  it("모든 신청이 3년 넘은 사람은 이름·연락처·생년월일과 혼인·직업·이메일이 지워진다", async () => {
    const { applicantId, applicationId } = await 신청심기({ createdAt: 아주오래전 });

    const result = await runPurge(파기시점);

    expect(result.identity).toBe(1);
    const [person] = await q<{ name: string | null; phone: string | null; birth: string | null }>(
      `select name, phone, birth::text as birth from applicant where id = $1`,
      [applicantId],
    );
    expect(person).toEqual({ name: null, phone: null, birth: null });

    const [app] = await q<{ marital: string | null; job: string | null; email: string | null }>(
      `select marital, job, email from application where id = $1`,
      [applicationId],
    );
    expect(app).toEqual({ marital: null, job: null, email: null });
  });

  it("🔴 파기 기록에는 규칙과 대상 id만 남고 이름·연락처가 없다", async () => {
    const { applicantId } = await 신청심기({ createdAt: 아주오래전 });

    await runPurge(파기시점);

    const [log] = await q<{ rule: string; subject_id: string }>(
      `select rule, subject_id::text as subject_id from purge_log where rule = '신원3년'`,
    );
    expect(log.rule).toBe("신원3년");
    expect(log.subject_id).toBe(applicantId);
  });

  it("아직 3년이 안 지난 신청은 그대로 남는다", async () => {
    const { applicantId } = await 신청심기({ createdAt: 최근 });

    const result = await runPurge(파기시점);

    expect(result.identity).toBe(0);
    const [person] = await q<{ name: string | null }>(`select name from applicant where id = $1`, [
      applicantId,
    ]);
    expect(person.name).not.toBeNull();
  });

  it("🔴 옛 회차 신청은 3년이 지났어도 최근에 다른 회차로 다시 신청했으면 신원을 지우지 않는다", async () => {
    await q(`insert into event (id, title, date) values (2, '2차 오프라인 모임', '2029-10-24') on conflict (id) do nothing`);
    const { applicantId, applicationId } = await 신청심기({ createdAt: 아주오래전 });
    // 같은 사람이 2차 회차에 최근 다시 신청했다 — applicant_id를 그대로 재사용한다.
    await q(
      `insert into application (applicant_id, event_id, status, token, privacy_agreed_at, created_at)
       values ($1, 2, '신청함', $2, $3, $3)`,
      [applicantId, newToken(), 최근],
    );

    const result = await runPurge(파기시점);

    expect(result.identity).toBe(0);
    const [person] = await q<{ name: string | null }>(`select name from applicant where id = $1`, [
      applicantId,
    ]);
    expect(person.name).not.toBeNull();
    // 1차 신청의 정식등록 항목(직업 등)은 손대지 않는다 — 신원 자체가 대상이 아니었으니까.
    const [app] = await q<{ job: string | null }>(`select job from application where id = $1`, [
      applicationId,
    ]);
    expect(app.job).not.toBeNull();
  });

  it("두 번 돌려도 같은 사람을 다시 기록하지 않는다(멱등)", async () => {
    await 신청심기({ createdAt: 아주오래전 });

    const 첫번째 = await runPurge(파기시점);
    const 두번째 = await runPurge(파기시점);

    expect(첫번째.identity).toBe(1);
    expect(두번째.identity).toBe(0);
    const logs = await q(`select 1 from purge_log where rule = '신원3년'`);
    expect(logs.length).toBe(1);
  });

  it("🔴 돈 줄은 그대로 남는다 — application_id·event_id 연결이 안 끊긴다", async () => {
    const { applicationId } = await 신청심기({ createdAt: 아주오래전 });
    await q(
      `insert into money (application_id, event_id, kind, amount, occurred_at, recorded_by)
       values ($1, $2, '입금', 39000, $3, '테스트')`,
      [applicationId, EVENT.id, 아주오래전],
    );

    await runPurge(파기시점);

    const [money] = await q<{ application_id: string | null; event_id: number }>(
      `select application_id::text as application_id, event_id from money where application_id = $1`,
      [applicationId],
    );
    expect(money.application_id).toBe(applicationId);
    expect(money.event_id).toBe(EVENT.id);
  });

  it("지울 것이 없으면 아무것도 하지 않고 조용히 끝난다", async () => {
    const result = await runPurge(파기시점);
    expect(result).toEqual({ identity: 0, freeText: 0 });
  });
});

describe("GET /api/cron/purge — 인증", () => {
  it("Authorization 헤더 없이 부르면 401이다", async () => {
    process.env.CRON_SECRET = "test-secret-1234";
    const res = await callRoute(purgeGET);
    expect(res.status).toBe(401);
  });

  it("틀린 비밀이면 401이다", async () => {
    process.env.CRON_SECRET = "test-secret-1234";
    const res = await callRoute(purgeGET, { headers: { authorization: "Bearer wrong-secret" } });
    expect(res.status).toBe(401);
  });

  it("🔴 CRON_SECRET을 안 정해 두면 조용히 통과시키지 않고 그 자리에서 터진다", async () => {
    delete process.env.CRON_SECRET;
    await expect(
      callRoute(purgeGET, { headers: { authorization: "Bearer whatever" } }),
    ).rejects.toThrow("CRON_SECRET");
  });

  it("맞는 비밀이면 파기를 돌리고 결과를 돌려준다", async () => {
    process.env.CRON_SECRET = "test-secret-1234";
    await 신청심기({ createdAt: 아주오래전 });

    const res = await callRoute<{ ok: boolean; data?: { identity: number; freeText: number } }>(
      purgeGET,
      { headers: { authorization: "Bearer test-secret-1234" } },
    );

    expect(res.status).toBe(200);
    expect(res.body.data?.identity).toBeGreaterThanOrEqual(1);
  });
});
