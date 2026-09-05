import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearPpurioToken, alimtalk } from "@/lib/alimtalk";

/**
 * 뿌리오로 **나가는 요청의 모양**을 검사한다.
 *
 * ⚠️ 대행사 계정이 아직 없다. 그래서 여기서 확인할 수 있는 것은 「우리가 규격대로
 *    만들어 보내는가」까지고, 「대행사가 그걸 받아들이는가」는 키가 나온 뒤 첫 발송
 *    한 건을 눈으로 봐야 한다. 그래도 이 검사를 두는 이유는, 규격에서 어긋나는 실수가
 *    **한 번에 스무 명분 발송을 통째로 죽이기** 때문이다.
 *
 * ⚠️ 우리 모듈을 가짜로 바꾸지 않는다. **바깥으로 나가는 `fetch`만** 세워 두고
 *    진짜 발송기를 그대로 돌린다 — 검사하려는 것이 남의 서버가 아니라 우리가 만든
 *    요청 몸통이기 때문이다.
 */

type Call = { url: string; init: RequestInit };

let calls: Call[];

function 응답(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  calls = [];
  __clearPpurioToken();
  process.env.ALIMTALK_PROVIDER = "ppurio";
  process.env.PPURIO_ACCOUNT = "hangyeol";
  process.env.PPURIO_PASSWORD = "비밀";
  process.env.PPURIO_SENDER_KEY = "발신프로필키";
  process.env.PPURIO_FROM = "01059387074";

  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/v1/token")) {
      // ⚠️ 토큰은 ASCII다. 한글을 넣으면 `Bearer <한글>`을 헤더에 못 담아 fetch가
      //    던지는데, 그건 대행사가 아니라 이 검사가 만든 문제다.
      return 응답({ token: "TOKEN-ABC", expired: "2026-09-07 00:00:00" });
    }
    return 응답({ code: 1000, description: "OK", messagekey: "PPURIO-KEY-1" });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  __clearPpurioToken();
  // 🔴 원래대로 되돌린다. 안 되돌리면 **다음 테스트 파일에서 진짜 발송이 나간다.**
  process.env.ALIMTALK_PROVIDER = "fake";
  delete process.env.PPURIO_ACCOUNT;
  delete process.env.PPURIO_PASSWORD;
  delete process.env.PPURIO_SENDER_KEY;
  delete process.env.PPURIO_FROM;
});

const 문자하나 = {
  phone: "01012345678",
  text: "[한결] 신청이 접수되었습니다\n\n▶ https://hangyeol.kr/me/abc",
  templateCode: "TPL_001",
  refkey: "11111111-2222-3333-4444-555555555555",
};

function 발송몸통(call: Call): Record<string, unknown> {
  return JSON.parse(String(call.init.body)) as Record<string, unknown>;
}

describe("통로 고르기", () => {
  it("🔴 `ppurio`인데 키가 없으면 조용히 가짜로 넘어가지 않고 터진다", () => {
    delete process.env.PPURIO_PASSWORD;
    delete process.env.PPURIO_SENDER_KEY;

    // 「진짜로 보내라」고 해놓고 아무 데도 안 나가면, 스무 명이 안내를 받은 줄 알고
    // 운영자가 기다린다. 어느 키가 없는지도 함께 말해 준다.
    expect(() => alimtalk()).toThrow(/PPURIO_PASSWORD.*PPURIO_SENDER_KEY/);
  });

  it("🔴 아무것도 안 고르면 기본값으로 진짜 발송을 하지 않는다", () => {
    delete process.env.ALIMTALK_PROVIDER;
    expect(() => alimtalk()).toThrow(/ALIMTALK_PROVIDER/);
  });

  it("키를 넣고 `ppurio`로 바꾸면 코드를 손대지 않고 진짜로 나간다", async () => {
    const r = await alimtalk().send(문자하나);

    expect(r.status).toBe("sent");
    expect(calls.some((c) => c.url.endsWith("/v3/message"))).toBe(true);
  });
});

