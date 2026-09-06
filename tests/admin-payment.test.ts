import { describe, expect, it } from "vitest";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as applicationsGET } from "@/app/api/admin/applications/route";
import { GET as applicationGET } from "@/app/api/admin/applications/[id]/route";
import { POST as paymentPOST } from "@/app/api/admin/applications/[id]/payment/route";
import { POST as refundPOST } from "@/app/api/admin/applications/[id]/refund/route";
import { POST as cancelPOST } from "@/app/api/admin/applications/[id]/cancel/route";
import { recordPayment } from "@/lib/admin-data";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import type { AdminApplicationRow } from "@/lib/admin-list";
import type { AdminApplicationDetail } from "@/lib/admin-data";
import { callRoute, q, setCookies } from "./helpers";

/**
 * 입금 확인과 돈 줄 — 자리가 차는 곳 (이슈 #35).
 *
 * 🔴 이 시스템에서 자리가 차는 유일한 순간을 검사한다. 가장 중요한 것은 「상태 변경과
 *    돈 줄 쌓기가 한 번의 요청으로 함께 일어난다」이고, 그다음은 「금액이 39,000원이
 *    아니어도 막지 않는다」·「돈 줄은 덧붙이기만 한다」다. `admin.test.ts`와 같은 자리
 *    (`callRoute`로 라우트를 직접 부른다)를 쓴다.
 */

type ItemsBody = { ok: boolean; data?: { items: AdminApplicationRow[]; seats?: { taken: { M: number; F: number }; remaining: { M: number; F: number } } } };
type DetailBody = { ok: boolean; data?: AdminApplicationDetail; error?: string };
type OkBody = { ok: boolean; error?: string; message?: string; data?: { amountMismatch?: boolean; overCapacity?: boolean } };

let 카운터 = 0;

async function 로그인쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(loginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  const hg_admin = setCookies(res).hg_admin;
  return { hg_admin };
}

