import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { GET as recruitGET } from "@/app/api/recruit/route";
import { alimtalk, fakeOutbox } from "@/lib/alimtalk";
import { afterResponse, settleAfterResponse } from "@/lib/after";
import { POST as adminLoginPOST } from "@/app/api/admin/login/route";
import { isAdmin, newToken } from "@/lib/admin";
import { ageOn } from "@/lib/age";
import { EVENT } from "@/lib/event";
import { at, callRoute, q, setCookies } from "./helpers";
import { sameDatabase, testDatabaseUrl } from "./setup/env";

/**
 * 검증 자리 자체가 도는지 보는 테스트.
 *
 * 이 파일은 기능을 검사하지 않는다. **틀이 실제로 돈다**는 것만 보인다 —
 * 라우트를 함수로 부를 수 있는지, 진짜 DB가 붙었는지, 알림톡이 밖으로 안 나가는지,
 * 시각을 흉내 낼 수 있는지, 앞 테스트의 데이터가 안 남는지.
 *
 * ⚠️ #30에서 옛 표와 옛 라우트가 통째로 사라져 여기 있던 두 검사가 부를 주소를 잃었다
 *    (동적 주소는 `/api/pre/[token]`을, 운영자 세션은 `/api/admin/applicants`를 썼다).
 *    둘 다 **이 파일 안의 탐침 라우트**로 옮겼다 — 검사하려는 것이 애초에 그 기능이
 *    아니라 **헬퍼의 배선**(동적 구간 타입 · 쿠키가 `next/headers`까지 닿는지)이기
 *    때문이다. 진짜 운영자 API가 서는 #34에서 그쪽을 직접 부르는 검사가 따로 생긴다.
 */

