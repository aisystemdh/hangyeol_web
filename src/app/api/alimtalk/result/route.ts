import { NextResponse } from "next/server";
import { q } from "@/lib/db";

/**
 * POST /api/alimtalk/result — 뿌리오 도달 결과 웹훅 (공개)
 *
 * 🔴 **동기 응답의 `code: 1000`은 「접수됨」이지 「손님이 받았다」가 아니다.**
 *    실제 도달은 여기로 따로 온다. 접수와 도달을 한 칸에 뭉치면, 접수는 됐는데
 *    도달이 안 된 사람이 「보냈음」으로 묻혀 **운영자가 영영 못 본다** —
 *    그때 봐야 하는 것은 「보냈다」가 아니라 「안 닿았다」다.
 *
 * 🔴 **짝은 `refkey`로 맞춘다.** 발송할 때 우리 발송 기록의 id를 그대로 `refkey`로
 *    보냈고 뿌리오가 그것을 그대로 돌려준다. 따로 만든 값이면 두 벌이 된다.
 *
 * ⚠️ **공개 주소인데 비밀값을 두지 않았다.** 이 주소로 할 수 있는 일은 「이미 있는
 *    발송 기록의 도달 상태를 바꾸는 것」뿐이고, 그러려면 **추측 불가한 uuid인
 *    `refkey`를 알아야 한다.** 아무것도 읽어 가지 못하고(응답은 `{ok}`뿐),
 *    새 기록을 만들지도 못한다. 대행사가 서명이나 고정 IP를 제공하면 그때 조인다.
 *
 * ⚠️ 대행사 계정이 아직 없어 **살아 있는 웹훅을 받아 본 적이 없다.** 몸통의 열쇠
 *    이름이 문서와 다를 수 있어 여러 표기를 함께 본다. 첫 발송 때 실제 몸통을
 *    로그로 확인하고 여기를 좁힐 것.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 도달했다는 뜻의 코드. 뿌리오 문서 실측(2026-09-05). */
const DELIVERED = "4100";

function pick(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const refkey = pick(body, "refkey", "refKey", "REFKEY");
  const result = pick(body, "result", "RESULT", "resultCode");
  const messageKey = pick(body, "messagekey", "messageKey", "MESSAGEKEY");
  // 실제로 무엇으로 나갔는지. 알림톡이 안 닿아 문자로 대체됐으면 여기가 sms/lms다.
  const sentType = (pick(body, "type", "TYPE", "msgtype") ?? "").toLowerCase();

  // 우리 `refkey`는 발송 기록의 uuid다. 모양이 아니면 질의에 넣지 않는다 —
  // Postgres가 uuid 변환에서 던져 500이 되고, 그러면 대행사가 계속 재시도한다.
  const isUuid = refkey != null && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(refkey);

  if (!refkey || !isUuid) {
    // ⚠️ 여기는 **우리가 고쳐야 할 신호**다. 몸통의 열쇠 이름을 잘못 짚었으면 모든
    //    웹훅이 이 길로 빠지는데, 조용히 200을 주면 대행사 쪽에도 우리 쪽에도 아무
    //    표시가 안 남아 **영영 모른 채 도달 결과가 통째로 비어 있게 된다.**
    //    (아래 「기록 없음」과 코드가 다른 이유 — 그쪽은 몸통이 멀쩡한데 맞출 상대가
    //     없는 경우라 재시도해도 달라질 게 없다.)
    console.error("[alimtalk/result] refkey가 없거나 모양이 다르다", body);
    return NextResponse.json({ ok: false, error: "bad_refkey" }, { status: 400 });
  }

  const delivered = result === DELIVERED;
  const status = delivered
    ? sentType === "sms" || sentType === "lms" || sentType === "mms"
      ? "문자대체"
      : "성공"
    : "실패";

  try {
    // 🔴 **`delivered_at`은 실제로 닿았을 때만 찍는다.** 실패에도 찍으면 ① 안 닿은
    //    안내에 「도달 시각」이 남아 운영자가 보냈다고 착각하고 ② 아래 중복 방어가
    //    그 행을 **영영 잠근다** — 실패 결과가 먼저 오고 도달이 나중에 오는 순서(재발송·
    //    문자 대체)에서 진짜 도달이 반영되지 못한 채 「실패」로 굳는다.
    //
    // 🔴 그래서 중복 방어의 기준도 `delivered_at`이다. 같은 도달 결과가 두 번 와도
    //    시각이 흔들리지 않고, **실패 뒤에 온 도달은 그대로 받아들인다.**
    const rows = await q<{ id: string }>(
      `update notification
          set result_code  = $2,
              delivered_at = case when $5 then now() else delivered_at end,
              message_key  = coalesce(message_key, $3),
              status       = $4,
              error        = case when $5 then null else $6 end
        where id = $1 and delivered_at is null
        returning id`,
      [
        refkey,
        result,
        messageKey,
        status,
        delivered,
        `도달 실패 (RESULT ${result ?? "?"})`,
      ],
    );

    if (rows.length === 0) {
      // 이미 처리했거나 우리 기록에 없는 refkey다. 재시도를 부르지 않도록 200을 준다.
      console.warn("[alimtalk/result] 해당 발송 기록 없음 또는 이미 처리됨", refkey);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[alimtalk/result] 기록 실패", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
