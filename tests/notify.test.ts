import { describe, expect, it } from "vitest";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as notifyGET } from "@/app/api/admin/notify/route";
import { POST as previewPOST } from "@/app/api/admin/notify/preview/route";
import { POST as sendPOST } from "@/app/api/admin/notify/send/route";
import { fakeOutbox } from "@/lib/alimtalk";
import { newToken } from "@/lib/admin";
import { TEMPLATE } from "@/lib/notification";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import type { NotifyFailedRow, NotifyTemplateOption, NotifyTodoRow } from "@/lib/admin-notify";
import { at, callRoute, q, setCookies } from "./helpers";

/**
 * 알림톡 보내는 화면 (이슈 #37).
 *
 * 자동화는 신청 직후 입금 안내 하나뿐이라(`notification.ts`), 이 화면의 「오늘 보낼
 * 것」·「보내다 실패한 것」이 실제로 사람을 놓치지 않는지가 이 검사의 핵심이다.
 * 그다음으로 무서운 사고는 **미치환 변수가 손님에게 그대로 나가는 것**이므로
 * 미리보기·발송 양쪽에서 막히는지를 함께 본다.
 */

type NotifyBody = {
  ok: boolean;
  data?: { todo: NotifyTodoRow[]; failed: NotifyFailedRow[]; templates: NotifyTemplateOption[] };
};
type PreviewBody = {
  ok: boolean;
  data?: { items: { id: string; name: string; phone: string; text: string; missing: string[] }[]; notFoundIds: string[] };
  error?: string;
};
type SendBody = {
  ok: boolean;
  data?: {
    results: { applicationId: string; ok: boolean; notificationId: string | null; reason?: string }[];
    notFoundIds: string[];
  };
  error?: string;
};

let 카운터 = 0;

async function 로그인쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(loginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  const hg_admin = setCookies(res).hg_admin;
  return { hg_admin };
}

/** 신청 하나를 원하는 모양으로 직접 만든다. `admin.test.ts`의 같은 이름 헬퍼와 같은 자리 —
 *  파일마다 번호가 안 겹치게 카운터를 따로 쓴다. */
