import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as applicationsGET } from "@/app/api/admin/applications/route";
import { GET as applicationGET } from "@/app/api/admin/applications/[id]/route";
import { POST as screenPOST } from "@/app/api/admin/applications/[id]/screen/route";
import { proxy } from "@/proxy";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import type { AdminApplicationRow } from "@/lib/admin-list";
import type { AdminApplicationDetail } from "@/lib/admin-data";
import { at, callRoute, q, setCookies } from "./helpers";

/**
 * 운영자 보호 · 신청 목록 · 화면 고정 (이슈 #34).
 *
 * `tests/harness.test.ts` 상단 주석이 예고한 자리다 — "진짜 운영자 API가 서는
 * #34에서 그쪽을 직접 부르는 검사가 따로 생긴다." 여기서 확인하는 것은 둘이다.
 *
 * 🔴 ① **로그인 안 하면 막힌다**뿐 아니라 **로그인하면 실제로 데이터가 온다**도
 *    본다 — 핸드오프 기록에 따르면 이 뒤쪽을 확인하는 검사가 예전에 빠져서
 *    6개월간 아무도 admin API가 실제로 열리는지 몰랐다.
 * ② `src/proxy.ts`(주소 패턴으로 미리 막는 문)와 라우트별 `isAdmin()`(이중 방어의
 *    두 번째 문)을 **각각** 검사한다 — 하나가 있어도 다른 하나가 빠지면 새기 쉽다.
 */

type ItemsBody = { ok: boolean; data?: { items: AdminApplicationRow[] } };
type DetailBody = { ok: boolean; data?: AdminApplicationDetail; error?: string };

let 카운터 = 0;

async function 로그인쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(loginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  const hg_admin = setCookies(res).hg_admin;
  return { hg_admin };
}

/** 신청 하나를 원하는 모양으로 직접 만든다. `admin.test.ts` 전용 — 다른 파일과 번호가 안 겹치게 카운터를 쓴다. */
async function 신청만들기(opts: {
  name?: string;
  gender?: "M" | "F";
  status?: "신청함" | "입금완료" | "취소됨";
  dueAt?: Date | null;
  viewOverride?: string | null;
}): Promise<{ id: string; token: string; phone: string }> {
  카운터 += 1;
  const token = newToken();
  const phone = `010${String(50000000 + 카운터).padStart(8, "0")}`;
  const status = opts.status ?? "신청함";
  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1997-03-03') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, due_at, view_override, paid_at)
     select id, $4, $5, $6, now(), $7, $8, $9 from 사람
     returning id`,
    [
      opts.name ?? `사람${카운터}`,
      phone,
      opts.gender ?? "M",
      EVENT.id,
      status,
      token,
      opts.dueAt ?? null,
      opts.viewOverride ?? null,
      status === "입금완료" ? new Date() : null,
    ],
  );
  return { id: rows[0].id, token, phone };
}

async function 입금완료로채우기(gender: "M" | "F", n: number) {
  for (let i = 0; i < n; i += 1) {
    카운터 += 1;
    await q(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth)
         values ($1, $2, $3, '1996-01-01') returning id
       )
       insert into application
         (applicant_id, event_id, status, token, privacy_agreed_at, paid_at)
       select id, $4, '입금완료', $5, now(), now() from 사람`,
      [`채움${카운터}`, `0109${gender === "M" ? "1" : "2"}${String(카운터).padStart(6, "0")}`, gender, EVENT.id, newToken()],
    );
  }
}

