import { NextResponse } from "next/server";
import { isAdmin, normalizeActor } from "@/lib/admin";
import { setViewOverride } from "@/lib/admin-data";
import { isMeScreenName, type MeScreenName } from "@/lib/me-screen";

/**
 * POST /api/admin/applications/[id]/screen — 화면 고정 · 해제 (결정 13, 이슈 #34).
 *
 * body: `{ screen: MeScreenName | null, actor: string }`.
 * `screen`이 `null`이면 고정을 풀고 자동 판정으로 돌린다.
 *
 * 🔴 **`actor`가 필수다.** 운영자 셋이 비밀번호를 공유해 쿠키로는 누가 눌렀는지
 *    알 수 없다(`CONTEXT.md`) — 그래서 이 조작은 화면에서 이름을 고르게 하고,
 *    그 이름이 여기로 온다. `SITE.operators`(브랜드 운영자 명단의 정본, `site.ts`)에
 *    없는 이름은 거절한다 — 오타나 자유 입력으로 남을 "이름"이 기록에 쌓이면
 *    나중에 분쟁이 났을 때 누구인지 특정할 수 없다.
 *
 * `prompt()`/`confirm()`을 쓰지 않는다(AC) — 화면(드로어)이 `<select>`로 이름과
 * 화면을 고르게 하고, 이 라우트로 fetch만 보낸다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { screen?: unknown; actor?: unknown };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const actor = normalizeActor(body.actor);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "invalid_actor", message: "조작하는 사람을 목록에서 골라주세요." },
      { status: 400 },
    );
  }

  // `null`은 "고정 해제"라는 뜻이 있는 값이라 명시적으로 받아준다.
  // 그 밖에 문자열이면 반드시 `MeScreenName` 중 하나여야 한다 — 모르는 값이
  // DB에 들어가면 `me-screen.ts`의 `isMeScreenName`이 조용히 무시해 손님이
  // 엉뚱한 화면 대신 자동 판정을 보게 되지만, 운영자 화면에서는 그 실수를
  // 애초에 걸러 「방금 고정한 화면이 실제로 반영되지 않았다」는 혼란을 막는다.
  const raw = body.screen;
  let screen: MeScreenName | null;
  if (raw === null) {
    screen = null;
  } else if (typeof raw === "string" && isMeScreenName(raw)) {
    screen = raw;
  } else {
    return NextResponse.json(
      { ok: false, error: "invalid_screen", message: "알 수 없는 화면입니다." },
      { status: 400 },
    );
  }

  const ok = await setViewOverride(id, screen, actor);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
