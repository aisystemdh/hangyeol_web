import { describe, expect, it } from "vitest";
import { GET as recruitGET } from "@/app/api/recruit/route";
import { alimtalk, fakeOutbox } from "@/lib/alimtalk";
import { afterResponse, settleAfterResponse } from "@/lib/after";
import { ageOn } from "@/lib/age";
import { at, callRoute, q, setCookies } from "./helpers";
import { sameDatabase, testDatabaseUrl } from "./setup/env";
import { GET as preGET } from "@/app/api/pre/[token]/route";
import { POST as adminLoginPOST } from "@/app/api/admin/login/route";
import { GET as adminApplicantsGET } from "@/app/api/admin/applicants/route";

/**
 * 검증 자리 자체가 도는지 보는 테스트.
 *
 * 이 파일은 기능을 검사하지 않는다. **틀이 실제로 돈다**는 것만 보인다 —
 * 라우트를 함수로 부를 수 있는지, 진짜 DB가 붙었는지, 알림톡이 밖으로 안 나가는지,
 * 시각을 흉내 낼 수 있는지, 앞 테스트의 데이터가 안 남는지.
 *
 * 🟡 지금 부르는 `/api/recruit`은 #30에서 다시 쓰인다. 그때 이 파일의 기대값도 함께
 *    바뀐다 — 여기서 검사하는 것은 모집 현황의 규칙이 아니라 **틀**이다.
 */

/** 그 테스트가 쓸 신청자 한 명. 표가 #30에서 바뀌므로 공용 헬퍼로 빼지 않았다. */
async function 신청자(p: { name: string; phone: string; gender: "M" | "F"; status?: string }) {
  await q(
    `insert into applicant (name, phone, gender, birth, status, privacy_agreed_at)
     values ($1, $2, $3, '1998-10-24', $4, now())`,
    [p.name, p.phone, p.gender, p.status ?? "pre_registered"],
  );
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
      await 신청자({ name: `남${i}`, phone: `0101000000${i}`, gender: "M", status: "confirmed" });
      await 신청자({ name: `여${i}`, phone: `0102000000${i}`, gender: "F", status: "confirmed" });
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

  it("동적 주소도 부를 수 있다 — `params`를 Next처럼 Promise로 넘긴다", async () => {
    // 🔴 이 테스트의 절반은 타입 검사다. 헬퍼가 `params`를 `Record<string,string>`로
    //    고정해 두면 `{ token: string }`을 받는 핸들러는 **넘기는 순간 타입이 깨진다** —
    //    동적 주소야말로 이 헬퍼를 만든 이유인데 그쪽만 못 부르게 된다.
    const res = await callRoute<{ ok: boolean }, { token: string }>(preGET, {
      params: { token: "존재하지않는토큰1234" },
    });

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it("응답 원문으로 「없어야 할 것」을 확인할 수 있다", async () => {
    await 신청자({ name: "홍길동", phone: "01098765432", gender: "M", status: "confirmed" });

    const res = await callRoute(recruitGET);

    // 🔴 새는 것을 잡는 방식이 이것이다. 필드 이름을 몰라도 원문에 문자열이 남는다.
    expect(res.raw).not.toContain("01098765432");
    expect(res.raw).not.toContain("홍길동");
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
    // 🔴 여기가 열리지 않으면 운영자 API는 **무엇을 보내도 401**이라
    //    「로그인 안 하면 막힌다」가 엉뚱한 이유로 통과하고, 정작 신원이 다 보이는
    //    응답은 한 번도 열어보지 못한 채 끝난다.
    const 막힘 = await callRoute<{ ok: boolean }>(adminApplicantsGET);
    expect(막힘.status).toBe(401);

    const 로그인 = await callRoute<{ ok: boolean }>(adminLoginPOST, {
      method: "POST",
      body: { password: process.env.ADMIN_PASSWORD },
    });
    expect(로그인.status).toBe(200);

    const 세션 = setCookies(로그인).hg_admin;
    expect(세션).toBeTruthy();

    const 열림 = await callRoute<{ ok: boolean }>(adminApplicantsGET, {
      cookies: { hg_admin: 세션 },
    });
    expect(열림.status).toBe(200);
    expect(열림.body.ok).toBe(true);
  });

  it("틀린 비밀번호로는 세션이 나오지 않는다", async () => {
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
