import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { EVENT } from "@/lib/event";

/**
 * GET /api/recruit — 모집 현황 (공개)
 *
 * 근거: 지식베이스 `8_참가자모집/한결_모집일정_3단계게이트.md` §2
 *
 * 🔴 **폼 9가 아니라 랜딩페이지가 모집 현황을 보여줄 자리다.** 폼 9는 이미 링크를
 *    받은 사람이 자기 자리를 잡으러 들어오는 화면이라, 거기서 「남은 자리」를 세게
 *    보여주면 조급해져 문항을 대충 찍는다. 답변의 질이 떨어지면 2부 페어링이 망가진다.
 *
 * 🔴 세는 것은 **확정 인원(입금 완료)**뿐이다. 입금 대기는 세지 않는다 —
 *    안 낸 사람이 자리를 차지한 것처럼 보이면 나중에 숫자가 뒤로 간다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EVENT가 `as const`라 숫자들이 리터럴 타입(10)으로 잡힌다. 계산에 쓰려면 넓혀야 한다.
const CAP: number = EVENT.capacityPerGender;
const LABEL = { M: "남성", F: "여성" } as const;

type Row = { gender: "M" | "F"; confirmed: number; high_water: number };

export async function GET() {
  try {
    // 워터마크를 먼저 올린다. 조건이 붙어 있어 값이 그대로면 아무것도 쓰지 않는다.
    // 🔴 이게 「숫자가 뒤로 가지 않는다」의 전부다 — 입금 기한이 지나 자리가
    //    되살아나도 공개 숫자는 내려간 채로 둔다. 늘었다 줄었다 하는 숫자는
    //    신뢰를 깬다. 내부 현황판은 실제 값을 그대로 본다.
    await q(
      `update recruit_display d
          set high_water = c.n
         from (select gender, count(*)::int as n
                 from applicant where status = 'confirmed'
                group by gender) c
        where d.gender = c.gender and d.high_water < c.n`,
    );

    const rows = await q<Row>(
      `select d.gender,
              coalesce(a.n, 0)   as confirmed,
              d.high_water
         from recruit_display d
         left join (select gender, count(*)::int as n
                      from applicant where status = 'confirmed'
                     group by gender) a on a.gender = d.gender`,
    );

    const remaining: Record<"M" | "F", number> = { M: CAP, F: CAP };
    for (const r of rows) {
      remaining[r.gender] = Math.max(0, CAP - r.high_water);
    }

    const taken = CAP * 2 - remaining.M - remaining.F;
    const full = remaining.M === 0 && remaining.F === 0;

    let phase: "hidden" | "counting" | "closed";
    let message: string;

    if (full) {
      phase = "closed";
      message = "마감되었습니다 — 대기 신청은 받습니다";
    } else if (taken >= EVENT.capacity / 2) {
      // 🔴 성별로 나눠서 보여준다. 남10·여10이라 "5자리 남음"은 아무 뜻이 없다.
      phase = "counting";
      message = (["F", "M"] as const)
        .map((g) =>
          remaining[g] === 0 ? `${LABEL[g]} 마감` : `${LABEL[g]} ${remaining[g]}자리`,
        )
        .join(" · ");
    } else {
      // 🔴 절반도 안 찼을 때 숫자를 보여주지 않는 이유 — "18자리 남음"은 희소성이
      //    아니라 **「아무도 안 왔다」는 신호**다. 초대받은 느낌을 주지 못한다.
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
    console.error("[api/recruit] 조회 실패", err);
    return NextResponse.json({ phase: "unknown", message: "" }, { status: 200 });
  }
}
