import { NextResponse } from "next/server";
import { ADMIN_COOKIE, makeSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 느린 응답으로 무차별 대입을 비싸게 만든다. 운영자는 하루 두 번 들어온다. */
const DELAY_MS = 600;

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  await new Promise((r) => setTimeout(r, DELAY_MS));

  const session = makeSession(password ?? "");
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,      // 자바스크립트가 못 읽는다 — XSS로 세션을 훔칠 수 없다
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
