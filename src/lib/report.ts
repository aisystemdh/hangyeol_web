import "server-only";
import { q } from "./db";

/**
 * 리포트 — 이슈 #40.
 *
 * 🔴 **리포트를 만드는 기능은 없다.** 운영자가 따로 만든 PDF를 어딘가(예: 드라이브)에
 *    올리고, 그 링크만 여기 등록한다(`db/migrations/005_rebuild.sql`의 `report` 표 —
 *    `pdf_url` · `published_at`). 파일 자체를 다루는 코드는 이 저장소에 없다.
 *
 * `report.application_id`는 **UNIQUE**다 — 한 신청에 리포트 하나(마이그레이션 §10).
 * 지금은 회차 전체가 같은 모임 하나를 다루므로 사실상 "전체 리포트 링크 하나를
 * 스무 신청 각각에 등록"하는 모양이 되지만, 표는 신청 단위로 둔다 — 다음 회차부터
 * 리포트 내용이 달라질 수 있어서다(2차는 다른 모임의 다른 리포트를 봐야 한다).
 */

export type ReportRow = { pdf_url: string; published_at: Date | null };

/** 이 신청에 등록된 리포트 행. 없으면 undefined — "아직 안 만들었다"와
 *  "만들었지만 아직 공개 안 했다"를 구분하는 것은 이 함수를 부르는 쪽의 몫이 아니라
 *  아래 `visibleReport`의 몫이다(순수 계산과 조회를 분리한다, `seats.ts`와 같은 자리). */
export async function reportForApplication(applicationId: string): Promise<ReportRow | undefined> {
  const rows = await q<ReportRow>(
    `select pdf_url, published_at from report where application_id = $1`,
    [applicationId],
  );
  return rows[0];
}

/**
 * 손님에게 보여줄 링크. 🔴 **`me-response.ts`의 `MeReport`가 이 타입을 그대로
 *    재수출한다** — 둘을 따로 선언하면 나중에 필드 하나(예: 공개일 표시)를 한쪽에만
 *    추가했을 때 컴파일러가 못 잡는다(구조가 같을 뿐 서로 다른 선언이라 타입 검사가
 *    비껴간다). `import type`만 쓰므로 이 파일의 `"server-only"`가 그쪽 번들에
 *    섞이지 않는다(`biz.ts`의 `BizAccount`를 `me-response.ts`가 가져오는 것과 같은 자리).
 */
export type VisibleReport = { url: string };

/**
 * 리포트 행 → 손님이 실제로 볼 수 있는 값.
 *
 * 🔴 **아직 없거나, 공개 시각이 아직 안 됐으면 null이다.** 컬럼 이름 자체가
 *    "만들어 두고 특정 시각에 공개"하려는 의도다(이슈 #40) — `published_at`이 미래면
 *    링크가 있어도 보여주지 않는다. null이 곧 "아직 준비 중"이라는 뜻이고,
 *    화면(`MeEnded.tsx`)이 그 뜻으로 안내 문구를 고른다.
 */
export function visibleReport(row: ReportRow | undefined, now: Date = new Date()): VisibleReport | null {
  if (!row) return null;
  if (!row.published_at) return null;
  if (row.published_at.getTime() > now.getTime()) return null;
  return { url: row.pdf_url };
}
