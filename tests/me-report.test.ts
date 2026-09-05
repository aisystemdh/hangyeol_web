import { describe, expect, it } from "vitest";
import { GET as meGET } from "@/app/api/me/[token]/route";
import { GET as reportGET, POST as reportPOST } from "@/app/api/admin/applications/[id]/report/route";
import { POST as adminLoginPOST } from "@/app/api/admin/login/route";
import { newToken } from "@/lib/admin";
import { EVENT, EVENT_SCHEMA } from "@/lib/event";
import type { MeApiResponse } from "@/lib/me-response";
import { at, callRoute, q, setCookies } from "./helpers";

/**
 * 행사 후 화면 + 리포트 등록 (이슈 #40).
 *
 * 🔴 세 가지를 반드시 본다(이슈 지시): 리포트가 아직 없을 때, 공개 시각이 아직
 *    안 됐을 때, 운영자가 아니면 등록 API가 401인 것. 여기서도 "계산이 맞다"만
 *    보지 않고 `res.raw`로 「없어야 할 것」을 함께 본다 — 예를 들어 공개 전 리포트
 *    링크가 다른 필드 이름으로라도 새면 안 된다.
 */

type MeBody = MeApiResponse & { data?: Record<string, unknown> & { screen: string } };

let 카운터 = 0;

async function 마이페이지(token: string) {
  return callRoute<MeBody, { token: string }>(meGET, { params: { token } });
}

/** 행사가 끝난 사람 하나(상태는 무의미 — `resolveMeScreen`이 종료 시점이면 등록·입금
 *  여부와 무관하게 "ended"를 고른다, `tests/me.test.ts`가 이미 확인한 규칙). */
