import { describe, expect, it } from "vitest";
import { POST as applyPOST } from "@/app/api/apply/route";
import { POST as resultPOST } from "@/app/api/alimtalk/result/route";
import { fakeOutbox } from "@/lib/alimtalk";
import { settleAfterResponse } from "@/lib/after";
import { newToken } from "@/lib/admin";
import { formatDeadline } from "@/lib/deadline";
import { EVENT } from "@/lib/event";
import { at, callRoute, q } from "./helpers";

/**
 * 신청 → 대기자 판정 → 입금 안내 자동 발송 (#31).
 *
 * 손님이 지나는 길의 첫 칸이고, **이 시스템의 유일한 자동화**가 붙어 있는 곳이다.
 * 여기가 조용히 망가지면 신청한 사람이 아무 안내도 못 받고, 운영자는 밤새 아무도
 * 입금하지 않았다고 생각한다.
 */

type Accepted = {
  ok: boolean;
  data: { seq: number; waitlisted: boolean; dueAt: string | null; dueAtLabel: string | null };
};

const 정상신청 = {
  name: "김한결",
  phone: "010-1234-5678",
  gender: "M" as const,
  birth: "1998-05-05",
  privacy_agreed: true,
};

/**
 * ⚠️ 매번 다른 IP에서 온 것처럼 보낸다. 연타 차단이 IP당 1분에 다섯 번이라,
 *    같은 IP로 두면 한 파일 안의 여섯 번째 신청부터 전부 429가 되고 **원인이
 *    엉뚱한 곳에서 보인다**(신청은 저장 안 됐는데 발송을 의심하게 된다).
 *    실제로도 신청자는 저마다 다른 IP에서 온다.
 */
let 아이피 = 0;

async function 신청하기(body: Record<string, unknown> = {}) {
  아이피 += 1;
  const res = await callRoute<Accepted>(applyPOST, {
    method: "POST",
    headers: { "x-forwarded-for": `203.0.113.${아이피 % 250}` },
    body: { ...정상신청, ...body },
  });
  // 🔴 발송은 응답 **뒤에** 돈다. 기다리지 않고 기록을 열어보면 「보냈는데 아직
  //    안 보인다」로 검사가 들쭉날쭉해진다.
  await settleAfterResponse();
  return res;
}

