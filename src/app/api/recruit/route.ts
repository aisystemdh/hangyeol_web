import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { EVENT } from "@/lib/event";

/**
 * GET /api/recruit — 공개 모집 현황
 *
 * 🔴 **워터마크를 폐기했다**(`docs/decisions/003-scenario-redesign-2026-09-05.md` §5).
 *    옛 구조는 `recruit_display.high_water`(한 번 올라가면 안 내려가는 값)로
 *    「남은 자리 = 정원 − 그 값」을 계산했다. 입금완료가 3명인데 값이 8이면 화면에
 *    **「여성 2자리」**가 떴다 — 실제로는 일곱 자리가 남았는데.
 *    그 장치가 막던 것은 **선착순 시절 기한이 지나 자리가 되살아나며 숫자가 뒤로 가던
 *    일**이고, 자리가 입금 확인으로만 차게 되면서 그 원인이 사라졌다. 이제 남은 것은
 *    잔여석을 실제보다 적어 보이게 하는 효과뿐이라 표시광고법 §3①이 금지하는 쪽이다.
 *    **입금완료 인원을 그대로 센다.**
 *
 * 🔴 세는 것은 **입금완료뿐이다.** 신청은 자리가 아니다(`CONTEXT.md`) — 아직 돈이
 *    확인되지 않은 사람을 세면 「신청만 하고 사라진 사람」이 자리를 붙들고 있게 된다.
 *
 * 🔴 **이 응답만 `{ok, data}` 봉투를 씌우지 않는다.** `RecruitStatus.tsx`가 최상위에서
 *    값을 읽고, 없으면 **에러 없이 아무것도 안 그린다** — 봉투를 씌우면 홈의 「모집 현황」
 *    줄이 조용히 사라지고 아무도 눈치채지 못한다(스펙 #28 결정 43).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EVENT가 `as const`라 숫자들이 리터럴 타입(10)으로 잡힌다. 계산에 쓰려면 넓혀야 한다.
const CAP: number = EVENT.capacityPerGender;
const LABEL = { M: "남성", F: "여성" } as const;

type Row = { gender: "M" | "F"; n: number };

export async function GET() {
  try {
    // 🔴 성별로 따로 센다. 남10·여10이라 전체로 세면 남자만 20명인 상태도 「만석」이 된다.
    const rows = await q<Row>(
      `select p.gender, count(*)::int as n
         from application a
         join applicant   p on p.id = a.applicant_id
        where a.event_id = $1 and a.status = '입금완료'
        group by p.gender`,
      [EVENT.id],
    );

    const remaining: Record<"M" | "F", number> = { M: CAP, F: CAP };
    for (const r of rows) {
      remaining[r.gender] = Math.max(0, CAP - r.n);
    }

    const taken = CAP * 2 - remaining.M - remaining.F;
    const full = remaining.M === 0 && remaining.F === 0;

    let phase: "hidden" | "counting" | "closed";
    let message: string;

    if (full) {
      phase = "closed";
      // 🔴 「대기 신청은 받습니다」를 뺐다. 대기 안내는 알림톡이 한다 —
      //    여기서 권하면 대기자가 스스로 신청한 줄 알고 연락을 기다린다.
      message = "마감되었습니다";
    } else if (taken >= EVENT.capacity / 2) {
      phase = "counting";
      message = (["F", "M"] as const)
        .map((g) =>
          remaining[g] === 0 ? `${LABEL[g]} 마감` : `${LABEL[g]} ${remaining[g]}자리`,
        )
        .join(" · ");
    } else {
      // 🔴 절반도 안 찼을 때 숫자를 감추는 규칙은 **그대로 가져왔다.** 그건 거짓이
      //    아니라 침묵이다 — 「18자리 남음」은 희소성이 아니라 **「아무도 안 왔다」는
      //    신호**라서 초대받은 느낌을 주지 못한다.
      phase = "hidden";
      message = "지금 신청받고 있습니다";
    }

    return NextResponse.json(
      { phase, message, ...(phase === "counting" ? { remaining } : {}) },
      {
        // 숫자가 분 단위로 바뀔 일이 없다. CDN이 흡수해 DB를 덜 때린다.
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      },
    );
  } catch (err) {
    // 🔴 현황을 못 읽는다고 신청 화면 전체를 망가뜨리지 않는다.
    //    모르면 **아무 숫자도 말하지 않는다** — 틀린 숫자보다 침묵이 낫다.
    //    `message`가 비어 있으면 화면이 줄 자체를 그리지 않는다(RecruitStatus.tsx).
    console.error("[api/recruit] 조회 실패", err);
    return NextResponse.json({ phase: "unknown", message: "" }, { status: 200 });
  }
}
