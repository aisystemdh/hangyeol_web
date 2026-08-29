import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { isAdmin, newToken } from "@/lib/admin";
import { SITE_URL } from "@/lib/site";
import { sendPreLink, sendQuestionLink } from "@/lib/notify";

/**
 * POST /api/admin/applicants/:id/token — 참가자 링크 발급
 *
 * `{ stage: "pre" | "q" }`
 *
 * 🔴 1단계와 2단계 토큰을 **따로** 발급한다. 같은 토큰을 쓰면 1단계 링크를 받은
 *    사람이 주소만 `/pre/`→`/q/`로 바꿔 문항을 열 수 있다. 쪼갠 의미가 사라진다.
 *
 * ⚠️ 이미 발급된 토큰이 있으면 **다시 만들지 않고 그대로 돌려준다.**
 *    새로 만들면 이미 보낸 알림톡의 링크가 죽는다.
 *
 * 🟡 알림톡 플랫폼이 아직 미정이라 지금은 **링크만 돌려준다.**
 *    플랫폼이 정해지면 `notify.ts`의 두 함수 몸통만 채우면 되고 여기는 안 고친다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  name: string;
  phone: string;
  status: string;
  pre_token: string | null;
  q_token: string | null;
  due_at: string | null;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await ctx.params;
  const { stage } = (await req.json().catch(() => ({}))) as { stage?: string };
  if (stage !== "pre" && stage !== "q") {
    return NextResponse.json({ ok: false, error: "bad_stage" }, { status: 400 });
  }

  try {
    const rows = await q<Row>(
      `select name, phone, status, pre_token, q_token, due_at::text as due_at
         from applicant where id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const a = rows[0];

    // 🔴 2단계는 입금이 확인된 사람에게만. 링크를 미리 주면 그 자체가 유출 경로가 된다.
    if (stage === "q" && a.status !== "confirmed") {
      return NextResponse.json(
        { ok: false, error: "not_confirmed", status: a.status },
        { status: 409 },
      );
    }

    const col = stage === "pre" ? "pre_token" : "q_token";
    const atCol = stage === "pre" ? "pre_link_at" : "q_link_at";
    let token = stage === "pre" ? a.pre_token : a.q_token;

    if (!token) {
      token = newToken();
      await q(`update applicant set ${col} = $2 where id = $1`, [id, token]);
    }
    // 링크를 만든(=보낼 준비가 된) 시각. 화면이 「보냈나」를 보여주는 근거다.
    await q(`update applicant set ${atCol} = now() where id = $1`, [id]);

    const url = `${SITE_URL}/${stage === "pre" ? "pre" : "q"}/${token}`;

    // 🟡 지금은 아무것도 보내지 않고 링크만 돌려준다. 위 주석 참조.
    const sent =
      stage === "pre"
        ? await sendPreLink({ name: a.name, phone: a.phone, url, dueAt: a.due_at })
        : await sendQuestionLink({ name: a.name, phone: a.phone, url });

    return NextResponse.json({ ok: true, url, sent });
  } catch (e) {
    console.error("[admin/token] 실패", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
