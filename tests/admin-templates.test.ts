import { describe, expect, it } from "vitest";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { GET as templatesGET, POST as templatesPOST } from "@/app/api/admin/templates/route";
import { POST as templateUpdatePOST } from "@/app/api/admin/templates/[id]/route";
import type { AdminTemplateRow } from "@/lib/admin-templates";
import { sendTemplate } from "@/lib/notification";
import { SITE } from "@/lib/site";
import { newToken } from "@/lib/admin";
import { EVENT } from "@/lib/event";
import { callRoute, q, setCookies } from "./helpers";

/**
 * 문구 관리 화면 (이슈 #38).
 *
 * 확인하는 것 다섯.
 * ① 문구를 추가·수정·비활성화할 수 있다.
 * ② 승인 상태·승인 코드를 적을 수 있다.
 * ③ 버튼 이름·대체문자를 함께 관리한다.
 * ④ 문구를 고쳐도 **과거 발송 기록은 그대로**다 (`notification.body`는 복사본).
 * ⑤ 누가 고쳤는지가 `updated_by`에 남는다.
 *
 * 🔴 `id`는 만들 때만 정하고 수정 라우트는 그 값을 절대 안 본다 — 그래서 수정
 *    테스트는 `id`가 그대로인지도 함께 본다.
 */

type ItemsBody = { ok: boolean; data?: { items: AdminTemplateRow[] }; error?: string; message?: string };

async function 로그인쿠키(): Promise<Record<string, string>> {
  const res = await callRoute(loginPOST, {
    method: "POST",
    body: { password: process.env.ADMIN_PASSWORD },
  });
  return { hg_admin: setCookies(res).hg_admin };
}

const actor = SITE.operators[0].name;

describe("GET /api/admin/templates — 이중 방어 · 씨앗 목록", () => {
  it("로그인 없이 부르면 401이다", async () => {
    const res = await callRoute<ItemsBody>(templatesGET);
    expect(res.status).toBe(401);
  });

  it("로그인하면 006_templates.sql이 심어 둔 문구 아홉 개가 온다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesGET, { cookies });
    expect(res.status).toBe(200);
    expect(res.body.data?.items.length).toBe(9);
    expect(res.body.data?.items.every((t) => t.active)).toBe(true);
  });
});

describe("POST /api/admin/templates — 추가", () => {
  it("조작하는 사람 없이는 400이다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "특별공지", label: "특별 공지", body: "안내", approval: "REG" },
    });
    expect(res.status).toBe(400);
  });

  it("코드에 허용 안 되는 문자(공백)가 있으면 400이다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "특별 공지", label: "특별 공지", body: "안내", approval: "REG", actor },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_id");
  });

  it("승인 상태가 목록에 없는 값이면 400이다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "특별공지", label: "특별 공지", body: "안내", approval: "XXX", actor },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_approval");
  });

  it("🔴 승인(APR)인데 승인받은 코드가 없으면 400이다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "코드없는승인", label: "이름", body: "본문", approval: "APR", actor },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_template_code");
  });

  it("🔴 대체문자가 90바이트를 넘으면 400이다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: {
        id: "긴대체문자",
        label: "이름",
        body: "본문",
        approval: "REG",
        smsBody: "가".repeat(31), // 한글 1자 = UTF-8 3바이트 → 93바이트
        actor,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("sms_body_too_long");
  });

  it("① 승인 상태·코드·버튼 이름·대체문자까지 함께 저장된다, ⑤ 고친 사람이 남는다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: {
        id: "특별공지",
        label: "특별 공지",
        body: "[한결] 안내드립니다\n\n▶ #{링크}",
        whenHint: "필요할 때",
        approval: "APR",
        templateCode: "kko-9999",
        buttonName: "자세히 보기",
        smsBody: "[한결] 안내 ▶ 문자 확인",
        actor,
      },
    });

    expect(res.status).toBe(200);
    const created = res.body.data?.items.find((t) => t.id === "특별공지");
    expect(created).toMatchObject({
      id: "특별공지",
      label: "특별 공지",
      approval: "APR",
      templateCode: "kko-9999",
      buttonName: "자세히 보기",
      smsBody: "[한결] 안내 ▶ 문자 확인",
      active: true,
      updatedBy: actor,
    });
  });

  it("🔴 계좌번호처럼 보이는 숫자가 있어도 막지 않는다 — 경고이지 차단이 아니다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: {
        id: "계좌포함문구",
        label: "계좌 포함",
        body: "계좌 110123456789 입니다",
        approval: "REG",
        actor,
      },
    });
    expect(res.status).toBe(200);
  });

  it("같은 코드로 두 번 추가하면 400이다", async () => {
    const cookies = await 로그인쿠키();
    await callRoute(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "중복코드", label: "하나", body: "본문", approval: "REG", actor },
    });
    const res = await callRoute<ItemsBody>(templatesPOST, {
      method: "POST",
      cookies,
      body: { id: "중복코드", label: "둘", body: "본문", approval: "REG", actor },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("duplicate_id");
  });
});

