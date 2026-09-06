import type { MeScreenName } from "./me-screen";

/**
 * 운영자 신청 목록 — 순수 판정 로직만 모은 자리 (이슈 #34).
 *
 * `deadline.ts`·`seats.ts`·`me-screen.ts`와 같은 자리다 — DB·시계·환경변수를 직접
 * 읽지 않고, 부르는 쪽(`admin-data.ts`)이 값을 가져와 넘긴다. 그래서 "기한이
 * 12시간 미만인가"·"검색어에 걸리는가" 같은 규칙을 DB 없이도 눈으로 따라갈 수 있다.
 *
 * ⚠️ **이 파일만 따로 검사하는 테스트를 만들지 않는다** — `CLAUDE.md` "테스트"가
 *    정한 대로, 이 저장소는 계산이 아니라 "새는 것"을 무서워한다. 여기 있는 함수는
 *    `GET /api/admin/applications` 라우트가 실제로 부르고, 검사도 그 라우트를
 *    통해서 한다(`tests/admin.test.ts`) — `isRealDate`·`resolveMeScreen`이 각각
 *    `apply.test.ts`·`me.test.ts`에서 라우트로만 검사되는 것과 같은 이유다.
 */

export type AdminStatus = "신청함" | "입금완료" | "취소됨";

export type AdminApplicationRow = {
  id: string;
  seq: number;
  status: AdminStatus;
  /** 그때그때 세어서 판단한 값 — `CONTEXT.md` 「대기자」. `상태='신청함'`일 때만 의미가 있다. */
  waitlisted: boolean;
  name: string;
  gender: "M" | "F";
  age: number;
  phone: string;
  appliedAt: string; // ISO
  dueAt: string | null; // ISO
  /** 🔴 AC — 기한이 12시간 미만 남은 사람이 눈에 띄어야 한다. */
  dueSoon: boolean;
  lastNotifiedAt: string | null; // ISO
  lastNotifiedLabel: string | null;
  lastNotifiedStatus: string | null;
  /** `application.view_override`가 있으면 true — 목록에 「화면 고정됨」으로 뜬다. */
  screenLocked: boolean;
  viewOverride: MeScreenName | null;
  /**
   * 🔴 이 사람의 입금 줄 중 하나라도 기대 금액과 다르면 true(이슈 #35).
   *    막지 않고 목록에 표시만 남긴다 — `docs/decisions/003…` §7.
   */
  amountMismatch: boolean;
  /** 현장 이름표 번호(1~20). 행사 며칠 전 일괄 배정 전에는 null(이슈 #39). */
  nick: number | null;
};

/**
 * 기한 임박 기준. 🔴 12시간 — 이슈 #34 AC 원문 그대로("기한이 12시간 미만 남은
 * 사람이 시각적으로 눈에 띈다"). 운영자가 하루 두 번(아침·저녁) 입금을 확인하는
 * 주기(`admin.ts`의 세션 TTL 12시간과 같은 근거)라 한 번 확인을 건너뛰면 다음
 * 확인 전에 기한을 넘길 수 있는 사람을 이 값이 미리 짚어 준다.
 */
export const DUE_SOON_HOURS = 12;

export function hoursLeft(dueAt: Date, now: Date): number {
  return (dueAt.getTime() - now.getTime()) / 3_600_000;
}

/**
 * 지금 눈에 띄어야 하는 사람인가.
 *
 * 🔴 **`신청함` 상태에만 의미가 있다.** `입금완료`·`취소됨`은 자리 문제가 끝난
 *    사람이라 기한이 지나든 말든 더는 시계가 뜻이 없고, 대기자는 애초에
 *    `due_at`이 비어 있다(`CONTEXT.md` 「기한」). 이미 지난 기한(음수)도
 *    "12시간 미만 남음"에 해당하므로 계속 강조한다 — 지난 기한을 조용히
 *    꺼버리면 운영자가 잊는다.
 */
export function isDueSoon(status: AdminStatus, dueAt: Date | null, now: Date): boolean {
  if (status !== "신청함" || !dueAt) return false;
  return hoursLeft(dueAt, now) < DUE_SOON_HOURS;
}

export type AdminListFilter = {
  /** 이름 또는 연락처 검색어. */
  q?: string;
  status?: AdminStatus;
  gender?: "M" | "F";
};

/** 연락처 검색은 하이픈·공백을 무시한다 — "010-1234"로 찾아도 "01012345678"에 걸려야 한다. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function matchesSearch(row: { name: string; phone: string }, q: string): boolean {
  const needle = q.trim();
  if (!needle) return true;
  if (row.name.includes(needle)) return true;
  const needleDigits = digitsOnly(needle);
  return needleDigits.length > 0 && digitsOnly(row.phone).includes(needleDigits);
}

/** 목록 하나에 검색어·상태·성별 필터를 함께 적용한다. */
export function filterApplications<
  T extends { name: string; phone: string; status: AdminStatus; gender: "M" | "F" },
>(rows: readonly T[], filter: AdminListFilter): T[] {
  return rows.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.gender && r.gender !== filter.gender) return false;
    if (filter.q && !matchesSearch(r, filter.q)) return false;
    return true;
  });
}
