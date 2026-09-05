import { describe, expect, it } from "vitest";
import { POST as applyPOST } from "@/app/api/apply/route";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as marketingGET } from "@/app/api/admin/marketing/route";
import { settleAfterResponse } from "@/lib/after";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { SITE_URL } from "@/lib/site";
import { PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION } from "@/lib/form9-copy";
import type { FunnelStage, SourceCount } from "@/lib/admin-marketing";
import { callRoute, q, setCookies } from "./helpers";

/**
 * 마케팅 탭 — 유입과 퍼널 (이슈 #41).
 *
 * 두 가지를 본다.
 * ① `POST /api/apply`가 폼이 실어 보낸 유입 값(`referrer`·`utm`·`landing_path`)을
 *    실제로 저장하고, 그로부터 `source`를 정하는 규칙(`@/lib/source`)이 맞는가.
 * ② `GET /api/admin/marketing`이 이중 방어를 지키고, 유입 경로별 집계·퍼널 네 단계를
 *    맞게 세는가.
 */

type Accepted = { ok: boolean; data: { seq: number; waitlisted: boolean } };
type MarketingBody = { ok: boolean; data?: { sources: SourceCount[]; funnel: FunnelStage[] } };

let 아이피 = 0;

/** ⚠️ apply.test.ts와 같은 이유로 매번 다른 IP — 연타 차단(분당 5회)에 걸리지 않는다. */
async function 신청하기(body: Record<string, unknown> = {}) {
  아이피 += 1;
  const 전화 = `010${String(60000000 + 아이피).padStart(8, "0")}`;
  const res = await callRoute<Accepted>(applyPOST, {
    method: "POST",
    headers: { "x-forwarded-for": `203.0.113.${아이피 % 250}` },
    body: {
      name: "유입테스트",
      phone: 전화,
      gender: "M",
      birth: "1998-05-05",
      privacy_agreed: true,
      ...body,
    },
  });
  await settleAfterResponse();
  return { res, 전화 };
}

async function 로그인쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(loginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  return { hg_admin: setCookies(res).hg_admin };
}

describe("POST /api/apply — 유입 값 저장", () => {
  it("폼이 보낸 referrer·utm·landing_path가 그대로 저장된다", async () => {
    const { 전화 } = await 신청하기({
      referrer: "https://www.instagram.com/hangyeol_kr/",
      utm: { utm_source: "instagram", utm_medium: "bio", utm_campaign: "launch" },
      landing_path: "/events/1",
    });

    const rows = await q<{
      source: string;
      utm: { utm_source: string; utm_medium: string; utm_campaign: string };
      referrer: string;
      landing_path: string;
    }>(
      `select a.source, a.utm, a.referrer, a.landing_path
         from application a join applicant p on p.id = a.applicant_id
        where p.phone = $1`,
      [전화],
    );
    expect(rows[0].referrer).toBe("https://www.instagram.com/hangyeol_kr/");
    expect(rows[0].utm).toEqual({
      utm_source: "instagram",
      utm_medium: "bio",
      utm_campaign: "launch",
    });
    expect(rows[0].landing_path).toBe("/events/1");
    // 🔴 utm_source가 있으면 그것이 곧 유입 경로다 — 광고주가 스스로 붙인 값이라 확실하다.
    expect(rows[0].source).toBe("instagram");
  });

  it("utm 없이 리퍼러만 있으면 리퍼러 호스트가 source다", async () => {
    const { 전화 } = await 신청하기({ referrer: "https://m.naver.com/some/path" });

    const rows = await q<{ source: string }>(
      `select a.source from application a join applicant p on p.id = a.applicant_id where p.phone = $1`,
      [전화],
    );
    expect(rows[0].source).toBe("m.naver.com");
  });

  it("우리 사이트 자신에서 온 리퍼러는 direct다 — 내부 이동은 채널이 아니다", async () => {
    const { 전화 } = await 신청하기({ referrer: new URL("/why", SITE_URL).toString() });

    const rows = await q<{ source: string }>(
      `select a.source from application a join applicant p on p.id = a.applicant_id where p.phone = $1`,
      [전화],
    );
    expect(rows[0].source).toBe("direct");
  });

  it("리퍼러도 utm도 없으면 direct다", async () => {
    const { 전화 } = await 신청하기({});

    const rows = await q<{ source: string; utm: unknown; referrer: string | null }>(
      `select a.source, a.utm, a.referrer from application a
         join applicant p on p.id = a.applicant_id where p.phone = $1`,
      [전화],
    );
    expect(rows[0].source).toBe("direct");
    expect(rows[0].utm).toBeNull();
  });

  it("🔴 화면 검증을 믿지 않는다 — 목록에 없는 utm 키·문자열이 아닌 값은 조용히 걸러진다", async () => {
    const { 전화 } = await 신청하기({
      utm: { utm_source: "instagram", utm_evil: "<script>", utm_medium: 12345 },
    });

    const rows = await q<{ utm: Record<string, string> }>(
      `select a.utm from application a join applicant p on p.id = a.applicant_id where p.phone = $1`,
      [전화],
    );
    expect(rows[0].utm).toEqual({ utm_source: "instagram" });
    expect(rows[0].utm).not.toHaveProperty("utm_evil");
  });

  it("응답에 유입 값이 실려 나가지 않는다", async () => {
    const { res } = await 신청하기({
      referrer: "https://www.instagram.com/hangyeol_kr/",
      utm: { utm_source: "instagram" },
    });

    expect(res.raw).not.toContain("instagram");
  });
});