/** 그 테스트가 쓸 사람 한 명 + 그 사람의 신청 하나. */
async function 신청(p: {
  name: string;
  phone: string;
  gender: "M" | "F";
  status?: "신청함" | "입금완료" | "취소됨";
}) {
  await q(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1998-10-24')
       returning id
     )
     insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
     select id, $4, $5, $6, now() from 사람`,
    [p.name, p.phone, p.gender, EVENT.id, p.status ?? "신청함", newToken()],
  );
}

/**
 * 로그인해야 열리는 **탐침 라우트**. 어떤 기능도 아니고, 헬퍼가 ① 동적 구간을
 * Next와 같은 모양으로 넘기는지 ② 쿠키를 `next/headers`까지 흘려보내는지만 본다.
 *
 * 🔴 ②가 깨지면 운영자 API는 **무엇을 보내도 401**이 된다(`isAdmin()`이 요청 문맥
 *    밖에서 던지는 예외를 삼켜 `false`를 준다). 그러면 「로그인 안 하면 막힌다」가
 *    엉뚱한 이유로 통과하고, 정작 신원이 다 보이는 응답은 한 번도 열어보지 못한다.
 */
async function 자물쇠라우트(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const { token } = await ctx.params;
  return NextResponse.json({ ok: true, token });
}

describe("주소를 함수로 부르기", () => {
  it("서버를 띄우지 않고 라우트를 불러 응답을 받는다", async () => {
    const res = await callRoute<{ phase: string; message: string }>(recruitGET);

    expect(res.status).toBe(200);
    // 아무도 입금하지 않았으므로 숫자를 감춘다 — 절반 미만은 침묵이 원칙이다.
    expect(res.body.phase).toBe("hidden");
  });

  it("진짜 DB에 넣은 것이 응답에 그대로 반영된다", async () => {
    for (let i = 0; i < 5; i += 1) {
      await 신청({ name: `남${i}`, phone: `0101000000${i}`, gender: "M", status: "입금완료" });
      await 신청({ name: `여${i}`, phone: `0102000000${i}`, gender: "F", status: "입금완료" });
    }

    const res = await callRoute<{ phase: string; remaining?: Record<string, number> }>(recruitGET);

    expect(res.body.phase).toBe("counting");
    expect(res.body.remaining).toEqual({ M: 5, F: 5 });
  });

  it("앞 테스트가 넣은 데이터가 남아 있지 않다", async () => {
    // 바로 위 테스트가 열 명을 넣었다. 순서에 기대지 않으려면 이 값이 0이어야 한다.
    const rows = await q<{ n: string }>("select count(*)::text as n from applicant");
    expect(rows[0].n).toBe("0");
  });

  it("회차 행은 비우지 않는다 — 비우면 모든 신청이 외래키에서 막힌다", async () => {
    const rows = await q<{ n: string }>("select count(*)::text as n from event");
    expect(rows[0].n).toBe("1");
  });

  it("동적 주소도 부를 수 있다 — `params`를 Next처럼 Promise로 넘긴다", async () => {
    // 🔴 이 테스트의 절반은 타입 검사다. 헬퍼가 `params`를 `Record<string,string>`로
    //    고정해 두면 `{ token: string }`을 받는 핸들러는 **넘기는 순간 타입이 깨진다** —
    //    동적 주소야말로 이 헬퍼를 만든 이유인데 그쪽만 못 부르게 된다.
    const 로그인 = await callRoute(adminLoginPOST, {
      method: "POST",
      body: { password: process.env.ADMIN_PASSWORD },
    });
    const res = await callRoute<{ ok: boolean; token: string }, { token: string }>(
      자물쇠라우트,
      { params: { token: "토큰1234" }, cookies: { hg_admin: setCookies(로그인).hg_admin } },
    );

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("토큰1234");
  });

  it("응답 원문으로 「없어야 할 것」을 확인할 수 있다", async () => {
    await 신청({ name: "홍길동", phone: "01098765432", gender: "M", status: "입금완료" });

    const res = await callRoute(recruitGET);

    // 🔴 새는 것을 잡는 방식이 이것이다. 필드 이름을 몰라도 원문에 문자열이 남는다.
    expect(res.raw).not.toContain("01098765432");
    expect(res.raw).not.toContain("홍길동");
  });
});

describe("공개 모집 현황", () => {
  /**
   * 🔴 **워터마크 폐기가 실제로 반영됐는지를 보는 자리다.** 옛 구조는 「한 번 올라간
   *    숫자는 안 내려가는」 값으로 잔여석을 계산해 입금완료 3명인데 「2자리 남음」이
   *    뜰 수 있었다 — 표시광고법 §3①이 금지하는 쪽이다.
   */
  it("신청만으로는 자리가 차지 않는다 — 입금완료만 센다", async () => {
    // 열두 명이 신청했지만 아무도 입금하지 않았다.
    for (let i = 0; i < 12; i += 1) {
      await 신청({ name: `신청${i}`, phone: `010300000${String(i).padStart(2, "0")}`, gender: "M" });
    }

    const res = await callRoute<{ phase: string }>(recruitGET);

    // 자리가 하나도 안 찼으므로 여전히 절반 미만 — 숫자를 감춘다.
    expect(res.body.phase).toBe("hidden");
  });

  it("취소된 신청과 아직 입금 안 한 신청은 자리를 붙들지 않는다", async () => {
    for (let i = 0; i < 8; i += 1) {
      await 신청({ name: `남${i}`, phone: `0104000000${i}`, gender: "M", status: "입금완료" });
    }
    for (let i = 0; i < 2; i += 1) {
      await 신청({ name: `여${i}`, phone: `0104100000${i}`, gender: "F", status: "입금완료" });
    }
    // 🔴 여기가 옛 구조와 갈리는 곳이다. 워터마크는 한 번 올라가면 안 내려갔으므로
    //    이 셋도 자리를 먹은 것처럼 보였다. 이제 숫자가 실제로 되돌아온다.
    await 신청({ name: "취소자", phone: "01042222222", gender: "M", status: "취소됨" });
    await 신청({ name: "미입금1", phone: "01043333333", gender: "M" });
    await 신청({ name: "미입금2", phone: "01044444444", gender: "F" });

    const res = await callRoute<{ phase: string; remaining?: Record<string, number> }>(recruitGET);

    expect(res.body.phase).toBe("counting");
    expect(res.body.remaining).toEqual({ M: 2, F: 8 });
  });

  it("성별로 따로 센다 — 한쪽이 마감돼도 전체 마감이 아니다", async () => {
    for (let i = 0; i < 10; i += 1) {
      await 신청({ name: `남${i}`, phone: `0105000000${i}`, gender: "M", status: "입금완료" });
    }

    const res = await callRoute<{ phase: string; message: string }>(recruitGET);

    expect(res.body.phase).toBe("counting");
    expect(res.body.message).toContain("남성 마감");
    expect(res.body.message).toContain("여성 10자리");
  });

  it("스무 자리가 다 차면 마감이라고만 말한다 — 대기 신청을 권하지 않는다", async () => {
    for (let i = 0; i < 10; i += 1) {
      await 신청({ name: `남${i}`, phone: `0106000000${i}`, gender: "M", status: "입금완료" });
      await 신청({ name: `여${i}`, phone: `0107000000${i}`, gender: "F", status: "입금완료" });
    }

    const res = await callRoute<{ phase: string; message: string }>(recruitGET);

    expect(res.body.phase).toBe("closed");
    // 🔴 대기 안내는 알림톡이 개인에게 한다. 공개 화면에서 미리 약속하면 신청도 하지
    //    않은 사람이 「등록해 뒀다」고 믿고 연락을 기다린다.
    expect(res.raw).not.toContain("대기");
    expect(res.raw).not.toContain("자리가 나면");
  });

  it("이 응답만 `{ok, data}` 봉투를 씌우지 않는다", async () => {
    const res = await callRoute<Record<string, unknown>>(recruitGET);

    // 🔴 `RecruitStatus.tsx`는 최상위에서 `phase`·`message`를 읽고 없으면 **에러 없이
    //    아무것도 안 그린다.** 봉투를 씌우는 순간 홈의 「모집 현황」 줄이 조용히
    //    사라지고, 아무 데서도 실패로 보이지 않아 한참 뒤에야 발견된다.
    expect(res.body).not.toHaveProperty("ok");
    expect(res.body).not.toHaveProperty("data");
    expect(res.body).toHaveProperty("phase");
    expect(res.body).toHaveProperty("message");
  });

  it("현황을 못 읽어도 홈이 죽지 않고 아무 숫자도 말하지 않는다", async () => {
    // 진짜 실패를 만든다 — 표 이름을 잠깐 바꿔 질의가 실제로 터지게 한다.
    // (가짜로 바꿔치지 않는 이유: 라우트가 무엇을 부르는지에 테스트를 묶고 싶지 않다.)
    await q(`alter table application rename to application_숨김`);
    try {
      const res = await callRoute<{ phase: string; message: string }>(recruitGET);

      // 🔴 틀린 숫자보다 침묵이 낫다. 500을 내면 홈의 이 줄만이 아니라 화면 전체가
      //    깨진 것처럼 보인다 — 200에 빈 문구를 주고 줄을 안 그리는 쪽으로 간다.
      expect(res.status).toBe(200);
      expect(res.body.phase).toBe("unknown");
      expect(res.body.message).toBe("");
    } finally {
      await q(`alter table application_숨김 rename to application`);
    }
  });
});

describe("알림톡 가짜 발송기", () => {
  it("밖으로 보내지 않고 무엇을 누구에게 보냈는지만 기록한다", async () => {
    const result = await alimtalk().send({
      phone: "01012345678",
      text: "입금 안내 — 39,000원",
      templateCode: "T2",
    });

    expect(result.status).toBe("sent");
    expect(fakeOutbox()).toHaveLength(1);
    expect(fakeOutbox()[0]).toMatchObject({
      phone: "01012345678",
      text: "입금 안내 — 39,000원",
      templateCode: "T2",
    });
  });

  it("앞 테스트가 보낸 것이 남아 있지 않다", () => {
    expect(fakeOutbox()).toHaveLength(0);
  });
});

describe("응답 뒤에 하는 일", () => {
  it("요청 문맥이 없어도 돌고, 끝날 때까지 기다릴 수 있다", async () => {
    // 🔴 `after()`를 직접 쓴 라우트는 함수로 부르는 순간 던진다. 그래서 감싼다.
    afterResponse(() => alimtalk().send({ phone: "01011112222", text: "뒷일" }));

    await settleAfterResponse();
    expect(fakeOutbox()).toHaveLength(1);
  });

  it("뒷일이 실패해도 앞일을 죽이지 않는다", async () => {
    afterResponse(async () => {
      throw new Error("대행사가 답을 안 한다");
    });

    await expect(settleAfterResponse()).resolves.toBeUndefined();
  });

  it("뒷일이 **그 자리에서** 던져도 앞일을 죽이지 않는다", () => {
    // 🔴 이게 진짜 위험한 쪽이다. `alimtalk()`은 통로를 안 고르면 비동기가 아니라
    //    **부르는 그 순간** 던진다. 그런 throw는 `.catch()`로 안 잡히므로,
    //    환경변수 하나 빠진 배포에서 라우트가 통째로 500이 된다.
    expect(() =>
      afterResponse(() => {
        throw new Error("통로를 안 골랐다");
      }),
    ).not.toThrow();
  });

  it("느린 뒷일도 끝날 때까지 기다린다", async () => {
    afterResponse(async () => {
      await new Promise((r) => setTimeout(r, 80));
      await alimtalk().send({ phone: "01033334444", text: "늦게 도착한 뒷일" });
    });

    // 아직 도착하지 않았다 — 뒷일은 응답을 막지 않는다는 뜻이다.
    expect(fakeOutbox()).toHaveLength(0);

    // 🔴 준비 단계(`beforeEach`)가 표를 비우기 **전에** 이걸 부른다. 안 부르면 늦게
    //    도착한 발송·저장이 다음 테스트 한가운데에 나타나, 순서에 상관없이 돌게
    //    하려고 표를 비운 노력이 통째로 무너진다.
    await settleAfterResponse();
    expect(fakeOutbox()).toHaveLength(1);
  });
});

describe("운영자 세션", () => {
  it("쿠키 없이 부르면 막히고, 로그인 쿠키를 태우면 열린다", async () => {
    const { POST: adminLoginPOST } = await import("@/app/api/admin/login/route");

    const 막힘 = await callRoute<{ ok: boolean }, { token: string }>(자물쇠라우트, {
      params: { token: "토큰1234" },
    });
    expect(막힘.status).toBe(401);

    const 로그인 = await callRoute<{ ok: boolean }>(adminLoginPOST, {
      method: "POST",
      body: { password: process.env.ADMIN_PASSWORD },
    });
    expect(로그인.status).toBe(200);

    const 세션 = setCookies(로그인).hg_admin;
    expect(세션).toBeTruthy();

    const 열림 = await callRoute<{ ok: boolean }, { token: string }>(자물쇠라우트, {
      params: { token: "토큰1234" },
      cookies: { hg_admin: 세션 },
    });
    expect(열림.status).toBe(200);
    expect(열림.body.ok).toBe(true);
  });

  it("틀린 비밀번호로는 세션이 나오지 않는다", async () => {
    const { POST: adminLoginPOST } = await import("@/app/api/admin/login/route");

    const res = await callRoute(adminLoginPOST, {
      method: "POST",
      body: { password: "틀린비밀번호" },
    });

    expect(res.status).toBe(401);
    expect(setCookies(res).hg_admin).toBeUndefined();
  });
});

describe("시각 흉내 내기", () => {
  it("앱 코드가 보는 「지금」을 바꾼다", async () => {
    // 생일이 10월 24일인 사람. 하루 차이로 만 나이가 갈린다.
    // (`ageOn`은 UTC로 센다. 그래서 기준 시각도 UTC로 적는다.)
    const 생일전 = await at("2026-10-23T12:00:00Z", () => ageOn("1998-10-24"));
    const 생일당일 = await at("2026-10-24T12:00:00Z", () => ageOn("1998-10-24"));

    expect(생일전).toBe(27);
    expect(생일당일).toBe(28);
  });

  it("흉내가 끝나면 진짜 시각으로 돌아온다", async () => {
    // 얼어붙은 채로 남으면 다음 테스트가 통째로 엉뚱한 시각을 본다.
    expect(new Date().toISOString()).not.toBe("2026-10-24T12:00:00.000Z");
    const 처음 = Date.now();
    await new Promise((r) => setTimeout(r, 20));
    expect(Date.now()).toBeGreaterThan(처음);
  });
});

describe("실제 데이터 보호", () => {
  it("테스트는 운영 DB가 아니라 테스트 DB에 붙어 있다", () => {
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  });

  it("풀러 주소와 직결 주소를 같은 데이터베이스로 본다", () => {
    // 🔴 Neon은 같은 데이터베이스에 주소를 두 개 준다(호스트에 `-pooler`가 붙은 것과
    //    안 붙은 것). 호스트를 그대로 비교하면 **같은 곳인데 다르다고** 판정하고,
    //    그 상태로 테스트가 돌면 진짜 신청자 명단이 매 실행마다 지워진다.
    const 풀러 = "postgresql://u:p@ep-abc-pooler.aws.neon.tech/neondb?sslmode=require";
    const 직결 = "postgresql://u:p@ep-abc.aws.neon.tech/neondb";
    const 다른DB = "postgresql://u:p@ep-abc.aws.neon.tech/hangyeol_test";

    expect(sameDatabase(풀러, 직결)).toBe(true);
    expect(sameDatabase(풀러, 다른DB)).toBe(false);
  });

  it("운영 DB와 같은 곳을 가리키면 시작하지 않는다", () => {
    const 테스트주소 = process.env.TEST_DATABASE_URL as string;
    expect(() => testDatabaseUrl(테스트주소)).toThrow(/같은 데이터베이스/);
  });

  it("밖으로 나가는 메일 알림 주소가 꺼져 있다", () => {
    // `.env.local`을 통째로 올리므로 이 값이 살아 있으면 진짜 메일이 날아간다.
    expect(process.env.APPLY_NOTIFY_ENDPOINT).toBeUndefined();
  });
});