async function 신청만들기(opts: {
  name?: string;
  gender?: "M" | "F";
  status?: "신청함" | "입금완료" | "취소됨";
}): Promise<{ id: string; token: string; phone: string }> {
  카운터 += 1;
  const token = newToken();
  const phone = `010${String(60000000 + 카운터).padStart(8, "0")}`;
  const status = opts.status ?? "신청함";
  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1997-03-03') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, paid_at)
     select id, $4, $5, $6, now(), $7 from 사람
     returning id`,
    [
      opts.name ?? `사람${카운터}`,
      phone,
      opts.gender ?? "M",
      EVENT.id,
      status,
      token,
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
      [`채움${카운터}`, `0108${gender === "M" ? "1" : "2"}${String(카운터).padStart(6, "0")}`, gender, EVENT.id, newToken()],
    );
  }
}

const 정상입금 = () => ({
  amount: 39000,
  occurredAt: "2026-09-06T10:00",
  depositorName: "홍길동",
  actor: SITE.operators[0].name,
});

describe("POST /api/admin/applications/[id]/payment — 입금 확인", () => {
  it("로그인 없이 부르면 401이고 상태가 바뀌지 않는다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      body: 정상입금(),
    });

    expect(res.status).toBe(401);
    const rows = await q<{ status: string }>(`select status from application where id = $1`, [id]);
    expect(rows[0].status).toBe("신청함");
  });

  it("명단에 없는 이름은 거절한다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { ...정상입금(), actor: "듣도보도못한사람" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_actor");
  });

  it("🔴 버튼 한 번에 상태 변경과 돈 줄 쌓기가 함께 일어난다", async () => {
    const { id } = await 신청만들기({ name: "입금할사람" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: 정상입금(),
    });

    expect(res.status).toBe(200);

    const app = await q<{ status: string; paid_at: Date | null }>(
      `select status, paid_at from application where id = $1`,
      [id],
    );
    expect(app[0].status).toBe("입금완료");
    expect(app[0].paid_at).not.toBeNull();

    const money = await q<{ kind: string; amount: number; recorded_by: string }>(
      `select kind, amount, recorded_by from money where application_id = $1`,
      [id],
    );
    expect(money).toHaveLength(1);
    expect(money[0]).toEqual({ kind: "입금", amount: 39000, recorded_by: SITE.operators[0].name });

    const logs = await q<{ kind: string; actor: string }>(
      `select kind, actor from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(logs[0]).toEqual({ kind: "입금확인", actor: SITE.operators[0].name });
  });

  it("🔴 상태 변경과 돈 줄 쌓기 중 하나만 반영되는 경우가 없다 — 트랜잭션이 통째로 롤백된다", async () => {
    // `money.amount`의 DB 체크 제약(양수)을 어겨 insert가 실패하게 만든다.
    // 앱 레이어(`parseMoneyBody`)가 이미 이런 값을 걸러내므로, 트랜잭션 자체의
    // 원자성은 라이브러리 함수(`recordPayment`)를 직접 불러 검사한다.
    const { id } = await 신청만들기({ name: "롤백대상" });

    await expect(
      recordPayment(id, {
        amount: -1000,
        occurredAt: new Date(),
        depositorName: "누구",
        note: null,
        actor: SITE.operators[0].name,
      }),
    ).rejects.toThrow();

    const app = await q<{ status: string; paid_at: Date | null }>(
      `select status, paid_at from application where id = $1`,
      [id],
    );
    expect(app[0].status).toBe("신청함");
    expect(app[0].paid_at).toBeNull();

    const money = await q(`select 1 from money where application_id = $1`, [id]);
    expect(money).toHaveLength(0);
  });

  it("🔴 금액이 39,000원이 아니어도 그대로 저장되고, 목록에 표시가 남는다", async () => {
    const { id } = await 신청만들기({ name: "다른금액" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { ...정상입금(), amount: 40000 },
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.amountMismatch).toBe(true);

    const money = await q<{ amount: number }>(`select amount from money where application_id = $1`, [id]);
    expect(money[0].amount).toBe(40000);

    const list = await callRoute<ItemsBody>(applicationsGET, { cookies });
    const row = list.body.data?.items.find((r) => r.id === id);
    expect(row?.amountMismatch).toBe(true);

    const detail = await callRoute<DetailBody, { id: string }>(applicationGET, { params: { id }, cookies });
    expect(detail.body.data?.money[0].amountMismatch).toBe(true);
  });

  it("재입금 — 돈 줄은 덧붙이기만 한다(기존 줄이 줄지 않는다)", async () => {
    const { id } = await 신청만들기({ name: "두번입금" });
    const cookies = await 로그인쿠키();

    const 첫번째 = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: 정상입금(),
    });
    expect(첫번째.status).toBe(200);
    const 첫paid = (await q<{ paid_at: Date }>(`select paid_at from application where id = $1`, [id]))[0].paid_at;

    const 두번째 = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { ...정상입금(), amount: 5000, depositorName: "추가입금" },
    });
    expect(두번째.status).toBe(200);

    const money = await q<{ amount: number }>(
      `select amount from money where application_id = $1 order by created_at`,
      [id],
    );
    expect(money.map((r) => r.amount)).toEqual([39000, 5000]);

    // 🔴 자리가 찬 시각(재입금이 아니라 최초 확인)은 뒤로 밀리지 않는다.
    const 둘째paid = (await q<{ paid_at: Date }>(`select paid_at from application where id = $1`, [id]))[0].paid_at;
    expect(new Date(둘째paid).getTime()).toBe(new Date(첫paid).getTime());
  });

  it("취소된 신청에는 입금을 확인할 수 없다", async () => {
    const { id } = await 신청만들기({ status: "취소됨" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: 정상입금(),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("cancelled");
  });

  it("없는 신청은 404다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
      body: 정상입금(),
    });

    expect(res.status).toBe(404);
  });

  it("금액이 0 이하거나 정수가 아니면 400이다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { ...정상입금(), amount: 0 },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_amount");
  });

  it("입금자명이 없으면 400이다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { amount: 39000, occurredAt: "2026-09-06T10:00", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_depositor_name");
  });

  it("🔴 정원이 찼는데 입금 확인을 누르면 경고를 주되 막지 않는다 — 응답은 200, 자리는 정원을 넘겨서도 찬다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);
    const { id } = await 신청만들기({ name: "정원초과자", gender: "M" });
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(paymentPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: 정상입금(),
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.overCapacity).toBe(true);

    const app = await q<{ status: string }>(`select status from application where id = $1`, [id]);
    expect(app[0].status).toBe("입금완료");
  });

  it("남은 자리가 성별로 GET /api/admin/applications에 보인다", async () => {
    await 입금완료로채우기("F", 3);
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(applicationsGET, { cookies });

    expect(res.body.data?.seats?.taken.F).toBe(3);
    expect(res.body.data?.seats?.remaining.F).toBe(EVENT.capacityPerGender - 3);
  });
});

