import { describe, expect, it } from "vitest";
import { GET as meGET } from "@/app/api/me/[token]/route";
import { newToken } from "@/lib/admin";
import { formatDeadline } from "@/lib/deadline";
import { EVENT, EVENT_SCHEMA } from "@/lib/event";
import { PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION } from "@/lib/form9-copy";
import type { MeApiResponse } from "@/lib/me-response";
import { at, callRoute, q } from "./helpers";

/**
 * 마이페이지(`/me/[token]`) 화면 판정과 정보 노출 경계 (이슈 #32).
 *
 * 🔴 여기서 제일 무서운 사고는 계산 실수가 아니라 계좌·문항이 **새는 것**이다
 *    (`CLAUDE.md` "테스트"). 그래서 `res.body`로 있어야 할 화면을 확인하는 것과
 *    나란히, `res.raw`로 그 화면에 있으면 안 되는 값이 없는지도 함께 본다.
 */

type Data = Record<string, unknown> & { screen: string };
type Body = MeApiResponse & { data?: Data };

let 카운터 = 0;

async function 마이페이지(token: string) {
  return callRoute<Body, { token: string }>(meGET, { params: { token } });
}

/** 그 사람의 신청 하나를 원하는 상태로 직접 만든다. */
async function 신청만들기(opts: {
  status?: "신청함" | "입금완료" | "취소됨";
  gender?: "M" | "F";
  registered?: boolean;
  viewOverride?: string | null;
  dueAt?: Date | null;
  answered?: boolean;
}): Promise<{ token: string }> {
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
       (applicant_id, event_id, status, token, privacy_agreed_at,
        registered_at, due_at, view_override, paid_at)
     select id, $4, $5, $6, now(), $7, $8, $9, $10 from 사람
     returning id`,
    [
      `사람${카운터}`,
      `010${String(10000000 + 카운터).padStart(8, "0")}`,
      gender,
      EVENT.id,
      status,
      token,
      opts.registered ? new Date() : null,
      opts.dueAt ?? null,
      opts.viewOverride ?? null,
      status === "입금완료" ? new Date() : null,
    ],
  );

  if (opts.answered) {
    await q(
      `insert into answer (application_id, form, form_version, a)
       values ($1, $2, $3, '{}'::jsonb)`,
      [rows[0].id, PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION],
    );
  }

  return { token };
}

/** 자리를 실제로 채운다 — 자리는 「입금완료」로만 찬다(`apply.test.ts`와 같은 헬퍼). */
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

describe("없는 토큰", () => {
  it("조용히 실패하지 않고 404로 분명히 거절한다", async () => {
    const res = await 마이페이지("이런-토큰은-발급된-적이-없다");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect((res.body as { error: string }).error).toBe("not_found");
  });
});

describe("화면 판정 순서", () => {
  it("취소됨이 다른 모든 것보다 이긴다", async () => {
    const { token } = await 신청만들기({ status: "취소됨", registered: true, answered: true });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("cancelled");
    // 🔴 취소된 사람의 응답에 계좌도 문항도 없다.
    expect(res.raw).not.toContain("bizAccount");
    expect(res.raw).not.toContain("questions");
  });

  it("행사가 끝난 뒤에는 등록·입금 여부와 무관하게 종료 화면이다", async () => {
    const { token } = await 신청만들기({ status: "신청함" });

    const res = await at(EVENT_SCHEMA.endISO, () => 마이페이지(token));

    expect(res.body.data?.screen).toBe("ended");
  });

  it("행사 당일에는 사전질문을 안 낸 입금완료자도 당일 안내를 받는다", async () => {
    // 🔴 두 조건(당일 · 사전질문 미제출)에 동시에 걸리는 사람 — AC가 이름을 짚어 요구한다.
    const { token } = await 신청만들기({ status: "입금완료", registered: true, answered: false });

    const res = await at(`${EVENT.dateISO}T10:00:00+09:00`, () => 마이페이지(token));

    expect(res.body.data?.screen).toBe("eventDay");
    expect(res.raw).not.toContain("questions");
  });

  it("자기 성별 자리가 다 찼으면 등록을 마쳤어도 대기 화면이다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);
    const { token } = await 신청만들기({ status: "신청함", gender: "M", registered: true });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("waitlisted");
  });

  it("🔴 입금완료면 자리를 가진 것이라 대기자일 수 없다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);
    const { token } = await 신청만들기({
      status: "입금완료",
      gender: "M",
      registered: true,
      answered: true,
    });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("confirmed");
  });

  it("정식등록 전이면 등록 화면 — 계좌가 없다", async () => {
    const { token } = await 신청만들기({ status: "신청함", registered: false });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("register");
    expect(res.body.data?.bizIdentity).toBeTruthy();
    // 🔴 정식등록 전 응답에 계좌가 없다.
    expect(res.raw).not.toContain("bizAccount");
    expect(res.raw).not.toContain("questions");
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect(res.raw).not.toContain(process.env.HANGYEOL_BANK_ACCOUNT);
    }
  });

  it("등록은 했지만 입금 전이면 계좌 화면 — 문항이 없다", async () => {
    const due = new Date("2026-10-04T03:00:00Z");
    const { token } = await 신청만들기({ status: "신청함", registered: true, dueAt: due });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("payment");
    expect(res.body.data?.dueAtLabel).toBe(formatDeadline(due));
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect((res.body.data as { bizAccount: { account: string } }).bizAccount.account).toBe(
        process.env.HANGYEOL_BANK_ACCOUNT,
      );
    }
    // 🔴 입금완료가 아닌 응답에 문항이 없다 — 문항의 특징적인 장면 문구도 새지 않는다.
    expect(res.raw).not.toContain("questions");
    expect(res.raw).not.toContain("연휴 사흘");
  });

  it("입금완료인데 사전질문을 안 냈으면 문항 화면 — 계좌가 없다", async () => {
    const { token } = await 신청만들기({ status: "입금완료", registered: true, answered: false });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("questions");
    expect((res.body.data as { questions: unknown[] }).questions).toHaveLength(10);
    expect((res.body.data as { pairedIndexes: unknown[] }).pairedIndexes.length).toBeGreaterThan(0);
    expect(res.raw).not.toContain("bizAccount");
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect(res.raw).not.toContain(process.env.HANGYEOL_BANK_ACCOUNT);
    }
  });

  it("정식등록·입금·사전질문을 다 마치면 확정 화면 — 계좌도 문항도 없다", async () => {
    const { token } = await 신청만들기({ status: "입금완료", registered: true, answered: true });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("confirmed");
    expect(res.raw).not.toContain("bizAccount");
    expect(res.raw).not.toContain("questions");
  });
});

describe("운영자 화면 고정 (view_override, 결정 13)", () => {
  it("고정된 화면이 순서를 무시한다", async () => {
    const { token } = await 신청만들기({ status: "취소됨", viewOverride: "confirmed" });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("confirmed");
  });

  it("모르는 값은 무시하고 자동 판정으로 돌아간다", async () => {
    const { token } = await 신청만들기({ status: "신청함", viewOverride: "이런화면은없다" });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("register");
  });

  it("🔴 취소된 사람은 정식등록했던 이력이 있어도 문항 고정이 계좌로 새지 않는다", async () => {
    // 함정: registered=true인 취소된 사람을 "questions"로 고정하면, "입금완료가
    // 아니니 questions는 못 보여준다"는 규칙만 보고 "payment"로 떨어뜨리기 쉽다 —
    // 그러면 취소된 사람에게 계좌가 보인다. 취소가 그 아래 모든 규칙보다 위여야 한다.
    const { token } = await 신청만들기({
      status: "취소됨",
      registered: true,
      viewOverride: "questions",
    });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("cancelled");
    expect(res.raw).not.toContain("bizAccount");
    expect(res.raw).not.toContain("questions");
  });

  it("🔴 고정값이 입금 전 사람을 문항 화면으로 보내려 해도 문항은 새지 않는다", async () => {
    const { token } = await 신청만들기({
      status: "신청함",
      registered: true,
      viewOverride: "questions",
    });

    const res = await 마이페이지(token);

    // 아직 입금 전이라는 사실이 화면 이름 지정보다 우선한다.
    expect(res.body.data?.screen).toBe("payment");
    expect(res.raw).not.toContain("questions");
  });

  it("🔴 고정값이 정식등록 전 사람을 입금 화면으로 보내려 해도 계좌는 새지 않는다", async () => {
    const { token } = await 신청만들기({
      status: "신청함",
      registered: false,
      viewOverride: "payment",
    });

    const res = await 마이페이지(token);

    expect(res.body.data?.screen).toBe("register");
    expect(res.raw).not.toContain("bizAccount");
    if (process.env.HANGYEOL_BANK_ACCOUNT) {
      expect(res.raw).not.toContain(process.env.HANGYEOL_BANK_ACCOUNT);
    }
  });
});