describe("발송 요청 몸통", () => {
  it("발신 프로필 키와 발신번호는 환경변수에서 온다 — DB가 아니다", async () => {
    await alimtalk().send(문자하나);

    const body = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!);
    expect(body.from).toBe("01059387074");
    expect((body.content as { at: { senderkey: string } }).at.senderkey).toBe("발신프로필키");
  });

  it("우리 발송 기록 id가 `refkey`로 실려 나간다 — 웹훅이 그대로 돌려준다", async () => {
    await alimtalk().send(문자하나);

    const body = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!);
    expect(body.refkey).toBe(문자하나.refkey);
  });

  it("🔴 변수를 다 채운 최종 본문을 보낸다 — 대행사가 `#{}`를 채워주지 않는다", async () => {
    await alimtalk().send(문자하나);

    const at = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!).content as {
      at: { message: string; templatecode: string };
    };
    expect(at.at.message).toBe(문자하나.text);
    expect(at.at.message).not.toContain("#{");
    expect(at.at.templatecode).toBe("TPL_001");
  });

  it("🔴 템플릿에 버튼이 있으면 발송 요청에도 같은 버튼이 실린다", async () => {
    await alimtalk().send({
      ...문자하나,
      buttons: [
        { name: "신청 이어서 하기", type: "WL", url_mobile: "https://hangyeol.kr/me/abc" },
      ],
    });

    const at = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!).content as {
      at: { button?: { name: string; url_mobile: string }[] };
    };
    // 요청에 안 실으면 대행사가 받지 않는다.
    expect(at.at.button).toHaveLength(1);
    expect(at.at.button![0].url_mobile).toBe("https://hangyeol.kr/me/abc");
  });

  it("🔴 대체문자 문구가 없으면 대체 발송을 아예 걸지 않는다", async () => {
    await alimtalk().send(문자하나);

    const body = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!);
    // 걸어 두면 대행사가 본문을 90바이트로 잘라 보내고, **문장 중간에서 끊긴 문자**가
    // 손님에게 간다. 자동으로 자르느니 안 보내는 편이 낫다.
    expect(body.resend).toBeUndefined();
    expect(body.recontent).toBeUndefined();
  });

  it("대체문자 문구가 있으면 **그 문구 그대로** 실어 보낸다", async () => {
    await alimtalk().send({ ...문자하나, smsBody: "[한결] 신청 접수. hangyeol.kr/me/abc" });

    const body = 발송몸통(calls.find((c) => c.url.endsWith("/v3/message"))!);
    expect(body.resend).toEqual({ first: "sms" });
    expect(body.recontent).toEqual({
      sms: { message: "[한결] 신청 접수. hangyeol.kr/me/abc" },
    });
  });
});

describe("토큰", () => {
  it("🔴 24시간짜리라 캐시한다 — 발송마다 새로 받지 않는다", async () => {
    await alimtalk().send(문자하나);
    await alimtalk().send({ ...문자하나, refkey: "22222222-2222-3333-4444-555555555555" });

    const 토큰요청 = calls.filter((c) => c.url.endsWith("/v1/token"));
    // 스무 명에게 한 번에 보내는 중에 토큰을 매번 받으면, 발송보다 토큰 왕복이 많아진다.
    expect(토큰요청).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith("/v3/message"))).toHaveLength(2);
  });

  it("토큰은 Basic으로 받고 발송은 Bearer로 한다", async () => {
    await alimtalk().send(문자하나);

    const 토큰 = calls.find((c) => c.url.endsWith("/v1/token"))!;
    const 발송 = calls.find((c) => c.url.endsWith("/v3/message"))!;
    const h = (c: Call) => new Headers(c.init.headers as HeadersInit).get("authorization");

    expect(h(토큰)).toBe(`Basic ${Buffer.from("hangyeol:비밀").toString("base64")}`);
    expect(h(발송)).toBe("Bearer TOKEN-ABC");
  });
});

describe("접수 결과", () => {
  it("🔴 `1000`이 아니면 실패다 — 「보냈음」으로 넘기지 않는다", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).endsWith("/v1/token")) return 응답({ token: "TOKEN-ABC" });
      return 응답({ code: 4001, description: "템플릿 코드가 없습니다" });
    });

    const r = await alimtalk().send(문자하나);

    expect(r.status).toBe("failed");
    if (r.status === "failed") expect(r.error).toContain("4001");
  });

  it("대행사가 아예 안 붙어도 던지지 않고 실패로 돌려준다", async () => {
    // 🔴 여기서 던지면 신청 저장까지 실패한 것처럼 보인다.
    vi.stubGlobal("fetch", async () => {
      throw new Error("연결 거부");
    });

    const r = await alimtalk().send(문자하나);

    expect(r.status).toBe("failed");
  });
});
