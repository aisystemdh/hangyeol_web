import { NextResponse } from "next/server";
import { q, tx } from "@/lib/db";
import { AGE_RANGE, EVENT, REFUND, REFUND_LAW } from "@/lib/event";
import { formatDeadline } from "@/lib/deadline";
import { isWaitlisted, paidSeats } from "@/lib/seats";
import { bizAccount, bizIdentity } from "@/lib/biz";
import { PAIRED_INDEXES, PRE_QUESTION_FORM, PRE_QUESTION_FORM_VERSION, QUESTIONS } from "@/lib/form9-copy";
import { guardExposure, resolveMeScreen, type ApplicationStatus } from "@/lib/me-screen";
import { reportForApplication, visibleReport } from "@/lib/report";
import type { MeData } from "@/lib/me-response";

/**
 * GET /api/me/[token] — 마이페이지가 볼 화면 하나와, 그 화면에만 필요한 값.
 * POST /api/me/[token] — 정식등록(이슈 #33). 같은 파일에 둔 이유는 손님이 받는
 * 주소가 `/me/<token>` 하나이듯(결정 6), 그 주소가 가리키는 API 자원도 하나이기
 * 때문이다 — GET은 지금 볼 화면, POST는 그 화면(등록) 중 하나가 받는 제출이다.
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

const bad = (error: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error, message }, { status });

type Row = {
  id: string;
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
    `select a.id, a.status, a.registered_at, a.due_at, a.view_override, a.event_id,
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
  if (!row) return bad("not_found", "링크를 확인해주세요.", 404);

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
    case "ended":
      // 🔴 리포트는 이 화면일 때만 조회한다 — 다른 화면은 볼 필요도, 볼 자격도 없다.
      data = { screen, name: row.name, report: visibleReport(await reportForApplication(row.id)) };
      break;
    default:
      data = { screen, name: row.name };
  }

  return NextResponse.json({ ok: true, data });
}

/** POST 핸들러 내부에서만 쓰는 표시자 — 상태 검사와 UPDATE 사이에 취소가 끼어든
 *  경우를 tx 안에서 위로 알린다(아래 "동시성" 주석 참고). */
class RegistrationRaceCancelled extends Error {}

type RegisterBody = {
  marital?: unknown;
  job?: unknown;
  email?: unknown;
  depositor_name?: unknown;
  truth_agreed?: unknown;
  refund_agreed?: unknown;
  email_agreed?: unknown;
};

