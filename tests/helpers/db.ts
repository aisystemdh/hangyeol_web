import { readFileSync } from "node:fs";
import { pool, q } from "@/lib/db";
import { EVENT } from "@/lib/event";

export { q };

/**
 * 비우지 않는 표.
 *
 * - `schema_migration` — 어디까지 적용했는지의 기록이다. 지우면 매번 처음부터 다시 돈다.
 * - `event`(회차) — 마이그레이션이 넣어 둔 1차 행이 **데이터가 아니라 스키마의 일부**다.
 *   🔴 신청도 돈 줄도 이 행을 참조하므로 비우면 **모든 테스트가 외래키에서 막힌다.**
 *   회차 행에는 테스트가 더럽힐 카운터가 없어서 되돌릴 것도 없다.
 */
const KEEP = new Set(["schema_migration", "event"]);

/**
 * 테스트 하나가 시작하기 전에 DB를 빈 상태로 되돌린다.
 *
 * 🔴 **표 목록을 여기 적어 두지 않고 DB에 물어본다.** 적어 두면 #30에서 표가 통째로
 *    바뀔 때 이 목록만 옛것으로 남고, 남은 데이터가 다음 테스트에 새어 들어간다.
 *
 * ⚠️ 「각 테스트가 자기가 쓴 것을 지운다」 대신 「시작할 때 비운다」로 잡았다.
 *    테스트가 도중에 실패하면 뒷정리가 안 도는데, 그때 다음 테스트까지 같이
 *    무너지면 **진짜로 깨진 곳이 어디인지** 보이지 않는다.
 */
export async function resetDb(): Promise<void> {
  const rows = await q<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const names = rows.map((r) => r.table_name);

  const wipe = names.filter((n) => !KEEP.has(n));
  if (wipe.length > 0) {
    // restart identity — seq 번호까지 1로 되돌린다. cascade — 참조하는 표도 함께.
    await q(`truncate ${wipe.map((n) => `"${n}"`).join(", ")} restart identity cascade`);
  }

  // 🔴 회차 표는 비우지 않지만(외래키가 전부 여기 붙는다) **테스트가 세운 회차는
  //    지운다.** 2차 회차를 만들어 보는 검사가 있고, 그게 남으면 다음 검사가
  //    「회차가 하나여야 한다」에서 엉뚱하게 깨진다.
  await q(`delete from event where id <> $1`, [EVENT.id]);

  await reseedTemplates();
}

/**
 * 알림톡 문구 아홉 개를 도로 세운다.
 *
 * 문구는 **데이터**다 — 운영자가 배포 없이 고칠 수 있어야 하므로 DB에 있고, 그래서
 * 표를 비울 때 같이 비워진다. 그런데 신청 API는 저장 직후 문구를 찾아 보내므로
 * 아무것도 없으면 모든 신청 검사가 「문구 없음」으로 실패한다.
 *
 * 🔴 **테스트용 문구를 따로 적어 두지 않고 마이그레이션 파일을 그대로 다시 돌린다.**
 *    두 벌이 되면 문구를 고칠 때마다 한쪽이 뒤처지고, **테스트는 통과하는데 배포하면
 *    깨진다**(테스트 스키마를 따로 안 적는 것과 같은 이유다). 덕분에 검사가 실제로
 *    손님에게 나갈 그 문구를 보고, 「없는 변수를 썼다」 같은 실수가 여기서 잡힌다.
 *
 * ⚠️ `q()`가 아니라 풀에 직접 던진다. 값 배열을 함께 넘기면 pg가 확장 프로토콜을 써서
 *    **문장 하나만** 허용하는데, 이 파일에는 문장이 여럿 있다.
 */
let seedSql: string | null = null;

async function reseedTemplates(): Promise<void> {
  seedSql ??= readFileSync(
    new URL("../../db/migrations/006_templates.sql", import.meta.url),
    "utf8",
  );
  await pool().query(seedSql);
}

/**
 * 연결을 닫는다. 파일마다 끝날 때 부른다.
 * ⚠️ 안 닫으면 vitest가 끝나지 않고 매달린다(열린 소켓이 남는다).
 */
export async function closeDb(): Promise<void> {
  await pool().end();
  globalThis.__hangyeolPool = undefined;
}
