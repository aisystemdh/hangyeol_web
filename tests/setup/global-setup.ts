import { loadEnvLocal, testDatabaseUrl } from "./env";

/**
 * 전체에서 한 번만 도는 준비 단계 — **테스트 DB에 스키마를 세운다.**
 *
 * 🔴 스키마를 여기에 다시 적지 않고 `db/migrations/`를 그대로 돌린다.
 *    두 벌로 두면 마이그레이션을 더할 때마다 한쪽이 반드시 뒤처지고,
 *    그러면 테스트는 통과하는데 배포하면 깨진다.
 */
export default async function setup(): Promise<void> {
  loadEnvLocal();
  const url = testDatabaseUrl();

  const { migrate } = await import("../../db/migrate.mjs");
  const { applied, tables } = await migrate(url, () => {});

  if (tables.length === 0) {
    throw new Error("테스트 DB에 표가 하나도 서지 않았습니다. 마이그레이션을 확인하세요.");
  }
  if (applied > 0) {
    console.log(`[테스트 DB] 마이그레이션 ${applied}건 적용 · 표 ${tables.length}개`);
  }
}