describe("GET /api/admin/applications — 이중 방어", () => {
  it("로그인 없이 부르면 401이고 아무 이름도 새지 않는다", async () => {
    await 신청만들기({ name: "홍길동" });

    const res = await callRoute<ItemsBody>(applicationsGET);

    expect(res.status).toBe(401);
    expect(res.raw).not.toContain("홍길동");
  });

  it("🔴 로그인하면 실제 데이터가 온다", async () => {
    await 신청만들기({ name: "김한결", gender: "F", status: "입금완료" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(applicationsGET, { cookies });

    expect(res.status).toBe(200);
    const row = res.body.data?.items.find((r) => r.name === "김한결");
    expect(row).toBeTruthy();
    expect(row?.gender).toBe("F");
    expect(row?.status).toBe("입금완료");
    expect(row?.age).toBeGreaterThan(0);
  });

  it("이름·연락처로 검색한다", async () => {
    const 대상 = await 신청만들기({ name: "박서준" });
    await 신청만들기({ name: "이도윤" });
    const cookies = await 로그인쿠키();

    const 이름검색 = await callRoute<ItemsBody>(applicationsGET, {
      cookies,
      query: { q: "박서준" },
    });
    expect(이름검색.body.data?.items.map((r) => r.id)).toEqual([대상.id]);

    const 전화검색 = await callRoute<ItemsBody>(applicationsGET, {
      cookies,
      query: { q: 대상.phone.slice(-4) },
    });
    expect(전화검색.body.data?.items.map((r) => r.id)).toContain(대상.id);
  });

  it("상태·성별로 거른다", async () => {
    await 신청만들기({ name: "취소자", status: "취소됨", gender: "M" });
    await 신청만들기({ name: "여성신청", status: "신청함", gender: "F" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(applicationsGET, {
      cookies,
      query: { status: "취소됨" },
    });
    expect(res.body.data?.items.every((r) => r.status === "취소됨")).toBe(true);

    const res2 = await callRoute<ItemsBody>(applicationsGET, {
      cookies,
      query: { gender: "F" },
    });
    expect(res2.body.data?.items.every((r) => r.gender === "F")).toBe(true);
  });

  it("🔴 기한이 12시간 미만 남은 사람만 dueSoon이다", async () => {
    // ⚠️ 실제 지금을 기준으로 얼린다. 로그인 세션의 유효기간(12시간)이 여기서
    //    함께 걸리므로, 로그인 시각과 동떨어진 임의의 미래로 얼리면 얼린 순간
    //    세션이 이미 "만료"로 보인다 — 검사하려는 것과 무관한 이유로 401이 난다.
    const now = new Date();
    const 임박 = await 신청만들기({
      name: "임박자",
      dueAt: new Date(now.getTime() + 5 * 3_600_000),
    });
    const 여유 = await 신청만들기({
      name: "여유자",
      dueAt: new Date(now.getTime() + 20 * 3_600_000),
    });
    // 입금완료면 기한이 남아 있어도 더는 뜻이 없다 — dueSoon이 아니다.
    const 이미확정 = await 신청만들기({
      name: "확정자",
      status: "입금완료",
      dueAt: new Date(now.getTime() + 1 * 3_600_000),
    });
    const cookies = await 로그인쿠키();

    const res = await at(now.toISOString(), () => callRoute<ItemsBody>(applicationsGET, { cookies }));

    const byId = new Map(res.body.data?.items.map((r) => [r.id, r]));
    expect(byId.get(임박.id)?.dueSoon).toBe(true);
    expect(byId.get(여유.id)?.dueSoon).toBe(false);
    expect(byId.get(이미확정.id)?.dueSoon).toBe(false);
  });

  it("자기 성별 자리가 다 찬 신청함은 waitlisted다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);
    const 대기자 = await 신청만들기({ name: "대기중", gender: "M", status: "신청함" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(applicationsGET, { cookies });

    expect(res.body.data?.items.find((r) => r.id === 대기자.id)?.waitlisted).toBe(true);
  });

  it("화면이 고정된 신청은 screenLocked다", async () => {
    const 고정됨 = await 신청만들기({ name: "고정된사람", viewOverride: "confirmed" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(applicationsGET, { cookies });

    const row = res.body.data?.items.find((r) => r.id === 고정됨.id);
    expect(row?.screenLocked).toBe(true);
    expect(row?.viewOverride).toBe("confirmed");
  });
});

describe("GET /api/admin/applications/[id] — 상세 서랍", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({ name: "비공개" });

    const res = await callRoute<DetailBody, { id: string }>(applicationGET, { params: { id } });

    expect(res.status).toBe(401);
    expect(res.raw).not.toContain("비공개");
  });

  it("없는 id는 로그인해도 404다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<DetailBody, { id: string }>(applicationGET, {
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
    });

    expect(res.status).toBe(404);
  });

  it("로그인하면 답변·돈 줄·발송 이력·조작 로그가 한 번에 온다", async () => {
    const { id } = await 신청만들기({ name: "상세보기" });
    await q(
      `insert into answer (application_id, form, form_version, a) values ($1, '사전질문', 'v1', '{"R1":1}'::jsonb)`,
      [id],
    );
    await q(
      `insert into money (application_id, event_id, kind, amount, occurred_at, recorded_by)
       values ($1, $2, '입금', 39000, now(), $3)`,
      [id, EVENT.id, SITE.operators[0].name],
    );
    await q(
      `insert into notification (application_id, template_id, body, status, sent_by)
       values ($1, '입금안내', '테스트 발송', '성공', 'system')`,
      [id],
    );
    await q(`insert into event_log (application_id, kind, actor) values ($1, '신청', 'system')`, [id]);
    const cookies = await 로그인쿠키();

    const res = await callRoute<DetailBody, { id: string }>(applicationGET, {
      params: { id },
      cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.application.name).toBe("상세보기");
    expect(res.body.data?.answers).toHaveLength(1);
    expect(res.body.data?.money).toHaveLength(1);
    expect(res.body.data?.money[0].amount).toBe(39000);
    expect(res.body.data?.notifications).toHaveLength(1);
    expect(res.body.data?.eventLog.length).toBeGreaterThanOrEqual(1);
  });
});

describe("POST /api/admin/applications/[id]/screen — 화면 고정 (결정 13)", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<{ ok: boolean }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id },
      body: { screen: "confirmed", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(401);
  });

  it("명단에 없는 이름은 거절한다 — 조작자 없이 상태를 못 바꾼다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<{ ok: boolean; error?: string }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { screen: "confirmed", actor: "듣도보도못한사람" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_actor");
  });

  it("모르는 화면 이름은 거절한다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<{ ok: boolean; error?: string }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { screen: "이런화면없다", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_screen");
  });

  it("🔴 고정하면 값이 저장되고, 누가 고정했는지가 조작 로그에 남는다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();
    const actor = SITE.operators[1].name;

    const res = await callRoute<{ ok: boolean }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { screen: "payment", actor },
    });
    expect(res.status).toBe(200);

    const rows = await q<{ view_override: string }>(
      `select view_override from application where id = $1`,
      [id],
    );
    expect(rows[0].view_override).toBe("payment");

    const logs = await q<{ kind: string; actor: string }>(
      `select kind, actor from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(logs[0]).toEqual({ kind: "화면고정", actor });
  });

  it("고정 해제(screen: null)는 view_override를 비우고 로그를 남긴다", async () => {
    const { id } = await 신청만들기({ viewOverride: "questions" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<{ ok: boolean }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { screen: null, actor: SITE.operators[0].name },
    });
    expect(res.status).toBe(200);

    const rows = await q<{ view_override: string | null }>(
      `select view_override from application where id = $1`,
      [id],
    );
    expect(rows[0].view_override).toBeNull();

    const logs = await q<{ kind: string }>(
      `select kind from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(logs[0].kind).toBe("화면고정해제");
  });

  it("없는 신청은 404다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<{ ok: boolean }, { id: string }>(screenPOST, {
      method: "POST",
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
      body: { screen: "confirmed", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(404);
  });
});

