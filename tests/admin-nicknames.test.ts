import { describe, expect, it } from "vitest";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as nicknamesGET, POST as nicknamesPOST } from "@/app/api/admin/nicknames/route";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { SITE } from "@/lib/site";
import type { AdminApplicationRow } from "@/lib/admin-list";
import { callRoute, q, setCookies } from "./helpers";

/**
 * 닉네임 일괄 배정 (이슈 #39).
 *
 * 🔴 이 이슈에서 가장 무서운 사고는 「번호가 빈다」·「이미 붙은 번호가 다시 눌러
 *    바뀐다」·「번호에 성별이 드러난다」다 — 계산 자체(1부터 순서대로)는 쉽지만,
 *    반복 호출·중간 취소·동시 클릭에서 이 세 가지가 깨지지 않는지가 진짜 검사
 *    대상이다. `admin-payment.test.ts`와 같은 자리(`callRoute`로 라우트를 직접
 *    부른다)를 쓴다.
 */

type ItemsBody = { ok: boolean; data?: { items: AdminApplicationRow[] } };
type AssignBody = {
  ok: boolean;
  data?: { assignedCount: number; overCapacityCount: number; items: AdminApplicationRow[] };
  error?: string;
  message?: string;
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

/** 입금완료 신청 하나를 만들고 id·seq를 돌려준다. 호출 순서가 곧 seq 순서다. */
async function 입금완료만들기(name: string, gender: "M" | "F" = "M"): Promise<{ id: string; seq: number }> {
  카운터 += 1;
  const token = newToken();
  const phone = `010${String(70000000 + 카운터).padStart(8, "0")}`;
  const rows = await q<{ id: string; seq: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, $3, '1997-01-01') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at, paid_at)
     select id, $4, '입금완료', $5, now(), now() from 사람
     returning id, seq::text as seq`,
    [name, phone, gender, EVENT.id, token],
  );
  return { id: rows[0].id, seq: Number(rows[0].seq) };
}

async function 취소된신청만들기(name: string): Promise<{ id: string }> {
  카운터 += 1;
  const token = newToken();
  const phone = `010${String(70000000 + 카운터).padStart(8, "0")}`;
  const rows = await q<{ id: string }>(
    `with 사람 as (
       insert into applicant (name, phone, gender, birth)
       values ($1, $2, 'M', '1997-01-01') returning id
     )
     insert into application
       (applicant_id, event_id, status, token, privacy_agreed_at)
     select id, $3, '취소됨', $4, now() from 사람
     returning id`,
    [name, phone, EVENT.id, token],
  );
  return { id: rows[0].id };
}

async function 배정하기(cookies: Record<string, string>) {
  return callRoute<AssignBody>(nicknamesPOST, {
    method: "POST",
    cookies,
    body: { actor: SITE.operators[0].name },
  });
}

async function nick조회(id: string): Promise<number | null> {
  const rows = await q<{ nick: number | null }>(`select nick from application where id = $1`, [id]);
  return rows[0].nick;
}

describe("GET /api/admin/nicknames", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const res = await callRoute<ItemsBody>(nicknamesGET, { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("입금완료 상태인 신청만 보인다", async () => {
    const 입금 = await 입금완료만들기("입금된사람");
    const { id: 취소id } = await 취소된신청만들기("취소된사람");
    const cookies = await 로그인쿠키();

    const res = await callRoute<ItemsBody>(nicknamesGET, { cookies });

    expect(res.status).toBe(200);
    const ids = res.body.data?.items.map((r) => r.id) ?? [];
    expect(ids).toContain(입금.id);
    expect(ids).not.toContain(취소id);
  });
});

describe("POST /api/admin/nicknames — 닉네임 일괄 배정", () => {
  it("로그인 없이 부르면 401이고 아무도 번호를 받지 않는다", async () => {
    const { id } = await 입금완료만들기("사람1");

    const res = await callRoute<AssignBody>(nicknamesPOST, {
      method: "POST",
      body: { actor: SITE.operators[0].name },
    });

    expect(res.status).toBe(401);
    expect(await nick조회(id)).toBeNull();
  });

  it("명단에 없는 이름은 거절한다", async () => {
    await 입금완료만들기("사람1");
    const cookies = await 로그인쿠키();

    const res = await callRoute<AssignBody>(nicknamesPOST, {
      method: "POST",
      cookies,
      body: { actor: "듣도보도못한사람" },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_actor");
  });

  it("🔴 입금완료 20명에게 접수 순서대로 1~20이 붙는다", async () => {
    const people: { id: string; seq: number }[] = [];
    for (let i = 0; i < 20; i += 1) {
      people.push(await 입금완료만들기(`사람${i}`, i % 2 === 0 ? "M" : "F"));
    }
    const cookies = await 로그인쿠키();

    const res = await 배정하기(cookies);

    expect(res.status).toBe(200);
    expect(res.body.data?.assignedCount).toBe(20);

    // seq 오름차순 == 접수 순서 그대로 1~20.
    const 정렬됨 = [...people].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < 정렬됨.length; i += 1) {
      expect(await nick조회(정렬됨[i].id)).toBe(i + 1);
    }

    // 조작 로그에도 남는다.
    const logs = await q<{ kind: string; actor: string }>(
      `select kind, actor from event_log where application_id = $1`,
      [정렬됨[0].id],
    );
    expect(logs[0]).toEqual({ kind: "닉네임배정", actor: SITE.operators[0].name });
  });

  it("🔴 이미 배정된 사람은 다시 눌러도 안 바뀐다", async () => {
    const 사람1 = await 입금완료만들기("사람1");
    const 사람2 = await 입금완료만들기("사람2");
    const cookies = await 로그인쿠키();

    const 첫배정 = await 배정하기(cookies);
    expect(첫배정.body.data?.assignedCount).toBe(2);
    const nick1 = await nick조회(사람1.id);
    const nick2 = await nick조회(사람2.id);

    const 재배정 = await 배정하기(cookies);
    expect(재배정.status).toBe(200);
    expect(재배정.body.data?.assignedCount).toBe(0);
    expect(await nick조회(사람1.id)).toBe(nick1);
    expect(await nick조회(사람2.id)).toBe(nick2);
  });

  it("🔴 취소된 사람은 번호를 못 받는다", async () => {
    const 입금1 = await 입금완료만들기("입금된사람1");
    const { id: 취소id } = await 취소된신청만들기("취소된사람");
    const 입금2 = await 입금완료만들기("입금된사람2");
    const cookies = await 로그인쿠키();

    const res = await 배정하기(cookies);

    expect(res.body.data?.assignedCount).toBe(2);
    expect(await nick조회(취소id)).toBeNull();
    expect(await nick조회(입금1.id)).not.toBeNull();
    expect(await nick조회(입금2.id)).not.toBeNull();
  });

  it("🔴 번호가 비지 않는다 — 중간에 취소된 사람이 있어도 나머지가 연속된 번호를 받는다", async () => {
    const 사람1 = await 입금완료만들기("사람1");
    const 사람2 = await 입금완료만들기("사람2"); // 이 사람이 배정 전에 취소된다
    const 사람3 = await 입금완료만들기("사람3");

    // 입금 확인 뒤 취소 — 상태만 바뀐다(닉네임 로직과 무관하게 `admin-data.ts`의
    // `cancelApplication`이 하는 일 그대로, 여기서는 직접 SQL로 재현한다).
    await q(`update application set status = '취소됨' where id = $1`, [사람2.id]);

    const cookies = await 로그인쿠키();
    const res = await 배정하기(cookies);

    expect(res.body.data?.assignedCount).toBe(2);
    expect(await nick조회(사람2.id)).toBeNull(); // 취소된 사람은 대상이 아니다
    const nick1 = await nick조회(사람1.id);
    const nick3 = await nick조회(사람3.id);
    // 남은 둘이 빈 자리 없이 연속된 번호(1, 2)를 받는다.
    expect([nick1, nick3].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2]);
  });

  it("🔴 성별과 번호가 무관하다 — 성별이 섞여 있어도 접수 순서 그대로 번호가 붙는다", async () => {
    const 여1 = await 입금완료만들기("여1", "F");
    const 남1 = await 입금완료만들기("남1", "M");
    const 여2 = await 입금완료만들기("여2", "F");
    const 남2 = await 입금완료만들기("남2", "M");
    const cookies = await 로그인쿠키();

    await 배정하기(cookies);

    // 성별과 무관하게 접수(seq) 순서 그대로: 여1=1, 남1=2, 여2=3, 남2=4.
    expect(await nick조회(여1.id)).toBe(1);
    expect(await nick조회(남1.id)).toBe(2);
    expect(await nick조회(여2.id)).toBe(3);
    expect(await nick조회(남2.id)).toBe(4);
  });

  it("🔴 한 회차 안에서 번호가 겹치지 않는다 — 동시에 눌러도 안전하다", async () => {
    const people: { id: string; seq: number }[] = [];
    for (let i = 0; i < 10; i += 1) {
      people.push(await 입금완료만들기(`동시${i}`, i % 2 === 0 ? "M" : "F"));
    }
    const cookies = await 로그인쿠키();

    // 두 번 동시에 누른 상황을 재현한다 — `assignNicknames`의 `for update` 잠금이
    // 두 번째 트랜잭션을 첫 번째가 끝날 때까지 기다리게 해야 한다.
    const [첫, 둘] = await Promise.all([배정하기(cookies), 배정하기(cookies)]);

    expect(첫.status).toBe(200);
    expect(둘.status).toBe(200);
    // 둘을 합쳐 정확히 10명만 배정된다 — 중복도, 실패도 없다.
    expect((첫.body.data?.assignedCount ?? 0) + (둘.body.data?.assignedCount ?? 0)).toBe(10);

    const nicks = await Promise.all(people.map((p) => nick조회(p.id)));
    expect(nicks.every((n) => n !== null)).toBe(true);
    expect(new Set(nicks).size).toBe(10); // 겹치는 번호가 없다
    expect([...nicks].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
  });

  it("🔴 정원(20명)을 넘는 입금완료가 있어도 21번째 번호를 붙이려다 통째로 롤백되지 않는다", async () => {
    // 정원이 차도 입금 확인 자체는 막지 않는다(이슈 #35 AC) — 그래서 입금완료가
    // `EVENT.capacity`(20)를 넘는 상황이 실제로 생긴다. `application.nick`의
    // `check (nick between 1 and 20)`을 이 21번째 사람에게서 미리 피해야 한다
    // (코드리뷰 2026-09-06에서 잡힌 버그 — 안 피하면 트랜잭션 전체가 롤백돼
    // 정원 안의 20명도 함께 번호를 못 받는다).
    const people: { id: string; seq: number }[] = [];
    for (let i = 0; i < EVENT.capacity + 1; i += 1) {
      people.push(await 입금완료만들기(`정원${i}`, i % 2 === 0 ? "M" : "F"));
    }
    const cookies = await 로그인쿠키();

    const res = await 배정하기(cookies);

    expect(res.status).toBe(200); // 던지지 않는다 — 롤백 사고가 없다.
    expect(res.body.data?.assignedCount).toBe(EVENT.capacity);
    expect(res.body.data?.overCapacityCount).toBe(1);

    const 정렬됨 = [...people].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < EVENT.capacity; i += 1) {
      expect(await nick조회(정렬됨[i].id)).toBe(i + 1);
    }
    // 21번째(정원 밖)는 번호를 받지 못한다.
    expect(await nick조회(정렬됨[EVENT.capacity].id)).toBeNull();
  });
});