async function 종료된신청만들기(): Promise<{ token: string; id: string }> {
  카운터 += 1;
  const token = newToken();
  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, 'M', '1998-01-01') returning id
     )
     insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
     select id, $3, '입금완료', $4, now() from 사람
     returning id`,
    [`종료${카운터}`, `010${String(30000000 + 카운터).padStart(8, "0")}`, EVENT.id, token],
  );
  return { token, id: rows[0].id };
}

async function 운영자쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(adminLoginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  return { hg_admin: setCookies(res).hg_admin };
}

const 행사이후 = EVENT_SCHEMA.endISO;

describe("행사 후 화면 — 리포트 노출", () => {
  it("리포트를 등록한 적이 없으면 아직 준비 중이라고만 말한다 — 링크가 없다", async () => {
    const { token } = await 종료된신청만들기();

    const res = await at(행사이후, () => 마이페이지(token));

    expect(res.body.data?.screen).toBe("ended");
    expect(res.body.data?.report).toBeNull();
    expect(res.raw).not.toContain("pdf_url");
  });

  it("공개 시각이 아직 안 됐으면 링크를 보여주지 않는다", async () => {
    const { token, id } = await 종료된신청만들기();
    const 미래 = new Date(Date.parse(행사이후) + 30 * 24 * 60 * 60 * 1000); // 30일 뒤

    await q(
      `insert into report (application_id, pdf_url, published_at) values ($1, $2, $3)`,
      [id, "https://example.com/report-secret.pdf", 미래.toISOString()],
    );

    const res = await at(행사이후, () => 마이페이지(token));

    expect(res.body.data?.screen).toBe("ended");
    expect(res.body.data?.report).toBeNull();
    // 🔴 공개 전 링크가 다른 이름으로도 새면 안 된다.
    expect(res.raw).not.toContain("report-secret");
  });

  it("공개 시각이 지났으면 링크를 보여준다", async () => {
    const { token, id } = await 종료된신청만들기();
    const 과거 = new Date(Date.parse(행사이후) - 60 * 60 * 1000); // 1시간 전

    await q(
      `insert into report (application_id, pdf_url, published_at) values ($1, $2, $3)`,
      [id, "https://example.com/report.pdf", 과거.toISOString()],
    );

    const res = await at(행사이후, () => 마이페이지(token));

    expect(res.body.data?.screen).toBe("ended");
    expect((res.body.data as { report: { url: string } }).report.url).toBe(
      "https://example.com/report.pdf",
    );
  });

  it("공개 시각을 비워두면(등록만, 공개는 아직) 링크를 보여주지 않는다", async () => {
    const { token, id } = await 종료된신청만들기();

    await q(`insert into report (application_id, pdf_url, published_at) values ($1, $2, null)`, [
      id,
      "https://example.com/report.pdf",
    ]);

    const res = await at(행사이후, () => 마이페이지(token));

    expect(res.body.data?.report).toBeNull();
  });
});

describe("리포트 등록 API — POST /api/admin/applications/[id]/report", () => {
  it("운영자가 아니면 401이다", async () => {
    const { id } = await 종료된신청만들기();

    const res = await callRoute<{ ok: boolean }, { id: string }>(reportPOST, {
      method: "POST",
      params: { id },
      body: { pdfUrl: "https://example.com/report.pdf", actor: "몰래" },
    });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("운영자로 로그인하면 등록되고, 그 뒤 마이페이지에 반영된다", async () => {
    const { token, id } = await 종료된신청만들기();
    const cookies = await 운영자쿠키();

    const 등록 = await callRoute<{ ok: boolean; data: { pdfUrl: string; publishedAt: string | null } }, { id: string }>(
      reportPOST,
      {
        method: "POST",
        params: { id },
        cookies,
        body: {
          pdfUrl: "https://example.com/report.pdf",
          publishedAt: "2020-01-01T00:00:00.000Z", // 이미 지난 시각 — 곧바로 공개
          actor: "여동현",
        },
      },
    );
    expect(등록.status).toBe(200);
    expect(등록.body.ok).toBe(true);
    expect(등록.body.data.pdfUrl).toBe("https://example.com/report.pdf");

    const 확인 = await at(행사이후, () => 마이페이지(token));
    expect((확인.body.data as { report: { url: string } }).report.url).toBe(
      "https://example.com/report.pdf",
    );

    // 🔴 누가 등록했는지가 event_log에 남는다 — 운영자 셋이 비밀번호를 공유해서다.
    const log = await q<{ actor: string; kind: string }>(
      `select actor, kind from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(log[0]).toEqual({ actor: "여동현", kind: "리포트등록" });
  });

  it("같은 신청에 두 번 등록하면 최신 값으로 덮어쓴다 — 리포트가 두 줄로 쌓이지 않는다", async () => {
    const { token, id } = await 종료된신청만들기();
    const cookies = await 운영자쿠키();
    const 과거 = "2020-01-01T00:00:00.000Z";

    await callRoute(reportPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { pdfUrl: "https://example.com/v1.pdf", publishedAt: 과거, actor: "여동현" },
    });
    await callRoute(reportPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { pdfUrl: "https://example.com/v2.pdf", publishedAt: 과거, actor: "여동현" },
    });

    const rows = await q<{ n: string }>(`select count(*)::text as n from report`);
    expect(rows[0].n).toBe("1");

    const 확인 = await at(행사이후, () => 마이페이지(token));
    expect((확인.body.data as { report: { url: string } }).report.url).toBe(
      "https://example.com/v2.pdf",
    );
  });

  it("링크가 http(s)가 아니면 거절한다", async () => {
    const { id } = await 종료된신청만들기();
    const cookies = await 운영자쿠키();

    const res = await callRoute<{ ok: boolean; error: string }, { id: string }>(reportPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { pdfUrl: "javascript:alert(1)", actor: "여동현" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_pdf_url");
  });

  it("등록한 사람(actor)을 안 적으면 거절한다", async () => {
    const { id } = await 종료된신청만들기();
    const cookies = await 운영자쿠키();

    const res = await callRoute<{ ok: boolean; error: string }, { id: string }>(reportPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { pdfUrl: "https://example.com/report.pdf" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("need_actor");
  });

  it("없는 신청 id면 404다", async () => {
    const cookies = await 운영자쿠키();

    const res = await callRoute<{ ok: boolean }, { id: string }>(reportPOST, {
      method: "POST",
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
      body: { pdfUrl: "https://example.com/report.pdf", actor: "여동현" },
    });

    expect(res.status).toBe(404);
  });

  it("🔴 id가 uuid 모양이 아니면 500이 아니라 404다 — Postgres가 uuid 변환에서 던지기 전에 막는다", async () => {
    const cookies = await 운영자쿠키();

    const res = await callRoute<{ ok: boolean }, { id: string }>(reportPOST, {
      method: "POST",
      params: { id: "이런-id는-uuid가-아니다" },
      cookies,
      body: { pdfUrl: "https://example.com/report.pdf", actor: "여동현" },
    });

    expect(res.status).toBe(404);
  });
});

describe("리포트 조회 API — GET /api/admin/applications/[id]/report", () => {
  it("운영자가 아니면 401이다", async () => {
    const { id } = await 종료된신청만들기();

    const res = await callRoute<{ ok: boolean }, { id: string }>(reportGET, { params: { id } });

    expect(res.status).toBe(401);
  });

  it("등록된 적 없으면 둘 다 null이다", async () => {
    const { id } = await 종료된신청만들기();
    const cookies = await 운영자쿠키();

    const res = await callRoute<
      { ok: boolean; data: { pdfUrl: string | null; publishedAt: string | null } },
      { id: string }
    >(reportGET, { params: { id }, cookies });

    expect(res.body.data).toEqual({ pdfUrl: null, publishedAt: null });
  });
});