/** 자리를 실제로 채운다 — 🔴 자리는 「입금완료」로만 찬다. */
async function 입금완료로채우기(gender: "M" | "F", n: number) {
  for (let i = 0; i < n; i += 1) {
    await q(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth)
         values ($1, $2, $3, '1996-01-01') returning id
       )
       insert into application
         (applicant_id, event_id, status, token, privacy_agreed_at, paid_at)
       select id, $4, '입금완료', $5, now(), now() from 사람`,
      [`${gender}${i}`, `0109${gender === "M" ? "1" : "2"}00000${i}`, gender, EVENT.id, newToken()],
    );
  }
}

describe("신청 저장", () => {
  it("사람과 신청이 각각 저장된다", async () => {
    const res = await 신청하기();

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const rows = await q<{ name: string; phone: string; status: string; event_id: number }>(
      `select p.name, p.phone, a.status, a.event_id
         from application a join applicant p on p.id = a.applicant_id`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "김한결",
      phone: "01012345678", // 하이픈은 서버가 떼고 저장한다
      status: "신청함",
      event_id: EVENT.id,
    });
  });

  it("신청만으로는 자리가 차지 않는다 — 입금 시각이 비어 있다", async () => {
    await 신청하기();

    const rows = await q<{ paid_at: string | null }>(`select paid_at from application`);
    // 🔴 「신청은 자리가 아니다」가 데이터에서도 참이어야 한다. 자리는 운영자가
    //    입금을 확인하는 순간에만 찬다.
    expect(rows[0].paid_at).toBeNull();
  });

  it("이미 신청한 연락처로 또 내면 중복임을 알려준다", async () => {
    await 신청하기();
    const 두번째 = await 신청하기({ name: "다른이름" });

    expect(두번째.status).toBe(409);
    const rows = await q<{ n: string }>(`select count(*)::text as n from application`);
    expect(rows[0].n).toBe("1");
  });

  it("같은 사람이 다른 회차에는 다시 신청할 수 있다", async () => {
    await 신청하기();
    // 2차 회차를 연다. 🔴 옛 구조는 사람과 신청이 한 표라 연락처 UNIQUE에 걸려
    //    같은 사람이 **두 번째 회차에 아예 못 들어왔다.**
    await q(
      `insert into event (id, title, date) values (2, '2차 오프라인 모임', '2027-01-16')
       on conflict (id) do nothing`,
    );
    await q(
      `insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
       select id, 2, '신청함', $1, now() from applicant where phone = '01012345678'`,
      [newToken()],
    );

    const rows = await q<{ n: string }>(
      `select count(*)::text as n from application a
         join applicant p on p.id = a.applicant_id where p.phone = '01012345678'`,
    );
    expect(rows[0].n).toBe("2");
  });

  it("화면이 보낸 나이를 믿지 않고 생년월일로 다시 계산한다", async () => {
    // 마흔 살인 사람이 「스물다섯」이라고 우겨도 서버는 생년월일만 본다.
    await 신청하기({ age: 25, birth: "1986-01-01", phone: "01055556666" });

    const rows = await q<{ memo: string | null }>(`select memo from application`);
    // 참가 조건(20~32세) 밖이라 운영자가 볼 표시가 남는다 — 막지는 않는다.
    expect(rows[0].memo).toMatch(/자격 확인 필요/);
    expect(rows[0].memo).not.toMatch(/25세/);
  });

  it("응답에 이름·연락처·토큰이 실려 나가지 않는다", async () => {
    const res = await 신청하기();

    const token = (await q<{ token: string }>(`select token from application`))[0].token;
    // 🔴 토큰이 곧 신원이다. 응답으로 흘리면 화면 기록·계측·로그를 타고 퍼진다 —
    //    링크는 그 사람의 알림톡으로만 간다.
    expect(res.raw).not.toContain(token);
    expect(res.raw).not.toContain("01012345678");
    expect(res.raw).not.toContain("김한결");
  });
});

describe("기한", () => {
  it("자리가 있으면 신청 시각 + 72시간이 박힌다", async () => {
    await at("2026-10-01T03:00:00Z", async () => {
      await 신청하기();
    });

    const rows = await q<{ due_at: string }>(`select due_at from application`);
    // 10-01 03:00Z + 72h = 10-04 03:00Z
    expect(new Date(rows[0].due_at).toISOString()).toBe("2026-10-04T03:00:00.000Z");
  });

  it("완료 화면이 그 기한을 정확한 날짜·시각으로 받는다", async () => {
    const res = await at("2026-10-01T03:00:00Z", () => 신청하기());

    // 🔴 알림톡의 `#{입금기한}`과 **같은 함수**가 만든 문자열이다. 두 곳에서 따로
    //    만들면 문자로 받은 기한과 화면에서 본 기한이 달라진다.
    const 기대 = formatDeadline(new Date("2026-10-04T03:00:00Z"));
    expect(res.body.data.dueAtLabel).toBe(기대);
    // 한국 시간으로 10월 4일 정오다 — UTC로 그대로 찍히면 오전 3시로 보인다.
    expect(기대).toContain("10월 4일");
    expect(기대).toContain("오후 12시");
  });

  it("🔴 대기자로 접수되면 기한 칸이 비어 있다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);

    const res = await 신청하기();

    expect(res.body.data.waitlisted).toBe(true);
    expect(res.body.data.dueAt).toBeNull();
    expect(res.body.data.dueAtLabel).toBeNull();

    const rows = await q<{ due_at: string | null }>(
      `select a.due_at from application a join applicant p on p.id = a.applicant_id
        where p.phone = '01012345678'`,
    );
    expect(rows[0].due_at).toBeNull();
  });
});

describe("대기자 판정", () => {
  it("자리 판정은 「입금완료」만 센다 — 신청함이 열 명이어도 대기가 아니다", async () => {
    for (let i = 0; i < EVENT.capacityPerGender; i += 1) {
      await q(
        `with 사람 as (
           insert into applicant (name, phone, gender, birth)
           values ($1, $2, 'M', '1996-01-01') returning id
         )
         insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
         select id, $3, '신청함', $4, now() from 사람`,
        [`대기중${i}`, `0108000000${i}`, EVENT.id, newToken()],
      );
    }

    const res = await 신청하기();

    // 🔴 신청은 자리가 아니다. 여기가 뒤집히면 아무도 입금하지 않았는데 모집이 닫힌다.
    expect(res.body.data.waitlisted).toBe(false);
  });

  it("성별로 따로 센다 — 남자가 다 차도 여자는 자리가 있다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);

    const 남 = await 신청하기({ gender: "M", phone: "01011112222" });
    const 여 = await 신청하기({ gender: "F", phone: "01033334444" });

    expect(남.body.data.waitlisted).toBe(true);
    expect(여.body.data.waitlisted).toBe(false);
  });

  it("취소된 입금완료는 자리를 붙들지 않는다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);
    await q(`update application set status = '취소됨' where status = '입금완료'`);

    const res = await 신청하기();

    // 🔴 대기자는 저장하는 값이 아니라 그때그때 세는 것이다. 앞사람이 취소하면
    //    자리가 저절로 돌아온다 — 명단을 손으로 되돌릴 필요가 없다.
    expect(res.body.data.waitlisted).toBe(false);
  });
});

