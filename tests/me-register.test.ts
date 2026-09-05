import { describe, expect, it } from "vitest";
import { GET as meGET, POST as meRegisterPOST } from "@/app/api/me/[token]/route";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import type { MeApiResponse, MeRegisterApiResponse } from "@/lib/me-response";
import { callRoute, q } from "./helpers";

/**
 * 정식등록 `POST /api/me/[token]` (이슈 #33).
 *
 * 🔴 여기서 제일 무서운 사고는 계산 실수가 아니라 계좌가 **너무 일찍 새는 것**이다
 *    (`CLAUDE.md` "테스트"). 그래서 등록 응답 자체(`res.raw`)에 계좌가 없는지,
 *    그리고 등록 **전** 응답에 계좌가 없다가 등록 **후**에만 생기는지를 함께 본다.
 */

type MeBody = MeApiResponse & { data?: Record<string, unknown> & { screen: string } };
type RegisterBody = MeRegisterApiResponse;

let 카운터 = 0;

async function 마이페이지(token: string) {
  return callRoute<MeBody, { token: string }>(meGET, { params: { token } });
}

async function 등록(token: string, body: unknown) {
  return callRoute<RegisterBody, { token: string }>(meRegisterPOST, {
    method: "POST",
    body,
    params: { token },
  });
}