describe("POST /api/admin/templates/[id] — 수정 · 비활성화", () => {
  it("존재하지 않는 id면 404다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody, { id: string }>(templateUpdatePOST, {
      method: "POST",
      params: { id: "없는코드" },
      cookies,
      body: { label: "새 이름", body: "본문", approval: "REG", active: true, actor },
    });
    expect(res.status).toBe(404);
  });

  it("① 본문·이름·활성 여부를 고칠 수 있고 id는 그대로다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody, { id: string }>(templateUpdatePOST, {
      method: "POST",
      params: { id: "입금안내" },
      cookies,
      body: {
        id: "이걸로바꾸려해도무시된다",
        label: "① 입금 안내(수정됨)",
        body: "[한결] 새 본문\n\n▶ #{링크}",
        approval: "APR",
        templateCode: "kko-0001",
        active: true,
        actor,
      },
    });
    expect(res.status).toBe(200);
    const updated = res.body.data?.items.find((t) => t.id === "입금안내");
    expect(updated?.id).toBe("입금안내"); // 🔴 본문의 id는 무시됐다
    expect(updated?.label).toBe("① 입금 안내(수정됨)");
    expect(updated?.approval).toBe("APR");
    expect(updated?.updatedBy).toBe(actor);
  });

  it("🔴 active가 정확한 boolean이 아니면 거절한다 — 끄려던 것이 조용히 켜진 채로 남지 않는다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody, { id: string }>(templateUpdatePOST, {
      method: "POST",
      params: { id: "후기안내" },
      cookies,
      body: { label: "⑦ 후기 안내", body: "본문", approval: "REG", active: 0, actor },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_active");
  });

  it("비활성화하면 목록에서 active=false로 보이지만 여전히 온다", async () => {
    const cookies = await 로그인쿠키();
    const res = await callRoute<ItemsBody, { id: string }>(templateUpdatePOST, {
      method: "POST",
      params: { id: "후기안내" },
      cookies,
      body: { label: "⑦ 후기 안내", body: "본문", approval: "REG", active: false, actor },
    });
    expect(res.status).toBe(200);
    const row = res.body.data?.items.find((t) => t.id === "후기안내");
    expect(row?.active).toBe(false);
  });

  it("🔴 문구를 고쳐도 이미 보낸 기록의 문구는 안 바뀐다", async () => {
    const phone = "01099998888";
    const rows = await q<{ id: string }>(
      `with 사람 as (
         insert into applicant (name, phone, gender, birth) values ('발송테스트', $1, 'M', '1996-01-01')
         returning id
       )
       insert into application (applicant_id, event_id, status, token, privacy_agreed_at)
       select id, $2, '신청함', $3, now() from 사람
       returning id`,
      [phone, EVENT.id, newToken()],
    );
    const applicationId = rows[0].id;

    const sent = await sendTemplate({
      applicationId,
      templateId: "리포트안내",
      phone,
      vars: { 이름: "발송테스트", 링크: "https://hangyeol.kr/me/abc", 행사일: "10월 24일" },
      sentBy: "system",
    });
    expect(sent.ok).toBe(true);

    const [before] = await q<{ body: string }>(
      `select body from notification where id = $1`,
      [sent.notificationId],
    );

    const cookies = await 로그인쿠키();
    await callRoute<ItemsBody, { id: string }>(templateUpdatePOST, {
      method: "POST",
      params: { id: "리포트안내" },
      cookies,
      body: { label: "⑨ 리포트 안내", body: "완전히 새로 쓴 본문", approval: "REG", active: true, actor },
    });

    const [after] = await q<{ body: string }>(
      `select body from notification where id = $1`,
      [sent.notificationId],
    );
    expect(after.body).toBe(before.body);
    expect(after.body).not.toContain("완전히 새로 쓴 본문");
  });
});
