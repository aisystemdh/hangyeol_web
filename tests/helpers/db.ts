import { pool, q } from "@/lib/db";

export { q };

/**
 * 비우지 않는 표.
 *
 * - `schema_migration` — 어디까지 적용했는지의 기록이다. 지우면 매번 처음부터 다시 돈다.
 * - `gender_slot` · `recruit_display` — 마이그레이션이 넣어 둔 행이 **데이터가 아니라
 *   스키마의 일부**다(성별마다 한 줄씩 미리 있어야 한다). 비우는 대신 값만 0으로 되돌린다.
 *   🟡 이 둘은 #30에서 없어진다. 없어지면 아래 되돌리기도 저절로 건너뛴다.
 */
const KEEP = new Set(["schema_migration", "gender_slot", "recruit_display"]);

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

  if (names.includes("gender_slot")) await q(`update gender_slot set taken = 0`);
  if (names.includes("recruit_display")) await q(`update recruit_display set high_water = 0`);
}

/**
 * 연결을 닫는다. 파일마다 끝날 때 부른다.
 * ⚠️ 안 닫으면 vitest가 끝나지 않고 매달린다(열린 소켓이 남는다).
 */
export async function closeDb(): Promise<void> {
  await pool().end();
  globalThis.__hangyeolPool = undefined;
}
