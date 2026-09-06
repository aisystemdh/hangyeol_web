import { describe, expect, it } from "vitest";
import { GET as meGET } from "@/app/api/me/[token]/route";
import { POST as answersPOST } from "@/app/api/me/[token]/answers/route";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import {
  PAIRED_INDEXES,
  PRE_QUESTION_FORM,
  PRE_QUESTION_FORM_VERSION,
  QUESTIONS,
} from "@/lib/form9-copy";
import type { MeApiResponse } from "@/lib/me-response";
import { callRoute, q } from "./helpers";

/**
 * 사전질문 제출 `POST /api/me/[token]/answers` (이슈 #36).
 *
 * 🔴 여기서 제일 무서운 사고는 계산 실수가 아니라 문항이 **입금 전에 저장 경로로도
 *    새는 것**이다(`CLAUDE.md` "테스트" — 문항 방어의 실체는 토큰이 아니라
 *    「입금완료」). 그래서 성공 경로뿐 아니라 "입금 전에 억지로 이 주소를 불러도
 *    저장되지 않는다"를 DB까지 확인한다.
 */

type MeBody = MeApiResponse & { data?: Record<string, unknown> & { screen: string } };
type AnswersBody = { ok: boolean; error?: string; message?: string; data?: { submittedAt: string } };

let 카운터 = 0;

async function 마이페이지(token: string) {
  return callRoute<MeBody, { token: string }>(meGET, { params: { token } });
}

async function 답변제출(token: string, answers: unknown) {
  return callRoute<AnswersBody, { token: string }>(answersPOST, {
    method: "POST",
    body: { answers },
    params: { token },
  });
}

/** 그 사람의 신청 하나를 원하는 상태로 직접 만든다 (`tests/me.test.ts`와 같은 패턴). */
async function 신청만들기(opts: {
  status?: "신청함" | "입금완료" | "취소됨";
  gender?: "M" | "F";
  registered?: boolean;
}): Promise<{ token: string; id: string }> {
  카운터 += 1;
  const token = newToken();
  const status = opts.status ?? "입금완료";
  const gender = opts.gender ?? "M";

  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1998-01-01') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, registered_at, paid_at)
     select id, $4, $5, $6, now(), $7, $8 from 사람
     returning id`,
    [
      `답변사람${카운터}`,
      `010${String(30000000 + 카운터).padStart(8, "0")}`,
      gender,
      EVENT.id,
      status,
      token,
      opts.registered ?? true ? new Date() : null,
      status === "입금완료" ? new Date() : null,
    ],
  );

  return { token, id: rows[0].id };
}

/** 문항 정의(`QUESTIONS`)에서 모든 문항의 첫 번째 선택지를 골라 유효한 답을 만든다. */
function 유효한답변(): Record<string, number | [number, number]> {
  const out: Record<string, number | [number, number]> = {};
  for (const q of QUESTIONS) {
    if (q.paired) {
      out[q.code] = [q.paired[0].choices[0].n, q.paired[1].choices[0].n];
    } else {
      out[q.code] = (q.choices ?? [])[0].n;
    }
  }
  return out;
}

describe("없는 토큰", () => {
  it("조용히 실패하지 않고 404로 분명히 거절한다", async () => {
    const res = await 답변제출("이런-토큰은-발급된-적이-없다", 유효한답변());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });
});

describe("🔴 문항 방어의 실체는 「입금완료」다", () => {
  it("입금 전(신청함)이면 저장 경로로 직접 때려도 403이고 아무것도 저장되지 않는다", async () => {
    const { token, id } = await 신청만들기({ status: "신청함" });

    const res = await 답변제출(token, 유효한답변());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_paid");
    const rows = await q(`select 1 from answer where application_id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it("취소된 신청도 저장 경로로 직접 때려도 403이고 아무것도 저장되지 않는다", async () => {
    const { token, id } = await 신청만들기({ status: "취소됨" });

    const res = await 답변제출(token, 유효한답변());

    expect(res.status).toBe(403);
    const rows = await q(`select 1 from answer where application_id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });
});

describe("입력 검증", () => {
  it("문항 하나가 빠지면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const partial = 유효한답변();
    delete partial[QUESTIONS[0].code];

    const res = await 답변제출(token, partial);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_answers");
  });

  it("문항에 없는 선택지 번호를 고르면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const bad = 유효한답변();
    bad[QUESTIONS[0].code] = 99;

    const res = await 답변제출(token, bad);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_answers");
  });

  it("페어드 문항(4·6번)에 단일 값만 오면 거절한다", async () => {
    const { token } = await 신청만들기({});
    const bad = 유효한답변();
    const pairedCode = QUESTIONS[PAIRED_INDEXES[0]].code;
    bad[pairedCode] = 1 as unknown as [number, number];

    const res = await 답변제출(token, bad);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_answers");
  });

  it("답 전체가 object가 아니면 거절한다", async () => {
    const { token } = await 신청만들기({});

    const res = await 답변제출(token, [1, 2, 3]);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_answers");
  });
});

describe("제출 성공", () => {
  it("입금완료 상태면 저장되고, 문항 버전이 함께 남는다", async () => {
    const { token, id } = await 신청만들기({ status: "입금완료" });

    const res = await 답변제출(token, 유효한답변());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // 🔴 제출 응답 자체에도 문항 전문이 없다 — "저장됐다"는 사실만 알린다.
    expect(res.raw).not.toContain("연휴 사흘");

    const rows = await q<{ form: string; round: number | null; form_version: string; a: unknown }>(
      `select form, round, form_version, a from answer where application_id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].form).toBe(PRE_QUESTION_FORM);
    expect(rows[0].round).toBeNull();
    expect(rows[0].form_version).toBe(PRE_QUESTION_FORM_VERSION);
    expect(rows[0].a).toEqual(유효한답변());
  });

  it("제출 뒤 마이페이지 화면이 confirmed로 넘어간다 — 문항이 다시 새지 않는다", async () => {
    const { token } = await 신청만들기({ status: "입금완료" });

    const before = await 마이페이지(token);
    expect(before.body.data?.screen).toBe("questions");

    await 답변제출(token, 유효한답변());

    const after = await 마이페이지(token);
    expect(after.body.data?.screen).toBe("confirmed");
    expect(after.raw).not.toContain("questions");
  });

  it("🔴 새로고침으로 두 번 내도 하나만 저장된다 — 두 번째 값으로 덮어쓴다", async () => {
    const { token, id } = await 신청만들기({ status: "입금완료" });
    const 답1 = 유효한답변();

    const first = await 답변제출(token, 답1);
    expect(first.status).toBe(200);

    // 같은 문항 배열에서 답을 다르게 골라 "덮어써졌다"를 값으로 확인한다.
    const 답2 = 유효한답변();
    const singleCodes = QUESTIONS.filter((q) => !q.paired);
    const 바꿀문항 = singleCodes[0];
    const 다른선택지 = (바꿀문항.choices ?? []).find((c) => c.n !== 답1[바꿀문항.code]);
    if (다른선택지) 답2[바꿀문항.code] = 다른선택지.n;

    const second = await 답변제출(token, 답2);
    expect(second.status).toBe(200);

    const rows = await q<{ a: unknown }>(`select a from answer where application_id = $1`, [id]);
    expect(rows).toHaveLength(1); // 부분 UNIQUE + upsert — 두 번째 제출도 행이 하나뿐이다.
    expect(rows[0].a).toEqual(답2);
  });
});
