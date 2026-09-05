import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `.env.local`을 읽어 `process.env`에 올린다.
 *
 * dotenv를 넣지 않는 이유 — 이 저장소는 이미 `db/migrate.mjs`에서 같은 파일을 손으로
 * 읽고 있고, 이것 하나 때문에 의존성을 늘릴 이유가 없다.
 *
 * ⚠️ **이미 들어 있는 값이 이긴다.** CI나 명령줄에서 준 값을 파일이 덮어쓰면
 *    「분명히 바꿔서 실행했는데 안 바뀐다」가 된다.
 */
export function loadEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return; // 파일이 없어도 계속 간다. 값이 정말 없으면 아래 guard가 잡는다.
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * DB 주소에서 「어느 데이터베이스인가」만 뽑는다.
 * Neon은 같은 데이터베이스에 풀러 주소(`-pooler`)와 직결 주소 둘을 주므로,
 * 호스트를 그대로 비교하면 **같은 곳인데 다르다고 판정**한다.
 */
function whichDatabase(url: string): string {
  const u = new URL(url);
  return `${u.host.replace("-pooler", "")}${u.pathname}`;
}

/**
 * 두 주소가 **같은 데이터베이스**를 가리키는가.
 * 🔴 이 한 줄이 실제 신청자 명단과 테스트 사이에 서 있는 전부다.
 */
export function sameDatabase(a: string, b: string): boolean {
  return whichDatabase(a) === whichDatabase(b);
}

/**
 * 테스트가 붙을 DB 주소.
 *
 * 🔴 **실제 데이터를 절대 건드리지 않는다.** 테스트는 매번 표를 통째로 비우므로,
 *    주소가 하나라도 어긋나면 신청자 명단이 사라진다. 그래서 값이 없거나 운영
 *    데이터베이스와 같으면 **테스트를 아예 시작하지 않는다.** 조용히 넘어가지 않는다.
 *
 * ⚠️ 비교 대상을 인자로 받는다. 준비 단계가 `DATABASE_URL`을 테스트 주소로 바꿔 끼운
 *    **뒤에** 이 함수를 또 부르면, `process.env`를 그대로 읽는 방식은 「둘이 같다」고
 *    잘못 판정한다(파일마다 프로세스가 새로 뜨지 않는 설정에서 실제로 그렇게 된다).
 */
export function testDatabaseUrl(liveUrl = process.env.DATABASE_URL): string {
  const test = process.env.TEST_DATABASE_URL;
  if (!test) {
    throw new Error(
      "TEST_DATABASE_URL이 없습니다.\n" +
        "  테스트는 표를 통째로 비우므로 전용 데이터베이스가 반드시 있어야 합니다.\n" +
        "  Neon 콘솔에서 데이터베이스를 하나 더 만들고 .env.local에 적으세요.",
    );
  }
  if (liveUrl && sameDatabase(liveUrl, test)) {
    throw new Error(
      "TEST_DATABASE_URL이 DATABASE_URL과 같은 데이터베이스를 가리킵니다.\n" +
        "  이대로 돌리면 실제 신청자 데이터가 지워집니다. 테스트를 중단합니다.",
    );
  }
  return test;
}