/** 그 사람의 신청 하나를 원하는 상태로 직접 만든다 (`tests/me.test.ts`와 같은 패턴). */
async function 신청만들기(opts: {
  status?: "신청함" | "입금완료" | "취소됨";
  gender?: "M" | "F";
  registered?: boolean;
  dueAt?: Date | null;
}): Promise<{ token: string; id: string }> {
  카운터 += 1;
  const token = newToken();
  const status = opts.status ?? "신청함";
  const gender = opts.gender ?? "M";

  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1998-01-01') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, registered_at, due_at, paid_at)
     select id, $4, $5, $6, now(), $7, $8, $9 from 사람
     returning id`,
    [
      `등록사람${카운터}`,
      `010${String(20000000 + 카운터).padStart(8, "0")}`,
      gender,
      EVENT.id,
      status,
      token,
      opts.registered ? new Date() : null,
      opts.dueAt ?? null,
      status === "입금완료" ? new Date() : null,
    ],
  );

  return { token, id: rows[0].id };
}

const 유효한등록 = {
  marital: "미혼",
  job: "회사원",
  truth_agreed: true,
  refund_agreed: true,
};

describe("없는 토큰", () => {
  it("조용히 실패하지 않고 404로 분명히 거절한다", async () => {
    const res = await 등록("이런-토큰은-발급된-적이-없다", 유효한등록);

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect((res.body as { error: string }).error).toBe("not_found");
  });
});

describe("취소된 신청", () => {
  it("등록을 받지 않는다 — registered_at이 그대로 비어 있다", async () => {
    const { token, id } = await 신청만들기({ status: "취소됨" });

    const res = await 등록(token, 유효한등록);

    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe("cancelled");

    const rows = await q<{ registered_at: Date | null }>(
      `select registered_at from application where id = $1`,
      [id],
    );
    expect(rows[0].registered_at).toBeNull();
  });
});

describe("입력 검증", () => {
  it("혼인 여부가 없으면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, marital: undefined });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("bad_marital");
  });

  it("혼인 여부가 미혼·기혼이 아니면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, marital: "모름" });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("bad_marital");
  });

  it("직업이 비어 있으면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, job: "  " });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("bad_job");
  });

  it("이메일 형식이 아니면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, email: "이메일아님", email_agreed: true });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("bad_email");
  });

  it("사실 확인 동의가 없으면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, truth_agreed: false });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("need_truth");
  });

  it("🔴 환불 동의가 없으면 거절한다 — 돈부터 받고 다투는 경우를 막는 핵심 규칙", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, refund_agreed: false });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("need_refund");
  });

  it("이메일을 적었으면 이메일 수신 동의가 따로 필요하다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, {
      ...유효한등록,
      email: "guest@example.com",
      email_agreed: false,
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("need_email_agreed");
  });

  it("이메일을 안 적었으면 이메일 수신 동의를 묻지 않는다", async () => {
    const { token } = await 신청만들기({});
    const res = await 등록(token, { ...유효한등록, email: undefined, email_agreed: undefined });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("정식등록 성공", () => {
  it("등록 전에는 계좌가 없다가, 등록 후에만 payment 화면에서 계좌가 보인다", async () => {
    const { token, id } = await 신청만들기({ status: "신청함", registered: false });

    const before = await 마이페이지(token);
    expect(before.body.data?.screen).toBe("register");
    expect(before.raw).not.toContain("bizAccount");

    const submitted = await 등록(token, {
      ...유효한등록,
      email: "guest@example.com",
      email_agreed: true,
      depositor_name: "김대리",
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.ok).toBe(true);
    // 🔴 등록 응답 자체에도 계좌가 없다 — 화면 전환은 그다음 GET이 한다.
    expect(submitted.raw).not.toContain("bizAccount");
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect(submitted.raw).not.toContain(process.env.HANGYEOL_BANK_ACCOUNT);
    }

    const after = await 마이페이지(token);
    expect(after.body.data?.screen).toBe("payment");
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect((after.body.data as { bizAccount: { account: string } }).bizAccount.account).toBe(
        process.env.HANGYEOL_BANK_ACCOUNT,
      );
    }

    const rows = await q<{
      registered_at: Date | null;
      marital: string;
      job: string;
      email: string;
      depositor_name: string;
      truth_agreed_at: Date | null;
      refund_agreed_at: Date | null;
      email_agreed_at: Date | null;
    }>(
      `select registered_at, marital, job, email, depositor_name,
              truth_agreed_at, refund_agreed_at, email_agreed_at
         from application where id = $1`,
      [id],
    );
    const row = rows[0];
    expect(row.registered_at).not.toBeNull();
    expect(row.marital).toBe("미혼");
    expect(row.job).toBe("회사원");
    expect(row.email).toBe("guest@example.com");
    expect(row.depositor_name).toBe("김대리");
    // 🔴 「했다」가 아니라 「언제 했다」 — 세 동의 모두 시각이 남는다.
    expect(row.truth_agreed_at).not.toBeNull();
    expect(row.refund_agreed_at).not.toBeNull();
    expect(row.email_agreed_at).not.toBeNull();
  });

  it("이메일 없이 등록하면 email_agreed_at도 비어 있다", async () => {
    const { token, id } = await 신청만들기({});

    await 등록(token, 유효한등록);

    const rows = await q<{ email: string | null; email_agreed_at: Date | null }>(
      `select email, email_agreed_at from application where id = $1`,
      [id],
    );
    expect(rows[0].email).toBeNull();
    expect(rows[0].email_agreed_at).toBeNull();
  });

  it("입금완료·문항 응답 후 화면은 confirmed로 넘어간다(계좌·문항 새지 않음)", async () => {
    const { token } = await 신청만들기({ status: "입금완료", registered: false });

    const submitted = await 등록(token, 유효한등록);
    expect(submitted.status).toBe(200);

    // 입금완료 + 등록 완료 + 문항 미제출 → questions 화면이어야 한다(우선순위 7).
    const after = await 마이페이지(token);
    expect(after.body.data?.screen).toBe("questions");
    expect(after.raw).not.toContain("bizAccount");
  });
});

describe("재등록 (결정: 최신 값으로 덮어쓴다)", () => {
  it("두 번 내도 이상해지지 않는다 — 두 번째 값이 남는다", async () => {
    const { token, id } = await 신청만들기({});

    const first = await 등록(token, { ...유효한등록, job: "학생" });
    expect(first.status).toBe(200);

    const second = await 등록(token, { ...유효한등록, marital: "기혼", job: "프리랜서" });
    expect(second.status).toBe(200);

    const rows = await q<{ marital: string; job: string }>(
      `select marital, job from application where id = $1`,
      [id],
    );
    expect(rows[0].marital).toBe("기혼");
    expect(rows[0].job).toBe("프리랜서");
  });

  it("🔴 이미 입금완료된 사람의 재등록이 기한(due_at) 계산에 영향을 주지 않는다", async () => {
    const fixedDue = new Date("2026-10-01T00:00:00Z");
    const { token, id } = await 신청만들기({
      status: "입금완료",
      registered: true,
      dueAt: fixedDue,
    });

    await 등록(token, { ...유효한등록, job: "다시 낸 직업" });

    const rows = await q<{ due_at: Date | null; status: string }>(
      `select due_at, status from application where id = $1`,
      [id],
    );
    expect(rows[0].due_at?.toISOString()).toBe(fixedDue.toISOString());
    expect(rows[0].status).toBe("입금완료");
  });
});
