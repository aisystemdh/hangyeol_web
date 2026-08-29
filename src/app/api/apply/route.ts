import { NextResponse, after } from "next/server";
import { q, isUniqueViolation } from "@/lib/db";
import { ageOn, isRealDate } from "@/lib/age";
import { notifyNewApplicant } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { EVENT } from "@/lib/event";

/**
 * POST /api/apply — 사전 등록 (공개)
 *
 * 근거: 지식베이스 `8_참가자모집/한결_신청결제_DB인계.md` §3-1
 *
 * 🔴 이 단계에서 돈을 받지 않는다. 「사전 등록」이지 「신청 확정」이 아니다.
 * 🔴 화면 검증을 믿지 않는다. 주소만 알면 이 API를 직접 때릴 수 있다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: unknown;
  phone?: unknown;
  gender?: unknown;
  birth?: unknown;
  privacy_agreed?: unknown;
  marketing_agreed?: unknown;
  _gotcha?: unknown;
};

const bad = (error: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error, message }, { status });

export async function POST(req: Request) {
  // ── 연타 차단 ────────────────────────────────────────────────
  if (!rateLimit(`apply:${clientIp(req)}`, 5, 60_000)) {
    return bad("rate_limited", "잠시 후 다시 시도해주세요.", 429);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("bad_json", "요청을 읽지 못했습니다.");
  }

  // ── 허니팟 ───────────────────────────────────────────────────
  // 사람은 볼 수도 탭으로 닿을 수도 없는 칸이다. 값이 차 있으면 봇이다.
  // 🔴 봇에게는 실패를 알리지 않는다 — 알려주면 다음엔 그 칸을 비우고 온다.
  //    저장만 하지 않고 성공한 것처럼 응답한다.
  if (typeof body._gotcha === "string" && body._gotcha.trim() !== "") {
    return NextResponse.json({ ok: true, seq: 0 }, { status: 201 });
  }

  // ── 검증 ─────────────────────────────────────────────────────
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 20) {
    return bad("bad_name", "이름을 입력해주세요.");
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone : "";
  const phone = phoneRaw.replace(/\D/g, "");
  if (!/^010\d{8}$/.test(phone)) {
    return bad("bad_phone", "휴대전화 번호를 010으로 시작하는 11자리로 입력해주세요.");
  }

  const gender = body.gender === "M" || body.gender === "F" ? body.gender : null;
  if (!gender) return bad("bad_gender", "성별을 선택해주세요.");

  const birth = typeof body.birth === "string" ? body.birth : "";
  if (!isRealDate(birth)) return bad("bad_birth", "생년월일을 확인해주세요.");

  const age = ageOn(birth);
  // 🟡 나이가 범위를 벗어나도 **막지 않는다.** 저장하고 현황판에 띄워 사람이 판단한다.
  //    막아버리면 ① 다음 회차 모수를 통째로 잃고 ② 만 나이 기준일이 「신청일」인지
  //    「행사일」인지 애매한 경계 사례에서 항의가 온다.
  if (age < 10 || age > 100) return bad("bad_birth", "생년월일을 확인해주세요.");
  const ageOutOfRange = age < EVENT.ageMin || age > EVENT.ageMax;

  if (body.privacy_agreed !== true) {
    return bad("need_privacy", "개인정보 수집·이용에 동의해주세요.");
  }
  const marketingAgreed = body.marketing_agreed === true;

  // ── 저장 ─────────────────────────────────────────────────────
  try {
    const rows = await q<{ seq: string }>(
      `insert into applicant
         (name, phone, gender, birth, privacy_agreed_at, marketing_agreed_at, memo)
       values ($1, $2, $3, $4, now(), $5, $6)
       returning seq`,
      [
        name,
        phone,
        gender,
        birth,
        marketingAgreed ? new Date() : null,
        ageOutOfRange ? `자격 확인 필요 — 신청 시점 만 ${age}세` : null,
      ],
    );
    const seq = Number(rows[0].seq);

    await q(
      `insert into applicant_event (applicant_id, from_status, to_status, reason, actor)
       select id, null, 'pre_registered', '랜딩 사전등록', 'system'
         from applicant where seq = $1`,
      [seq],
    );

    // 🔴 알림은 신청보다 덜 중요하다. 실패해도 여기서 던지지 않는다.
    //
    // ⚠️ `after()`로 **응답을 보낸 뒤에** 부른다. 예전에는 그냥 await 했는데,
    //    Formspree 왕복이 응답 경로에 그대로 얹혀 신청자가 1초 넘게 더 기다렸다(실측).
    //    신청자를 기다리게 하면서 보낼 만큼 급한 알림이 아니다.
    //    그냥 await 없이 부르면 서버리스에서는 응답과 함께 프로세스가 정리되며
    //    요청이 중간에 끊긴다 — `after()`가 그 사이를 메운다.
    after(async () => {
      await notifyNewApplicant({
        seq, name, phone, gender, birth, age, ageOutOfRange, marketingAgreed,
      });
    });

    return NextResponse.json({ ok: true, seq }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return bad(
        "duplicate",
        "이미 등록된 번호입니다. 접수돼 있으니 안내를 기다려주세요.",
        409,
      );
    }
    // 🔴 여기서 무슨 일이 있었는지 로그에 남긴다. 저장에 실패했는데
    //    화면이 접수됐다고 말하는 일은 절대 없어야 한다 — 아래 500이 그 약속이다.
    console.error("[api/apply] 저장 실패", err);
    return bad("server", "잠시 문제가 있었습니다. 다시 시도해주세요.", 500);
  }
}
