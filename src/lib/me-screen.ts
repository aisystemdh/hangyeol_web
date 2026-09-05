import { EVENT, EVENT_SCHEMA } from "./event";

/**
 * 마이페이지(`/me/[token]`) 화면 선택.
 *
 * 🔴 **순서가 뜻이다** (`docs/decisions/003-scenario-redesign-2026-09-05.md` §6,
 *    이슈 #32). 위에서부터 맞는 첫 화면이 이긴다. 원칙은 「되돌릴 수 없는 사실이 위,
 *    손님이 지금 해야 할 일이 아래」다 — 그래서 취소·행사종료처럼 더는 손쓸 수 없는
 *    사실이 등록·입금처럼 손님이 지금 할 수 있는 일보다 위에 있다.
 *
 * 이 파일은 **순수 계산만** 한다(DB·시계·환경변수를 직접 읽지 않는다) — 이 저장소는
 * 계산과 「값을 어디서 가져오는가」를 분리해서, 계산은 인자로 받은 값만 보고 검사할 수
 * 있게 한다(`deadline.ts`·`seats.ts`의 순수 함수와 같은 자리다). 부르는 쪽
 * (`/api/me/[token]/route.ts`)이 서버 시각과 DB 값을 읽어 여기에 넘긴다.
 */

export type ApplicationStatus = "신청함" | "입금완료" | "취소됨";

/** 화면 이름. 🔴 이 문자열이 곧 `application.view_override`에 운영자가 적어 넣을
 *  값이기도 하다(결정 13) — 화면 판정과 운영자 강제가 **같은 어휘**를 쓰게 해서,
 *  화면이 늘어도 "그 화면을 가리키는 두 번째 이름"이 생기지 않게 한다. */
export type MeScreenName =
  | "cancelled" // 1 취소됨        → 취소 안내
  | "ended" // 2 행사가 끝났다  → 후기 · 리포트
  | "eventDay" // 3 오늘이 행사날  → 당일 안내
  | "waitlisted" // 4 대기자다      → 대기 안내
  | "register" // 5 정식등록 안 함 → 등록 화면
  | "payment" // 6 입금 미확인    → 계좌 · 금액 · 기한
  | "questions" // 7 사전질문 안 냄 → 문항 열 개
  | "confirmed"; // 8 다 함        → 확정 안내

/** 운영자가 `view_override`에 적을 수 있는 값 전부. 모르는 문자열이 들어오면
 *  무시하고 자동 판정으로 돌아간다 — 오타 하나로 손님이 빈 화면에 갇히지 않게 한다. */
const SCREEN_NAMES: readonly MeScreenName[] = [
  "cancelled",
  "ended",
  "eventDay",
  "waitlisted",
  "register",
  "payment",
  "questions",
  "confirmed",
];

export function isMeScreenName(v: string | null | undefined): v is MeScreenName {
  return !!v && (SCREEN_NAMES as readonly string[]).includes(v);
}

/**
 * 지금이 행사에 대해 어떤 시점인가. `EVENT.dateISO` 기준으로 서버 시각을 계산한다
 * (`docs/decisions/003` — 클라이언트 시각을 믿지 않는다).
 *
 * 🔴 "행사가 끝났다"의 경계는 **자정이 아니라 행사 종료 시각**(`EVENT_SCHEMA.endISO`,
 *    21:00 KST)이다. 자정까지 기다리면 21시에 행사가 끝난 뒤에도 두세 시간
 *    "당일 안내"(입장 시각·장소)가 떠서 이미 끝난 행사를 준비하라고 말하게 된다.
 *
 * ⚠️ **`EVENT`는 지금 1차 하나뿐이다.** DB의 `application.event_id`가 다른 회차를
 *    가리켜도 이 함수는 여전히 1차 날짜로 판단한다 — 이 저장소 전체가 지금 그렇게
 *    돼 있다(`apply/route.ts`도 `EVENT.id`를 그대로 쓴다). 2차 회차를 열 때 함께
 *    고칠 것(회차별 날짜를 어디서 가져올지는 그때 정한다).
 */
