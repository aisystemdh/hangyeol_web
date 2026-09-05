import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { loadApplications, loadSeats } from "@/lib/admin-data";
import type { AdminStatus } from "@/lib/admin-list";

/**
 * GET /api/admin/applications — 신청 목록 (운영자 전용).
 *
 * 🔴 `src/proxy.ts`가 `/api/admin/:path*`를 이미 막고 있지만, 여기서 **다시 한 번**
 *    `isAdmin()`을 확인한다(`CLAUDE.md` "화면에서 한 번, API 하나하나에서 또 한 번").
 *    프록시 하나가 전부를 막는 구조는 그 프록시가 나중에 matcher 실수로 이 라우트를
 *    빠뜨리는 순간 그대로 뚫린다 — 이중 방어의 두 번째 문이 여기다.
 *
 * 서버 컴포넌트(`/admin` 첫 렌더)와 이 라우트(30초 폴링)가 **같은 조회 함수**
 * (`loadApplications`)를 쓴다 — 두 곳에 따로 질의를 두면 새로고침 전후로 목록이
 * 달라 보인다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: readonly AdminStatus[] = ["신청함", "입금완료", "취소됨"];

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const genderParam = url.searchParams.get("gender");

  const status =
    statusParam && (STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AdminStatus)
      : undefined;
  const gender = genderParam === "M" || genderParam === "F" ? genderParam : undefined;

  // 🔴 목록과 자리 현황이 **같은 응답 한 번**에 온다(이슈 #35 AC "남은 자리가 성별로
  //    보인다") — 두 개의 GET으로 나누면 폴링 타이밍이 어긋나 "화면엔 자리가
  //    있는데 방금 입금 확인은 정원초과 경고가 뜨는" 것 같은 혼란이 생긴다.
  const [items, seats] = await Promise.all([loadApplications({ q, status, gender }), loadSeats()]);
  return NextResponse.json({ ok: true, data: { items, seats } });
}