async function 신청만들기(opts: {
  name?: string;
  status?: "신청함" | "입금완료" | "취소됨";
  dueAt?: Date | null;
}): Promise<{ id: string; token: string; phone: string }> {
  카운터 += 1;
  const token = newToken();
  const phone = `010${String(60000000 + 카운터).padStart(8, "0")}`;
  const status = opts.status ?? "신청함";
  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, 'M', '1997-03-03') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, due_at, paid_at)
     select id, $3, $4, $5, now(), $6, $7 from 사람
     returning id`,
    [
      opts.name ?? `사람${카운터}`,
      phone,
      EVENT.id,
      status,
      token,
      opts.dueAt ?? null,
      status === "입금완료" ? new Date() : null,
    ],
  );
  return { id: rows[0].id, token, phone };
}

describe("GET /api/admin/notify — 이중 방어", () => {
  it("로그인 없이 부르면 401이고 아무 이름도 새지 않는다", async () => {
    await 신청만들기({ name: "숨어야할이름", status: "신청함", dueAt: new Date(Date.now() + 3_600_000) });

    const res = await callRoute<NotifyBody>(notifyGET);

    expect(res.status).toBe(401);
    expect(res.raw).not.toContain("숨어야할이름");
  });

  it("🔴 기한이 12시간 미만 남은 신청함이 「기한임박」으로 오늘 보낼 것에 뜬다", async () => {
    const now = new Date();
    const 임박 = await 신청만들기({
      name: "임박자",
      status: "신청함",
      dueAt: new Date(now.getTime() + 5 * 3_600_000),
    });
    await 신청만들기({
      name: "여유자",
      status: "신청함",
      dueAt: new Date(now.getTime() + 20 * 3_600_000),
    });
    const cookies = await 로그인쿠키();

    const res = await at(now.toISOString(), () => callRoute<NotifyBody>(notifyGET, { cookies }));

    const row = res.body.data?.todo.find((r) => r.id === 임박.id);
    expect(row).toBeTruthy();
    expect(row?.reasons).toContain("기한임박");
    expect(res.body.data?.todo.some((r) => r.name === "여유자")).toBe(false);
  });

  it("🔴 입금완료인데 「자리확정」 안내를 아직 안 보낸 사람이 「확정후미발송」으로 뜬다", async () => {
    const 확정자 = await 신청만들기({ name: "확정자", status: "입금완료" });
    const cookies = await 로그인쿠키();

    const res1 = await callRoute<NotifyBody>(notifyGET, { cookies });
    const row1 = res1.body.data?.todo.find((r) => r.id === 확정자.id);
    expect(row1?.reasons).toContain("확정후미발송");

    // 🔴 자리확정 안내를 실제로 성공시켜 보내고 나면 더는 「확정후미발송」이 아니다 —
    //    이 사람은 다른 이유(기한임박·행사임박)도 없으므로 목록에서 통째로 빠진다.
    //    같은 사람에게 같은 이유로 계속 뜨면 운영자가 매번 다시 확인해야 한다.
    await q(
      `insert into notification (application_id, template_id, body, status, sent_by)
       values ($1, $2, '테스트 발송', '성공', 'system')`,
      [확정자.id, TEMPLATE.자리확정],
    );
    const res2 = await callRoute<NotifyBody>(notifyGET, { cookies });
    const row2 = res2.body.data?.todo.find((r) => r.id === 확정자.id);
    expect(row2).toBeUndefined();
  });

  it("🔴 행사 이틀 전부터 당일까지, 확정자 중 「전날안내」를 안 보낸 사람이 「행사임박」으로 뜬다", async () => {
    const eventDayStart = new Date(`${EVENT.dateISO}T00:00:00+09:00`);
    const 이틀전 = new Date(eventDayStart.getTime() - 2 * 24 * 3_600_000 + 3_600_000);
    const 한참전 = new Date(eventDayStart.getTime() - 10 * 24 * 3_600_000);

    const 확정자 = await 신청만들기({ name: "임박확정자", status: "입금완료" });

    // ⚠️ 로그인 세션은 12시간짜리다(`admin.ts`). 실제 지금과 동떨어진 먼 날짜로
    //    얼린 **뒤에** 로그인해야, 그 시각을 기준으로 세션이 아직 유효하다
    //    (`admin.test.ts`의 「기한이 12시간 미만…」 검사와 같은 주의).
    const 멀때 = await at(한참전.toISOString(), async () => {
      const cookies = await 로그인쿠키();
      return callRoute<NotifyBody>(notifyGET, { cookies });
    });
    // 확정후미발송 이유는 날짜와 무관하게 계속 걸리므로 이 사람은 여전히 목록에
    // 있지만, 「행사임박」은 아직 아니다.
    const row멀때 = 멀때.body.data?.todo.find((r) => r.id === 확정자.id);
    expect(row멀때?.reasons).not.toContain("행사임박");
    expect(row멀때?.reasons).toContain("확정후미발송");

    const 임박때 = await at(이틀전.toISOString(), async () => {
      const cookies = await 로그인쿠키();
      return callRoute<NotifyBody>(notifyGET, { cookies });
    });
    const row임박때 = 임박때.body.data?.todo.find((r) => r.id === 확정자.id);
    expect(row임박때?.reasons).toContain("행사임박");
  });

  it("취소된 신청은 오늘 보낼 것에 뜨지 않는다", async () => {
    const 취소자 = await 신청만들기({
      name: "취소자",
      status: "취소됨",
      dueAt: new Date(Date.now() + 3_600_000),
    });
    const cookies = await 로그인쿠키();

    const res = await callRoute<NotifyBody>(notifyGET, { cookies });

    expect(res.body.data?.todo.some((r) => r.id === 취소자.id)).toBe(false);
  });

  it("🔴 발송 실패 기록이 「보내다 실패한 것」에 뜬다", async () => {
    const { id } = await 신청만들기({ name: "실패자" });
    await q(
      `insert into notification (application_id, template_id, body, status, error, sent_by)
       values ($1, $2, '채우지 못한 변수: 환불액', '실패', '테스트 사유', 'system')`,
      [id, TEMPLATE.환불완료],
    );
    const cookies = await 로그인쿠키();

    const res = await callRoute<NotifyBody>(notifyGET, { cookies });

    const row = res.body.data?.failed.find((r) => r.applicationId === id);
    expect(row).toBeTruthy();
    expect(row?.name).toBe("실패자");
    expect(row?.error).toBe("테스트 사유");
    expect(row?.templateId).toBe(TEMPLATE.환불완료);
  });

  it("고를 수 있는 문구 아홉 개가 함께 온다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<NotifyBody>(notifyGET, { cookies });

    expect(res.body.data?.templates.length).toBe(9);
    expect(res.body.data?.templates.map((t) => t.id)).toContain(TEMPLATE.입금안내);
  });
});

describe("POST /api/admin/notify/preview", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      body: { applicationIds: [id], templateId: TEMPLATE.입금안내 },
    });

    expect(res.status).toBe(401);
  });

  it("변수를 전부 채울 수 있으면 missing이 비어 있고 문구 그대로 온다", async () => {
    const now = new Date();
    const { id } = await 신청만들기({
      name: "미리보기대상",
      status: "신청함",
      dueAt: new Date(now.getTime() + 10 * 3_600_000),
    });
    const cookies = await 로그인쿠키();

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.입금안내 },
    });

    expect(res.status).toBe(200);
    const item = res.body.data?.items[0];
    expect(item?.missing).toEqual([]);
    expect(item?.text).toContain("미리보기대상");
    expect(item?.text).not.toContain("#{");
  });

  it("🔴 채우지 못한 변수가 있으면 missing에 담겨 온다 — 계좌 대신 이걸로 막는다", async () => {
    // 환불완료 문구는 #{환불액}·#{처리일}을 쓰는데, money에 환불 기록이 없다.
    const { id } = await 신청만들기({ name: "환불대상", status: "취소됨" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.환불완료 },
    });

    expect(res.status).toBe(200);
    const item = res.body.data?.items[0];
    expect(item?.missing).toEqual(expect.arrayContaining(["환불액", "처리일"]));
  });

  it("환불 기록이 있으면 환불완료 문구가 전부 채워진다", async () => {
    const { id } = await 신청만들기({ name: "환불완료대상", status: "취소됨" });
    await q(
      `insert into money (application_id, event_id, kind, amount, occurred_at, recorded_by)
       values ($1, $2, '환불', 19500, now(), $3)`,
      [id, EVENT.id, SITE.operators[0].name],
    );
    const cookies = await 로그인쿠키();

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.환불완료 },
    });

    const item = res.body.data?.items[0];
    expect(item?.missing).toEqual([]);
    expect(item?.text).toContain("19,500원");
  });

  it("꺼진 문구 id는 거절한다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: "없는문구" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_template");
  });

  it("받을 사람이 없으면 거절한다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<PreviewBody>(previewPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [], templateId: TEMPLATE.입금안내 },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("no_recipients");
  });
});

describe("POST /api/admin/notify/send", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<SendBody>(sendPOST, {
      method: "POST",
      body: { applicationIds: [id], templateId: TEMPLATE.입금안내, actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(401);
  });

  it("명단에 없는 이름은 거절한다 — 조작자 없이 못 보낸다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<SendBody>(sendPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.입금안내, actor: "듣도보도못한사람" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_actor");
  });

  it("🔴 여러 명에게 한 번에 보내면 실제로 나가고(가짜 발송기), sent_by가 기록에 남는다", async () => {
    const now = new Date();
    const a = await 신청만들기({
      name: "받는사람A",
      status: "신청함",
      dueAt: new Date(now.getTime() + 10 * 3_600_000),
    });
    const b = await 신청만들기({
      name: "받는사람B",
      status: "신청함",
      dueAt: new Date(now.getTime() + 10 * 3_600_000),
    });
    const cookies = await 로그인쿠키();
    const actor = SITE.operators[1].name;

    const res = await callRoute<SendBody>(sendPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [a.id, b.id], templateId: TEMPLATE.기한임박, actor },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.results.every((r) => r.ok)).toBe(true);
    expect(fakeOutbox().some((m) => m.phone === a.phone)).toBe(true);
    expect(fakeOutbox().some((m) => m.phone === b.phone)).toBe(true);

    const rows = await q<{ sent_by: string; status: string }>(
      `select sent_by, status from notification where application_id = $1`,
      [a.id],
    );
    expect(rows[0]).toEqual({ sent_by: actor, status: "성공" });
  });

  it("🔴 채우지 못한 변수가 있으면 보내지 않고 실패로 기록한다 — #{}가 그대로 나가지 않는다", async () => {
    const { id } = await 신청만들기({ name: "환불미기록", status: "취소됨" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<SendBody>(sendPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.환불완료, actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(200);
    const result = res.body.data?.results[0];
    expect(result?.ok).toBe(false);
    expect(result?.reason).toContain("환불액");
    // 아무것도 밖으로 안 나간 것도 함께 확인한다(가짜 발송기 outbox가 비어 있다).
    expect(fakeOutbox().some((m) => m.text.includes("#{"))).toBe(false);

    const rows = await q<{ status: string; body: string }>(
      `select status, body from notification where application_id = $1`,
      [id],
    );
    expect(rows[0].status).toBe("실패");
    expect(rows[0].body).toContain("#{환불액}"); // 못 채운 자리가 기록에는 그대로 남는다
  });

  it("자동 재시도가 없다 — 이 라우트를 한 번 부르면 시도도 한 번만 남는다", async () => {
    const { id } = await 신청만들기({ name: "한번만", status: "취소됨" });
    const cookies = await 로그인쿠키();

    await callRoute<SendBody>(sendPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [id], templateId: TEMPLATE.환불완료, actor: SITE.operators[0].name },
    });

    const rows = await q<{ id: string }>(`select id from notification where application_id = $1`, [id]);
    expect(rows).toHaveLength(1);
  });

  it("받을 사람이 없으면 거절한다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<SendBody>(sendPOST, {
      method: "POST",
      cookies,
      body: { applicationIds: [], templateId: TEMPLATE.입금안내, actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("no_recipients");
  });
});