describe("자동 발송", () => {
  it("자리가 있으면 입금 안내가 한 번 나간다", async () => {
    await 신청하기();

    expect(fakeOutbox()).toHaveLength(1);
    const sent = fakeOutbox()[0];
    expect(sent.phone).toBe("01012345678");
    expect(sent.text).toContain("김한결님");
    expect(sent.text).toContain(EVENT.priceLabel);
    // 🔴 채우지 못한 변수가 하나도 남아 있으면 안 된다. `#{계좌}`가 그대로 박힌
    //    문구가 손님에게 가는 것이 이 시스템에서 가장 부끄러운 사고다.
    expect(sent.text).not.toContain("#{");
  });

  it("자리가 없으면 대기 안내가 나가고, 기한을 말하지 않는다", async () => {
    await 입금완료로채우기("M", EVENT.capacityPerGender);

    await 신청하기();

    expect(fakeOutbox()).toHaveLength(1);
    const sent = fakeOutbox()[0];
    expect(sent.text).toContain("대기 명단");
    expect(sent.text).not.toContain("입금 기한");
    expect(sent.text).not.toContain("#{");
  });

  it("본문에 링크가 글자로 들어간다 — 문자로 대체되면 버튼이 사라진다", async () => {
    await 신청하기();

    const token = (await q<{ token: string }>(`select token from application`))[0].token;
    const sent = fakeOutbox()[0];
    expect(sent.text).toContain(`/me/${token}`);
    // 🔴 버튼 주소에는 변수를 못 쓴다. 보낼 때 그 사람의 주소를 통째로 넣는다.
    expect(sent.buttons?.[0].url_mobile).toContain(`/me/${token}`);
  });

  it("🔴 발송이 실패해도 신청은 저장된다", async () => {
    // 보낼 문구를 없애 발송을 실제로 실패시킨다.
    await q(`delete from notification_template where id = '입금안내'`);

    const res = await 신청하기();

    expect(res.status).toBe(201);
    const rows = await q<{ n: string }>(`select count(*)::text as n from application`);
    expect(rows[0].n).toBe("1");
    expect(fakeOutbox()).toHaveLength(0);

    // 실패도 기록에 남는다 — 안 남기면 운영자 화면의 「보내다 실패한 것」이 비어 보인다.
    const 기록 = await q<{ status: string; error: string }>(
      `select status, error from notification`,
    );
    expect(기록[0].status).toBe("실패");
    expect(기록[0].error).toMatch(/입금안내/);
  });

  it("🔴 못 채운 변수가 하나라도 남으면 발송을 거부한다", async () => {
    // 목록에 없는 변수를 문구에 넣는다(계좌를 문구에 박으려던 실수를 흉내 낸다).
    await q(
      `update notification_template set body = body || E'\n계좌 #{계좌}' where id = '입금안내'`,
    );

    const res = await 신청하기();

    expect(res.status).toBe(201); // 신청은 그대로 저장된다
    expect(fakeOutbox()).toHaveLength(0); // 🔴 나가지 않았다
    const 기록 = await q<{ status: string; error: string }>(
      `select status, error from notification`,
    );
    expect(기록[0].status).toBe("실패");
    expect(기록[0].error).toContain("계좌");
  });
});