describe("src/proxy.ts — 주소 패턴으로 미리 막는 문", () => {
  const base = "http://localhost:3000";

  it("쿠키 없이 /admin을 부르면 로그인 화면으로 돌려보낸다", () => {
    const req = new NextRequest(new URL("/admin", base));

    const res = proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${base}/admin/login`);
  });

  it("/admin/login 자체는 통과시킨다 — 안 그러면 비밀번호를 넣을 주소가 없다", () => {
    const req = new NextRequest(new URL("/admin/login", base));

    const res = proxy(req);

    expect(res.headers.get("location")).toBeNull();
  });

  it("/api/admin/login도 통과시킨다", () => {
    const req = new NextRequest(new URL("/api/admin/login", base), { method: "POST" });

    const res = proxy(req);

    expect(res.status).not.toBe(401);
  });

  it("쿠키 없이 운영자 API를 부르면 401 JSON이다 — 화면처럼 리다이렉트로 감추지 않는다", () => {
    const req = new NextRequest(new URL("/api/admin/applications", base));

    const res = proxy(req);

    expect(res.status).toBe(401);
  });

  it("🔴 유효한 세션 쿠키가 있으면 화면도 API도 통과한다", async () => {
    const cookies = await 로그인쿠키();

    const 화면 = proxy(
      new NextRequest(new URL("/admin", base), { headers: { cookie: `hg_admin=${cookies.hg_admin}` } }),
    );
    expect(화면.headers.get("location")).toBeNull();

    const api = proxy(
      new NextRequest(new URL("/api/admin/applications", base), {
        headers: { cookie: `hg_admin=${cookies.hg_admin}` },
      }),
    );
    expect(api.status).toBe(200); // NextResponse.next()
  });
});
