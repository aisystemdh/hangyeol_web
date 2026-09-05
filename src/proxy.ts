import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSession } from "@/lib/admin";

/**
 * 운영자 화면·API를 통째로 막는 문 하나 (이슈 #34).
 *
 * 🔴 **왜 필요한가** — 지금까지는 라우트마다 손으로 `isAdmin()`을 불렀다. 하나만
 *    빠뜨리면 참가자 20명의 이름·연락처·생년월일이 샌다(`docs/decisions/003…` §8).
 *    이 파일이 주소 패턴으로 먼저 막고, 각 라우트의 `isAdmin()` 확인은
 *    **지우지 않고 이중 방어로 남긴다**(`CLAUDE.md` "화면에서 한 번, API 하나하나에서
 *    또 한 번 막는다").
 *
 * ⚠️ **파일 이름이 `middleware.ts`가 아니라 `proxy.ts`인 이유** — ADR 003 §8과 이슈
 *    본문은 `middleware.ts`를 말하지만, 이 저장소가 쓰는 Next 16.2.12는 그 파일
 *    이름을 **`proxy.ts` + `export function proxy`로 개명**했다(공식 업그레이드
 *    가이드 `docs/01-app/02-guides/upgrading/version-16.mdx` "middleware to
 *    proxy" — `middleware.ts`는 deprecated). 옛 이름을 쓰면 이 버전에서 곧바로
 *    안 되거나 다음 버전에서 지워질 이름을 새로 심는 셈이라 새 이름을 택했다.
 *    역할은 ADR 003이 말하는 미들웨어와 완전히 같다.
 *
 * 🔴 **Node.js 런타임이 기본이라 `node:crypto`가 그대로 된다.** proxy는 edge를
 *    지원하지 않는 대신 runtime을 nodejs로 고정한다 — `isValidSession()`이 쓰는
 *    HMAC 서명 비교(`node:crypto`의 `createHmac`·`timingSafeEqual`)를 그대로
 *    가져다 쓸 수 있는 이유가 이것이다. Edge 런타임이었다면 이 함수를 다시 짜야 했다.
 */

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

/** 비밀번호 화면·로그인 API 자체는 통과시킨다 — 안 그러면 비밀번호를 넣을 주소조차 막힌다. */
function isLoginRoute(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/api/admin/login";
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isLoginRoute(pathname)) return NextResponse.next();

  const raw = request.cookies.get(ADMIN_COOKIE)?.value;
  if (isValidSession(raw)) return NextResponse.next();

  // 🔴 API와 화면은 거절하는 방식이 다르다 — API에 리다이렉트를 주면 fetch가
  //    302를 그대로 삼키고 호출부는 "JSON이 아니다"로만 실패해 원인을 알 수 없다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
