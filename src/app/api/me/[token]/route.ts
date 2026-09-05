import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { AGE_RANGE, EVENT, REFUND, REFUND_LAW } from "@/lib/event";
import { formatDeadline } from "@/lib/deadline";
import { isWaitlisted, paidSeats } from "@/lib/seats";
import { bizAccount, bizIdentity } from "@/lib/biz";
import { PAIRED_INDEXES, PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION, QUESTIONS } from "@/lib/form9-copy";
import { guardExposure, resolveMeScreen, type ApplicationStatus } from "@/lib/me-screen";
import type { MeData } from "@/lib/me-response";

/**
 * GET /api/me/[token] — 마이페이지가 볼 화면 하나와, 그 화면에만 필요한 값.
 *
 * 손님이 받는 주소는 `/me/<token>` 하나다(`docs/decisions/003…` 결정 6). 화면
 * 자체(`src/app/me/[token]/page.tsx`)는 서버 컴포넌트지만 **문항을 props로 넘기지
 * 않는다** — 클라이언트가 이 API를 따로 불러 가져온다. 그래서 문항이 응답에 실리는
 * 유일한 경로가 여기 하나로 좁혀진다(이슈 #32).
 *
 * 🔴 **DB row를 통째로 펼치지 않는다.** 화면마다 필요한 값만 골라 담는다
 *    (`src/lib/me-response.ts`의 `MeData`가 그 모양을 못박는다).
 * 🔴 **없는 토큰·틀린 토큰은 조용히 실패하지 않는다.** 빈 화면이나 200으로 얼버무리지
 *    않고 분명히 404를 준다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  status: ApplicationStatus;
  // 🔴 `timestamptz` 컬럼이다. `src/lib/db.ts`가 커스텀 타입 파서를 등록하지 않으므로
  //    `pg`가 기본값대로 **`Date` 객체**를 돌려준다 — `string`으로 적으면 실제 런타임
  //    모양과 다른 타입을 스스로 믿게 된다(지금은 `formatDeadline`이 `Date`도
  //    받아 우연히 돌지만, `.slice()`처럼 문자열 전용 연산을 쓰는 순간 깨진다).
  registered_at: Date | null;
  due_at: Date | null;
  view_override: string | null;
  event_id: number;
  name: string;
  gender: "M" | "F";
  answered_pre_questions: boolean;
};

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rows = await q<Row>(
    `select a.status, a.registered_at, a.due_at, a.view_override, a.event_id,
            p.name, p.gender,
            exists (
              select 1 from answer ans
               where ans.application_id = a.id and ans.form = $2
            ) as answered_pre_questions
       from application a
       join applicant p on p.id = a.applicant_id
      where a.token = $1`,
    [token, PRE_QUESTION_FORM],
  );
  const row = rows[0];
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "링크를 확인해주세요." },
      { status: 404 },
    );
  }

  // 🔴 대기자는 저장된 상태가 아니라 그때그때 센다(`seats.ts`). 이미 자리를 가진
  //    사람(입금완료)은 정의상 대기자일 수 없으므로 그때는 세지도 않는다.
  const waitlisted =
    row.status === "신청함" ? isWaitlisted(await paidSeats(row.event_id), row.gender) : false;

  const screenInput = {
    status: row.status,
    registered: row.registered_at !== null,
    answeredPreQuestions: row.answered_pre_questions,
    waitlisted,
    viewOverride: row.view_override,
  };
  const screen = guardExposure(resolveMeScreen(screenInput), screenInput);

  let data: MeData;
  switch (screen) {
    case "register":
      data = {
        screen,
        name: row.name,
        bizIdentity: bizIdentity(),
        price: EVENT.priceLabel,
        ageRange: AGE_RANGE,
        refund: REFUND,
        refundLaw: REFUND_LAW,
      };
      break;
    case "payment":
      data = {
        screen,
        name: row.name,
        bizAccount: bizAccount(),
        price: EVENT.priceLabel,
        dueAtLabel: row.due_at ? formatDeadline(row.due_at) : null,
      };
      break;
    case "questions":
      data = {
        screen,
        name: row.name,
        formVersion: PRE_QUESTION_FORM_VERSION,
        questions: QUESTIONS,
        pairedIndexes: PAIRED_INDEXES,
      };
      break;
    default:
      data = { screen, name: row.name };
  }

  return NextResponse.json({ ok: true, data });
}
