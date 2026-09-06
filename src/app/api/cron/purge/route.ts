import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPurge } from "@/lib/purge";

/**
 * GET /api/cron/purge — 개인정보 파기를 도는 유일한 주소 (이슈 #42 AC "일정 실행이
 * 부르는 관리자 주소 하나로 만든다 — 별도 실행 방식을 만들지 않는다").
 *
 * 🔴 **`/api/admin/**`이 아니다.** 그 아래 전부는 `src/proxy.ts`가 운영자 로그인
 *    쿠키를 요구한다(`CLAUDE.md` "화면에서 한 번, API 하나하나에서 또 한 번") — 그런데
 *    이 주소를 부르는 건 사람이 아니라 Vercel Cron이라 쿠키를 들고 올 수 없다.
 *    그래서 별도 경로로 두고, 인증은 **`CRON_SECRET`** 하나로 대신한다: 이 값을 Vercel
 *    환경변수에 넣으면 Vercel Cron이 자동으로 `Authorization: Bearer <값>`을 붙여
 *    보낸다(Vercel 공식 크론 인증 방식). `vercel.json`의 `crons`가 이 경로를 하루
 *    한 번 부르게 등록한다.
 *
 * 🔴 `ADMIN_PASSWORD`(`src/lib/admin.ts`)와 같은 이유로 **기본값을 두지 않는다** —
 *    깜빡한 채 배포되면 조용히 아무나 파기를 돌릴 수 있는 것보다, 값이 없을 때
 *    확실하게 500으로 터지는 편이 낫다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET이 없습니다.");
  return s;
}

/** ⚠️ `===`가 아니라 길이를 맞춘 뒤 `timingSafeEqual` — 앞부분이 맞을수록 응답이 느려지는 것으로 값을 알아내지 못하게 한다(`admin.ts`의 세션 비교와 같은 이유). */
function isAuthorized(req: Request): boolean {
  const want = Buffer.from(`Bearer ${secret()}`);
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runPurge();
  return NextResponse.json({ ok: true, data: result });
}