describe("POST /api/admin/applications/[id]/refund — 환불", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<OkBody, { id: string }>(refundPOST, {
      method: "POST",
      params: { id },
      body: { amount: 19500, occurredAt: "2026-09-07T10:00", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(401);
  });

  it("환불을 돈 줄에 쌓는다 — 상태는 바뀌지 않는다", async () => {
    const { id } = await 신청만들기({ status: "입금완료" });
    const cookies = await 로그인쿠키();
    await callRoute(paymentPOST, { method: "POST", params: { id }, cookies, body: 정상입금() });

    const res = await callRoute<OkBody, { id: string }>(refundPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { amount: 19500, occurredAt: "2026-09-07T10:00", actor: SITE.operators[1].name, note: "절반 환불" },
    });

    expect(res.status).toBe(200);

    const money = await q<{ kind: string; amount: number }>(
      `select kind, amount from money where application_id = $1 order by created_at`,
      [id],
    );
    expect(money).toEqual([
      { kind: "입금", amount: 39000 },
      { kind: "환불", amount: 19500 },
    ]);

    const app = await q<{ status: string }>(`select status from application where id = $1`, [id]);
    expect(app[0].status).toBe("입금완료");

    const logs = await q<{ kind: string; actor: string }>(
      `select kind, actor from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(logs[0]).toEqual({ kind: "환불", actor: SITE.operators[1].name });
  });

  it("그 사람이 낸 돈은 입금 합 − 환불 합이다(상세 응답의 netPaid)", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();
    await callRoute(paymentPOST, { method: "POST", params: { id }, cookies, body: 정상입금() });
    await callRoute(refundPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { amount: 19500, occurredAt: "2026-09-07T10:00", actor: SITE.operators[0].name },
    });

    const detail = await callRoute<DetailBody, { id: string }>(applicationGET, { params: { id }, cookies });

    expect(detail.body.data?.netPaid).toBe(39000 - 19500);
    expect(detail.body.data?.money).toHaveLength(2);
  });

  it("없는 신청은 404다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(refundPOST, {
      method: "POST",
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
      body: { amount: 1000, occurredAt: "2026-09-07T10:00", actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/applications/[id]/cancel — 취소", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const { id } = await 신청만들기({});

    const res = await callRoute<OkBody, { id: string }>(cancelPOST, {
      method: "POST",
      params: { id },
      body: { actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(401);
  });

  it("actor 없이는 취소할 수 없다", async () => {
    const { id } = await 신청만들기({});
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(cancelPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_actor");

    const app = await q<{ status: string }>(`select status from application where id = $1`, [id]);
    expect(app[0].status).toBe("신청함");
  });

  it("🔴 취소되면 상태가 바뀌고 누가 취소했는지 조작 로그에 남는다 — 돈 줄은 그대로다", async () => {
    const { id } = await 신청만들기({ status: "입금완료" });
    const cookies = await 로그인쿠키();
    await callRoute(paymentPOST, { method: "POST", params: { id }, cookies, body: 정상입금() });

    const res = await callRoute<OkBody, { id: string }>(cancelPOST, {
      method: "POST",
      params: { id },
      cookies,
      body: { actor: SITE.operators[2].name, note: "본인 요청" },
    });

    expect(res.status).toBe(200);

    const app = await q<{ status: string }>(`select status from application where id = $1`, [id]);
    expect(app[0].status).toBe("취소됨");

    const money = await q(`select 1 from money where application_id = $1`, [id]);
    expect(money).toHaveLength(1); // 앞서 확인한 입금이 그대로 남아 있다

    const logs = await q<{ kind: string; actor: string }>(
      `select kind, actor from event_log where application_id = $1 order by at desc limit 1`,
      [id],
    );
    expect(logs[0]).toEqual({ kind: "취소", actor: SITE.operators[2].name });
  });

  it("없는 신청은 404다", async () => {
    const cookies = await 로그인쿠키();

    const res = await callRoute<OkBody, { id: string }>(cancelPOST, {
      method: "POST",
      params: { id: "00000000-0000-0000-0000-000000000000" },
      cookies,
      body: { actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(404);
  });
});