describe("발송 기록", () => {
  it("그때 보낸 문구 전문이 복사돼 문구를 고쳐도 안 바뀐다", async () => {
    await 신청하기();
    const 처음 = (await q<{ body: string }>(`select body from notification`))[0].body;

    await q(`update notification_template set body = '통째로 바뀐 문구' where id = '입금안내'`);

    const 나중 = (await q<{ body: string }>(`select body from notification`))[0].body;
    // 🔴 분쟁이 나면 「무엇을 보냈다고 주장하는지」가 유일한 근거다.
    expect(나중).toBe(처음);
    expect(나중).toContain("김한결님");
  });

  it("접수 결과와 도달 결과가 각각 남는다 — 한 칸에 뭉치지 않는다", async () => {
    await 신청하기();

    const 접수 = (
      await q<{
        accept_code: string | null;
        accepted_at: string | null;
        result_code: string | null;
        delivered_at: string | null;
        status: string;
      }>(`select accept_code, accepted_at, result_code, delivered_at, status from notification`)
    )[0];

    // 대행사가 **접수**했다는 것까지만 안다.
    expect(접수.accept_code).toBe("1000");
    expect(접수.accepted_at).not.toBeNull();
    // 🔴 손님이 받았는지는 아직 모른다. 여기를 「보냈음」으로 뭉치면, 접수는 됐는데
    //    도달이 안 된 사람이 묻혀 운영자가 영영 못 본다.
    expect(접수.result_code).toBeNull();
    expect(접수.delivered_at).toBeNull();
    expect(접수.status).toBe("성공");
  });
});

describe("도달 결과 웹훅", () => {
  it("refkey로 발송 기록을 찾아 도달을 채운다", async () => {
    await 신청하기();
    const 기록 = (await q<{ id: string }>(`select id from notification`))[0];

    const res = await callRoute<{ ok: boolean }>(resultPOST, {
      method: "POST",
      // 🔴 우리가 보낸 발송 기록 id가 그대로 돌아온다. 따로 만든 값이면 두 벌이 된다.
      body: { refkey: 기록.id, result: "4100", messagekey: "PPURIO-1", type: "at" },
    });

    expect(res.status).toBe(200);
    const 뒤 = (
      await q<{ result_code: string; delivered_at: string | null; status: string }>(
        `select result_code, delivered_at, status from notification`,
      )
    )[0];
    expect(뒤.result_code).toBe("4100");
    expect(뒤.delivered_at).not.toBeNull();
    expect(뒤.status).toBe("성공");
  });

  it("도달하지 못했으면 실패로 남는다", async () => {
    await 신청하기();
    const 기록 = (await q<{ id: string }>(`select id from notification`))[0];

    await callRoute(resultPOST, {
      method: "POST",
      body: { refkey: 기록.id, result: "3018" },
    });

    const 뒤 = (await q<{ status: string; error: string }>(`select status, error from notification`))[0];
    expect(뒤.status).toBe("실패");
    expect(뒤.error).toContain("3018");
  });

  it("문자로 대체돼 도달한 것은 따로 표시된다", async () => {
    await 신청하기();
    const 기록 = (await q<{ id: string }>(`select id from notification`))[0];

    await callRoute(resultPOST, {
      method: "POST",
      body: { refkey: 기록.id, result: "4100", type: "sms" },
    });

    // ⚠️ 문자 대체도 **손님은 받았다.** 다만 버튼이 통째로 사라진 채 갔다는 뜻이라
    //    성공과 구분해 둔다.
    const 뒤 = (await q<{ status: string }>(`select status from notification`))[0];
    expect(뒤.status).toBe("문자대체");
  });

  it("같은 결과가 두 번 와도 도달 시각이 흔들리지 않는다", async () => {
    await 신청하기();
    const 기록 = (await q<{ id: string }>(`select id from notification`))[0];
    const body = { refkey: 기록.id, result: "4100" };

    // ⚠️ `::text`로 받는다. 그대로 받으면 pg가 Date 객체를 주고, 같은 시각이라도
    //    `toBe`(동일성 비교)가 「다르다」고 한다.
    const 시각 = `select delivered_at::text as delivered_at from notification`;
    await callRoute(resultPOST, { method: "POST", body });
    const 처음 = (await q<{ delivered_at: string }>(시각))[0];
    await callRoute(resultPOST, { method: "POST", body });
    const 나중 = (await q<{ delivered_at: string }>(시각))[0];

    expect(나중.delivered_at).toBe(처음.delivered_at);
  });

  it("모양이 아닌 refkey는 500이 아니라 400으로 거절한다", async () => {
    // 🔴 500을 주면 대행사가 계속 재시도해 로그가 그걸로 가득 찬다.
    const res = await callRoute<{ ok: boolean; error: string }>(resultPOST, {
      method: "POST",
      body: { refkey: "이건-uuid가-아니다", result: "4100" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_refkey");
  });
});