/**
 * POST /api/me/[token] — 정식등록(`docs/decisions/003…` §6 우선순위 5, 이슈 #33).
 *
 * 🔴 **순서가 이유다.** 환불 규정에 동의하지 않은 사람에게 계좌를 보여주고 돈부터
 *    받으면, 나중에 환불 다툼이 났을 때 "동의했다"는 근거가 없다. 그래서 계좌는
 *    이 라우트가 성공한 **뒤에** `GET`이 새로 고른 "payment" 화면에서만 내려온다 —
 *    이 라우트는 `bizAccount()`를 아예 부르지 않는다(`biz.ts`가 신원·계좌를 쪼갠 이유).
 *
 * 🔴 **동의는 「했다」가 아니라 「언제 했다」로 남긴다**(개인정보보호법 §22,
 *    `db/migrations/005_rebuild.sql` "동의" 절). `privacy_agreed_at`·
 *    `marketing_agreed_at`은 신청 단계(`/api/apply`)에서 이미 받았으므로 여기서
 *    다시 묻지 않는다 — 여기서 받는 것은 `truth_agreed_at`(입력한 내용이 사실이라는
 *    동의)·`refund_agreed_at`(환불 규정 동의)·`email_agreed_at`(이메일 제공 시에만,
 *    리포트 수신 동의) 셋이다.
 *
 * 🔴 **두 번 내도 이상해지지 않는다.** 재제출은 최신 값으로 **덮어쓴다** — 취소된
 *    신청만 막는다(과거에 등록했던 이력이 있어도 취소 이후 값을 더 낼 이유가 없다).
 *    `due_at`·`paid_at`·`status`는 이 UPDATE가 손대는 컬럼 목록에 아예 없으므로,
 *    이미 입금완료된 사람이 등록 정보를 고쳐도 기한·자리 계산이 흔들리지 않는다.
 *
 * ⚠️ **동시성 — 상태를 두 번 본다.** 위의 취소 검사(SELECT)와 아래 UPDATE 사이에
 *    운영자가 그 신청을 취소할 수도 있다(#34가 취소 버튼을 세우면). 그래서 UPDATE
 *    자체에도 `status <> '취소됨'` 조건을 걸고, 바뀐 행이 0개면(그사이 취소됐다는
 *    뜻) 트랜잭션을 굴리지 않고 이미 위에서 확인한 것과 같은 409를 준다 — SELECT
 *    한 번으로 "취소 아님"을 확인했다고 믿지 않는다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return bad("bad_json", "요청을 읽지 못했습니다.");
  }

  const marital = body.marital === "미혼" || body.marital === "기혼" ? body.marital : null;
  if (!marital) return bad("bad_marital", "혼인 여부를 선택해주세요.");

  const job = typeof body.job === "string" ? body.job.trim() : "";
  if (job.length < 1 || job.length > 40) return bad("bad_job", "직업을 입력해주세요.");

  // 🟡 선택 항목. 리포트를 메일로도 받고 싶은 분만 적는다 — 비워도 등록이 된다.
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  if (emailRaw && (emailRaw.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))) {
    return bad("bad_email", "이메일 주소를 확인해주세요.");
  }
  const email = emailRaw || null;

  // 신청자 본인이 입금하면 비운다. 다르면(부모·배우자·회사 명의) 여기 적는다.
  const depositorRaw = typeof body.depositor_name === "string" ? body.depositor_name.trim() : "";
  if (depositorRaw.length > 20) return bad("bad_depositor_name", "입금자명을 확인해주세요.");
  const depositorName = depositorRaw || null;

  if (body.truth_agreed !== true) {
    return bad("need_truth", "입력하신 내용이 사실임에 동의해주세요.");
  }
  if (body.refund_agreed !== true) {
    return bad("need_refund", "환불 규정에 동의해주세요.");
  }
  // 🔴 이메일을 적었으면 그 이메일로 뭔가를 보내겠다는 동의가 따로 필요하다
  //    (개인정보보호법 §22 — 목적마다 동의를 나눠 받는다). 안 적었으면 물을 대상 자체가
  //    없으므로 이 검사도, `email_agreed_at`도 건너뛴다.
  if (email && body.email_agreed !== true) {
    return bad("need_email_agreed", "이메일 수신에 동의해주세요.");
  }

  const rows = await q<{ id: string; status: ApplicationStatus; already: boolean }>(
    `select id, status, (registered_at is not null) as already
       from application where token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row) return bad("not_found", "링크를 확인해주세요.", 404);
  // 🔴 취소된 신청은 등록 자체를 받지 않는다 — `guardExposure`가 어차피 "cancelled"
  //    화면만 보여주지만, 화면 검증을 믿지 않으므로(`CLAUDE.md` "라우팅") 여기서도 막는다.
  //
  // ⚠️ 대기자(`waitlisted`)는 여기서 막지 않는다 — 의도적이다. `resolveMeScreen`은
  //    대기자에게 "register" 화면을 보여주지 않지만(우선순위 4가 5보다 위), 그건
  //    화면 노출 순서일 뿐 등록 자체를 금지하는 규칙이 아니다. 대기 중에 정보를
  //    먼저 채워 두면 자리가 났을 때 한 단계를 던다 — 계좌·문항 같은 민감한 값이
  //    새는 것도 아니므로(POST 응답에 `bizAccount`가 없다) 막을 이유가 없다.
  if (row.status === "취소됨") {
    return bad("cancelled", "취소된 신청은 등록할 수 없습니다.", 409);
  }

  const now = new Date();
  try {
    await tx(async (client) => {
      const updated = await client.query(
        `update application
            set registered_at = $2, marital = $3, job = $4, email = $5,
                depositor_name = $6, truth_agreed_at = $2, refund_agreed_at = $2,
                email_agreed_at = $7
          where id = $1 and status <> '취소됨'`,
        [row.id, now, marital, job, email, depositorName, email ? now : null],
      );
      if (updated.rowCount === 0) throw new RegistrationRaceCancelled();

      // 🔴 PII를 한 번 더 복제하지 않는다 — meta에는 "다시 냈는가"만 남긴다. 실제
      //    값(혼인 여부·직업·이메일)은 이미 application 행 하나에만 있다.
      await client.query(
        `insert into event_log (application_id, kind, actor, meta)
         values ($1, '정식등록', 'guest', $2)`,
        [row.id, JSON.stringify({ reRegistered: row.already })],
      );
    });
  } catch (err) {
    if (err instanceof RegistrationRaceCancelled) {
      return bad("cancelled", "취소된 신청은 등록할 수 없습니다.", 409);
    }
    throw err;
  }

  return NextResponse.json(
    { ok: true, data: { registeredAt: now.toISOString() } },
    { status: 200 },
  );
}
