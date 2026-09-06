import { NextResponse } from "next/server";
import { isUniqueViolation, tx } from "@/lib/db";
import { ageOn, isRealDate } from "@/lib/age";
import { afterResponse } from "@/lib/after";
import { newToken } from "@/lib/admin";
import { dueAtFrom, formatDeadline } from "@/lib/deadline";
import { isWaitlisted, paidSeats } from "@/lib/seats";
import { TEMPLATE, sendTemplate } from "@/lib/notification";
import { notifyNewApplicant } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { EVENT } from "@/lib/event";
import { myPageUrl, SITE_URL } from "@/lib/site";
import { deriveSource, UTM_KEYS } from "@/lib/source";

/**
 * POST /api/apply — 신청 (공개)
 *
 * 손님이 지나는 길의 첫 칸이다(`docs/decisions/003-scenario-redesign-2026-09-05.md` §6).
 *
 * 🔴 **신청은 자리가 아니다**(`CONTEXT.md`). 여기서 아무 자리도 잡히지 않는다 —
 *    자리는 운영자가 은행 앱을 보고 「입금 확인」을 누르는 순간에만 찬다.
 *    그래서 잠글 것도, 되돌릴 것도 없다.
 *
 * 🔴 **자리가 있으면 기한이 붙고, 없으면 안 붙는다.** 대기자는 낼 자리가 없는
 *    사람이라 시계를 돌리지 않는다.
 *
 * 🔴 **입금 안내는 저장이 끝난 뒤에 자동으로 나간다.** 운영자가 손으로 보내면 밤 11시에
 *    신청한 사람은 다음 날 아침에 안내를 받고 **72시간 중 아홉 시간을 이미 잃은 채**
 *    시작한다. 그래서 아홉 가지 중 이것만(그리고 자리가 찼을 때의 대기 안내만) 자동이다.
 *
 * 🔴 **발송이 실패해도 신청은 남는다.** 저장은 트랜잭션 안에서 끝내고, 발송은 응답을
 *    보낸 뒤에 부른다 — 안내가 안 가는 것보다 신청이 사라지는 것이 훨씬 나쁘다.
 *
 * 🔴 **화면 검증을 믿지 않는다.** 주소만 알면 이 API를 직접 때릴 수 있다.
 *    화면이 보낸 나이는 아예 읽지 않고 언제나 `birth`로 다시 계산한다.
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
  // ── 유입 (이슈 #41) ──────────────────────────────────────────
  // `@/lib/attribution`이 첫 도착 시점에 굳혀 둔 값을 그대로 실어 보낸다.
  referrer?: unknown;
  utm?: unknown;
  landing_path?: unknown;
};

const bad = (error: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error, message }, { status });

// ── 유입 값 정리 (이슈 #41) ─────────────────────────────────────
// 🔴 화면 검증을 믿지 않는다 — 여기 오는 값은 아무 클라이언트나 만들어 보낼 수 있다.
//    길이를 자르고 모양이 다른 값은 조용히 버린다(막지 않는다 — 유입 값이 이상해도
//    신청 자체를 실패시킬 이유는 아니다).
const MAX_STR = 500;
function sanitizeStr(v: unknown, max = MAX_STR): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// 표준 다섯 개만 받는다(`@/lib/source`) — 광고주가 임의의 키를 붙여도 `utm` 칸이 무한정 커지지 않는다.
function sanitizeUtm(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const raw = sanitizeStr((v as Record<string, unknown>)[key], 200);
    if (raw) out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(req: Request) {
  // ── 연타 차단 ────────────────────────────────────────────────
  // ⚠️ 인스턴스 메모리라 정확하지 않다. 막으려는 것은 분산 공격이 아니라 한 사람의
  //    연타이고, 진짜 방어선은 `phone` UNIQUE와 아래 허니팟이다.
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
    return NextResponse.json({ ok: true, data: { seq: 0, waitlisted: false } }, { status: 201 });
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

  // 🔴 화면이 보낸 나이는 **아예 읽지 않는다.** 언제나 생년월일에서 다시 계산한다.
  const age = ageOn(birth);
  // 🟡 나이가 범위를 벗어나도 **막지 않는다.** 저장하고 운영자 화면에 띄워 사람이
  //    판단한다. 막아버리면 ① 다음 회차 모수를 통째로 잃고 ② 만 나이 기준일이
  //    「신청일」인지 「행사일」인지 애매한 경계 사례에서 항의가 온다.
  if (age < 10 || age > 100) return bad("bad_birth", "생년월일을 확인해주세요.");
  const ageOutOfRange = age < EVENT.ageMin || age > EVENT.ageMax;

  if (body.privacy_agreed !== true) {
    return bad("need_privacy", "개인정보 수집·이용에 동의해주세요.");
  }
  const marketingAgreed = body.marketing_agreed === true;

  // ── 유입 (이슈 #41) ──────────────────────────────────────────
  // 🔴 `@/lib/attribution`이 첫 도착 시점에 굳힌 값을 그대로 받는다. 여기서 다시
  //    `req.headers.get("referer")`를 쓰지 않는다 — 그 값은 "이 fetch 요청이 어느
  //    페이지에서 나갔는가"(같은 사이트 안의 화면)일 뿐이라 마케팅 채널을 말해주지
  //    않는다. 클라이언트 값이 비어 있으면(오래된 캐시된 번들·자바스크립트 없이
  //    직접 API를 때린 경우) 그 헤더로라도 대신한다 — 아예 없는 것보다는 낫다.
  const referrer = sanitizeStr(body.referrer) ?? sanitizeStr(req.headers.get("referer"));
  const utm = sanitizeUtm(body.utm);
  const landingPath = sanitizeStr(body.landing_path, 300);
  const source = deriveSource({ utm, referrer, siteUrl: SITE_URL });

  // ── 저장 ─────────────────────────────────────────────────────
  const now = new Date();
  const token = newToken();

  try {
    // 🔴 **자리 판정은 트랜잭션을 열기 전에 한다.** 잠그지 않으므로 안에서 셀 이유가
    //    없고, 안에서 세면 트랜잭션이 연결 하나를 쥔 채 **또 하나를 빌리러 간다** —
    //    신청이 몰려 풀(10개)이 다 트랜잭션에 물리면 서로가 서로를 기다려 굳는다.
    //    (`max: 1`에서 27건 중 8건이 연결 타임아웃으로 죽은 것과 같은 종류의 사고다.)
    const taken = await paidSeats(EVENT.id);
    const waitlisted = isWaitlisted(taken, gender);

    // 🔴 **대기자에게는 기한이 없다.** 낼 자리가 없는 사람에게 시계를 돌리지 않는다.
    //    앞의 누군가가 취소해 자리가 나고 입금 안내를 받는 순간 72시간이 시작된다.
    const dueAt = waitlisted ? null : dueAtFrom(now);

    const saved = await tx(async (client) => {
      // 🔴 **사람과 신청을 나눠 둔 이유가 여기서 드러난다.** 연락처는 사람의 것이라
      //    UNIQUE지만, 신청은 회차마다 따로 생긴다 — 그래서 같은 사람이 2차 회차에
      //    다시 신청할 수 있다. 옛 구조는 한 표라 두 번째 회차가 아예 막혀 있었다.
      // 🔴 **이미 있는 사람의 신원을 덮어쓰지 않는다.** 이유 둘:
      //    ① 자리는 `applicant.gender`를 이어 세므로, 2차에 성별을 잘못 골라 다시
      //       신청하면 **지난 회차에 이미 확정된 그 사람의 자리가 반대쪽 칸으로 옮겨간다** —
      //       끝난 회차의 성비와 공개 모집 현황이 뒤늦게 바뀐다.
      //    ② 번호만 알면 남의 이름·생년월일을 이 API로 바꿀 수 있게 된다.
      //    잘못 적은 신원은 운영자가 고친다(#34). `do update`인 것은 `do nothing`이
      //    행을 안 돌려주기 때문이고, 실제로 바꾸는 값은 없다.
      const person = await client.query<{ id: string }>(
        `insert into applicant (name, phone, gender, birth)
         values ($1, $2, $3, $4)
         on conflict (phone) do update set updated_at = now()
         returning id`,
        [name, phone, gender, birth],
      );
      const applicantId = person.rows[0].id;

      const made = await client.query<{ id: string; seq: string }>(
        `insert into application
           (applicant_id, event_id, status, token, token_issued_at, due_at,
            privacy_agreed_at, marketing_agreed_at, memo,
            source, utm, referrer, landing_path)
         values ($1, $2, '신청함', $3, $4, $5, $4, $6, $7, $8, $9, $10, $11)
         returning id, seq`,
        [
          applicantId,
          EVENT.id,
          token,
          now,
          dueAt,
          marketingAgreed ? now : null,
          ageOutOfRange ? `자격 확인 필요 — 신청 시점 만 ${age}세` : null,
          source,
          utm ? JSON.stringify(utm) : null,
          referrer,
          landingPath,
        ],
      );

      await client.query(
        `insert into event_log (application_id, kind, actor, meta)
         values ($1, '신청', 'system', $2)`,
        [made.rows[0].id, JSON.stringify({ waitlisted, age })],
      );

      return { id: made.rows[0].id, seq: Number(made.rows[0].seq) };
    });

    // ── 응답을 보낸 뒤에 할 일 ─────────────────────────────────
    // ⚠️ `after()`를 직접 부르지 않는다 — 요청 문맥 밖에서 던져서, 라우트를 함수로
    //    부르는 순간 이 라우트가 통째로 500이 된다(`src/lib/after.ts`).
    afterResponse(async () => {
      // 🔴 자리가 있으면 입금 안내, 없으면 대기 안내. 둘 다 자동이다.
      await sendTemplate({
        applicationId: saved.id,
        templateId: waitlisted ? TEMPLATE.대기등록 : TEMPLATE.입금안내,
        phone,
        vars: {
          이름: name,
          입금액: EVENT.priceLabel,
          입금기한: dueAt ? formatDeadline(dueAt) : null,
          링크: myPageUrl(token),
          행사일: EVENT.date,
          시간: EVENT.time,
          장소: EVENT.place,
        },
        sentBy: "system",
      });
    });

    // 운영자에게 가는 메일 알림. 실패해도 조용히 삼킨다.
    afterResponse(async () => {
      await notifyNewApplicant({
        seq: saved.seq, name, phone, gender, birth, age, ageOutOfRange, marketingAgreed,
      });
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          seq: saved.seq,
          waitlisted,
          // 🔴 완료 화면이 **정확한 날짜·시각**으로 기한을 보여준다. 알림톡의
          //    `#{입금기한}`과 **같은 함수**가 만든 문자열이라 한 글자도 다르지 않다.
          dueAt: dueAt ? dueAt.toISOString() : null,
          dueAtLabel: dueAt ? formatDeadline(dueAt) : null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      // 한 사람은 한 회차에 신청 하나다(`unique (applicant_id, event_id)`).
      return bad(
        "duplicate",
        "이미 신청하신 번호입니다. 접수돼 있으니 안내를 기다려주세요.",
        409,
      );
    }
    // 🔴 여기서 무슨 일이 있었는지 로그에 남긴다. 저장에 실패했는데 화면이
    //    접수됐다고 말하는 일은 절대 없어야 한다 — 아래 500이 그 약속이다.
    console.error("[api/apply] 저장 실패", err);
    return bad("server", "잠시 문제가 있었습니다. 다시 시도해주세요.", 500);
  }
}
