import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { q, tx } from "@/lib/db";

/**
 * `POST /api/admin/applications/[id]/report` — 리포트 링크·공개 시각 등록(이슈 #40).
 * `GET  /api/admin/applications/[id]/report` — 지금 등록된 값 조회(#34 화면이 폼을 미리 채울 때 쓴다).
 *
 * 🔴 **리포트 PDF를 만드는 기능이 아니다.** 운영자가 따로 만들어 올린 파일의 링크만
 *    받아 적는다(`src/lib/report.ts`, `docs/decisions/003…` §5의 `report` 표).
 *
 * 🔴 **화면에서 한 번, API에서 또 한 번 막는다**(`CLAUDE.md` "라우팅") — #34 운영자
 *    화면이 아직 이 API를 부르는 버튼을 갖추기 전이라도, 주소만 알면 누구나 이 API를
 *    직접 두드릴 수 있으므로 `isAdmin()` 검사가 이 라우트 자체에 있어야 한다.
 *
 * 🔴 **`published_at`이 미래면 손님에게 보이지 않는다**(`src/lib/report.ts`의
 *    `visibleReport`). 그래서 이 라우트는 "등록"과 "공개"를 같은 요청으로 받되
 *    운영자가 미래 시각을 적으면 그 시각까지는 조용히 숨어 있는다 — 컬럼 이름이
 *    가리키는 그 의도 그대로다.
 *
 * 🔴 **`actor`가 필수다.** 운영자 셋이 비밀번호를 공유해 쿠키로는 누가 눌렀는지 알 수
 *    없다(`CLAUDE.md` "라우팅") — 화면에서 고른 이름이 `event_log`에 남는 유일한 흔적이다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error, message }, { status });

/** `pdfUrl`이 그럴듯한 http(s) 주소인지만 본다 — 실제로 열리는지는 확인하지 않는다
 *  (외부 파일 서버까지 이 서버가 확인할 이유가 없다). */
function parsePdfUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return trimmed;
}

/** `null`(안 적음, 값 없음)과 `undefined`(필드 자체가 없음)를 같이 "아직 공개 안 함"으로
 *  받는다 — 운영자가 링크만 먼저 등록해 두고 공개 시각은 나중에 정하는 흐름을 막지
 *  않기 위해서다. 값이 있으면 파싱할 수 있는 날짜여야 한다. */
function parsePublishedAt(v: unknown): { ok: true; value: Date | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: d };
}

type ReportBody = { pdfUrl?: unknown; publishedAt?: unknown; actor?: unknown };

// `application.id`는 uuid 컬럼이다. 모양이 아닌 값을 그대로 질의에 넣으면 Postgres가
// "invalid input syntax for type uuid"로 던져 500이 된다 — 오타 URL 하나가 "없다"는
// 뜻의 404 대신 서버 오류가 되는 셈이다. `src/app/api/alimtalk/result/route.ts`가 같은
// 문제(uuid 모양의 `refkey`)를 같은 정규식으로 막은 것과 같은 이유로 여기도 막는다.
const isUuid = (v: string): boolean => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);

async function findApplicationId(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const rows = await q<{ id: string }>(`select id from application where id = $1`, [id]);
  return rows[0]?.id ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return bad("unauthorized", "로그인이 필요합니다.", 401);

  const { id } = await params;
  const applicationId = await findApplicationId(id);
  if (!applicationId) return bad("not_found", "신청을 찾을 수 없습니다.", 404);

  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return bad("bad_json", "요청을 읽지 못했습니다.");
  }

  const pdfUrl = parsePdfUrl(body.pdfUrl);
  if (!pdfUrl) return bad("bad_pdf_url", "리포트 링크를 확인해주세요.");

  const publishedAtResult = parsePublishedAt(body.publishedAt);
  if (!publishedAtResult.ok) return bad("bad_published_at", "공개 시각을 확인해주세요.");
  const publishedAt = publishedAtResult.value;

  const actor = typeof body.actor === "string" ? body.actor.trim() : "";
  if (!actor) return bad("need_actor", "등록한 사람을 선택해주세요.");

  await tx(async (client) => {
    await client.query(
      `insert into report (application_id, pdf_url, published_at)
       values ($1, $2, $3)
       on conflict (application_id)
       do update set pdf_url = excluded.pdf_url, published_at = excluded.published_at`,
      [applicationId, pdfUrl, publishedAt],
    );
    await client.query(
      `insert into event_log (application_id, kind, actor, meta)
       values ($1, '리포트등록', $2, $3)`,
      [applicationId, actor, JSON.stringify({ pdfUrl, publishedAt: publishedAt?.toISOString() ?? null })],
    );
  });

  return NextResponse.json({
    ok: true,
    data: { applicationId, pdfUrl, publishedAt: publishedAt?.toISOString() ?? null },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return bad("unauthorized", "로그인이 필요합니다.", 401);

  const { id } = await params;
  const applicationId = await findApplicationId(id);
  if (!applicationId) return bad("not_found", "신청을 찾을 수 없습니다.", 404);

  const rows = await q<{ pdf_url: string; published_at: Date | null }>(
    `select pdf_url, published_at from report where application_id = $1`,
    [applicationId],
  );
  const row = rows[0];

  return NextResponse.json({
    ok: true,
    data: {
      pdfUrl: row?.pdf_url ?? null,
      publishedAt: row?.published_at?.toISOString() ?? null,
    },
  });
}