function eventPhase(now: Date): "before" | "eventDay" | "ended" {
  const dayStart = new Date(`${EVENT.dateISO}T00:00:00+09:00`);
  const dayEnd = new Date(EVENT_SCHEMA.endISO);
  if (now.getTime() >= dayEnd.getTime()) return "ended";
  if (now.getTime() >= dayStart.getTime()) return "eventDay";
  return "before";
}

export type ResolveScreenInput = {
  status: ApplicationStatus;
  /** 정식등록을 마쳤는가(`application.registered_at`이 있는가). */
  registered: boolean;
  /** 사전질문 열 문항에 답했는가(`answer`에 그 폼의 행이 있는가). */
  answeredPreQuestions: boolean;
  /** 지금 신청하면(또는 아직 입금 전이면) 대기자로 판정되는가.
   *  🔴 **`status`가 `입금완료`면 이 값과 무관하게 대기자일 수 없다** — 자리는
   *  입금완료 순간에만 차므로 이미 자리를 가진 사람이다. 부르는 쪽이 이 규칙을
   *  지키지 않아도(예: 실수로 true를 넘겨도) 아래에서 `status`를 먼저 본다. */
  waitlisted: boolean;
  /** 운영자가 화면을 고정했다면 그 값(`application.view_override`). 없으면 null. */
  viewOverride: string | null;
};

/** 손님이 지금 봐야 할 화면 하나를 고른다. */
export function resolveMeScreen(input: ResolveScreenInput, now: Date = new Date()): MeScreenName {
  // 🔴 결정 13 — 운영자가 고정한 화면이 이 순서 전체를 무시한다.
  if (isMeScreenName(input.viewOverride)) return input.viewOverride;

  if (input.status === "취소됨") return "cancelled";

  const phase = eventPhase(now);
  if (phase === "ended") return "ended";
  if (phase === "eventDay") return "eventDay";

  // 대기자는 입금완료(=자리를 가짐) 상태에서는 성립하지 않는다.
  if (input.status === "신청함" && input.waitlisted) return "waitlisted";

  if (!input.registered) return "register";
  if (input.status !== "입금완료") return "payment";
  if (!input.answeredPreQuestions) return "questions";
  return "confirmed";
}

/**
 * 🔴 **정보 노출 경계는 화면 이름보다 세다.**
 *
 * `view_override`(결정 13)는 화면 순서를 무시할 수 있지만, "정식등록 전 계좌 없음"·
 * "입금완료 아니면 문항 없음"은 순서 문제가 아니라 **그 자체로 지켜야 하는 규칙**이다
 * (`docs/decisions/003…` §6 정보 노출 표 — "문항 방어의 실체는 토큰이 아니라
 * 「입금완료」다"). 운영자가 화면 고정 값을 잘못 입력해도(오타·착오) 계좌나 문항이
 * 새면 안 되므로, `resolveMeScreen`이 고른 화면을 그대로 믿지 않고 여기서 한 번 더
 * 사실 관계를 맞춰 본다. 어긋나면 그 사람이 실제로 있는 단계로 조용히 되돌린다.
 */
export function guardExposure(screen: MeScreenName, input: ResolveScreenInput): MeScreenName {
  // 🔴 취소된 사람은 화면 이름이 무엇으로 고정됐든 계좌도 문항도 못 본다 — "정식등록을
  //    했었다"는 과거 사실이 남아 있어도(`registered`가 true), 취소는 그보다 위다.
  //    아래 두 줄만으로는 안 잡힌다 — `registered: true`인 취소된 사람이 "questions"로
  //    고정되면 "payment"로 떨어져 **계좌가 새는** 조합이 실제로 있었다.
  if (input.status === "취소됨" && (screen === "payment" || screen === "questions")) {
    return "cancelled";
  }
  if (screen === "payment" && !input.registered) return "register";
  if (screen === "questions" && input.status !== "입금완료") {
    return input.registered ? "payment" : "register";
  }
  return screen;
}