describe("GET /api/admin/marketing — 이중 방어", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const res = await callRoute<MarketingBody>(marketingGET);
    expect(res.status).toBe(401);
  });

  it("로그인하면 실제 데이터가 온다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<MarketingBody>(marketingGET, { cookies });
    expect(res.status).toBe(200);
    expect(res.body.data?.sources).toEqual([]);
    expect(res.body.data?.funnel.map((f) => f.key)).toEqual([
      "신청",
      "정식등록",
      "입금",
      "사전질문",
    ]);
  });
});

describe("GET /api/admin/marketing — 유입 경로별 신청 수", () => {
  it("source로 묶어 센다", async () => {
    await 신청하기({ utm: { utm_source: "instagram" } });
    await 신청하기({ utm: { utm_source: "instagram" } });
    await 신청하기({ referrer: "https://m.naver.com/" });
    await 신청하기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });

    const bySource = new Map(res.body.data?.sources.map((s) => [s.source, s.count]));
    expect(bySource.get("instagram")).toBe(2);
    expect(bySource.get("m.naver.com")).toBe(1);
    expect(bySource.get("direct")).toBe(1);
  });

  it("값이 없는 신청은 「미상」으로 묶인다", async () => {
    await q(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth) values ('옛신청', '01099990000', 'M', '1996-01-01')
         returning id
       )
       insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
       select id, $1, '신청함', $2, now() from 사람`,
      [EVENT.id, newToken()],
    );
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });

    const bySource = new Map(res.body.data?.sources.map((s) => [s.source, s.count]));
    expect(bySource.get("미상")).toBe(1);
  });
});

describe("GET /api/admin/marketing — 퍼널 네 단계", () => {
  /** 신청 하나를 원하는 단계까지 직접 만든다. */
  async function 신청만들기(opts: {
    registered?: boolean;
    paid?: boolean;
    answered?: boolean;
  }): Promise<string> {
    아이피 += 1;
    // 🔴 11자리를 맞춘다고 뒤를 자르면(`.slice(0, 11)`) 늘어나는 자리가 잘려나가
    //    번호가 같아진다 — 실제로 그렇게 겪었다. 앞 네 자리 + 나머지 일곱 자리로 고정한다.
    const phone = `0108${String(1000000 + 아이피).padStart(7, "0")}`;
    const rows = await q<{ id: string }>(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth) values ('퍼널테스트', $1, 'M', '1996-01-01')
         returning id
       )
       insert into application
         (applicant_id, event_id, status, token, privacy_agreed_at, registered_at, paid_at)
       select id, $2, $3, $4, now(), $5, $6 from 사람
       returning id`,
      [
        phone,
        EVENT.id,
        opts.paid ? "입금완료" : "신청함",
        newToken(),
        opts.registered || opts.paid ? new Date() : null,
        opts.paid ? new Date() : null,
      ],
    );
    const id = rows[0].id;
    if (opts.answered) {
      await q(
        `insert into answer (application_id, form, form_version, a) values ($1, $2, $3, '{}'::jsonb)`,
        [id, PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION],
      );
    }
    return id;
  }

  it("각 단계는 그 조건을 만족하는 신청만 센다", async () => {
    await 신청만들기({});
    await 신청만들기({ registered: true });
    await 신청만들기({ paid: true });
    await 신청만들기({ paid: true, answered: true });
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });
    const byKey = new Map(res.body.data?.funnel.map((f) => [f.key, f]));

    expect(byKey.get("신청")?.count).toBe(4);
    // 🔴 등록만 한 사람 하나 + 입금까지 간 사람 둘 — 정식등록은 registered_at 자체를 본다.
    expect(byKey.get("정식등록")?.count).toBe(3);
    expect(byKey.get("입금")?.count).toBe(2);
    expect(byKey.get("사전질문")?.count).toBe(1);
  });

  it("비율은 1단계(신청) 대비다", async () => {
    await 신청만들기({});
    await 신청만들기({});
    await 신청만들기({ paid: true });
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });
    const byKey = new Map(res.body.data?.funnel.map((f) => [f.key, f]));

    expect(byKey.get("신청")?.rate).toBe(100);
    expect(byKey.get("입금")?.rate).toBeCloseTo(33.3, 1);
  });

  it("신청이 하나도 없으면 0으로 답한다 — 0으로 나누지 않는다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });
    const byKey = new Map(res.body.data?.funnel.map((f) => [f.key, f]));

    expect(byKey.get("신청")).toEqual({ key: "신청", count: 0, rate: 0 });
    expect(byKey.get("입금")).toEqual({ key: "입금", count: 0, rate: 0 });
  });

  it("다른 회차의 신청은 세지 않는다", async () => {
    await q(
      `insert into event (id, title, date) values (2, '2차 오프라인 모임', '2027-01-16')
       on conflict (id) do nothing`,
    );
    await q(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth) values ('2차사람', '01077778888', 'F', '1995-01-01')
         returning id
       )
       insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
       select id, 2, '신청함', $1, now() from 사람`,
      [newToken()],
    );
    const cookies = await 로그인쿠키();

    const res = await callRoute<MarketingBody>(marketingGET, { cookies });
    const applied = res.body.data?.funnel.find((f) => f.key === "신청")?.count;

    expect(applied).toBe(0); // 1차(EVENT.id)에는 아직 아무도 없다
  });
});
