import { Pool, type QueryResultRow } from "pg";

/**
 * Postgres 연결. Vercel 마켓플레이스의 Neon이 `DATABASE_URL`을 주입한다.
 *
 * ⚠️ **풀러(pooler) 주소를 쓴다.** Neon이 주는 두 주소 중 호스트에 `-pooler`가
 *    붙은 쪽이다. 서버리스는 요청마다 인스턴스가 살았다 죽었다 하므로 직결
 *    주소를 쓰면 연결 수가 금방 한도에 닿는다.
 *
 * ⚠️ 인스턴스당 `max: 1`인 이유 — 커넥션 풀링은 이미 Neon 풀러가 하고 있다.
 *    여기서 또 여러 개를 열면 풀러 앞에 풀이 두 겹으로 쌓여 한도만 갉아먹는다.
 */
declare global {
  var __hangyeolPool: Pool | undefined;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // 🔴 조용히 넘어가지 않는다. 이 값이 없으면 신청이 저장되지 않고,
    //    저장되지 않는데 접수됐다고 말하는 것이 이 코드베이스가 가장 경계하는 사고다.
    throw new Error(
      "DATABASE_URL이 없습니다. Vercel 프로젝트에 Neon을 연결하고 세 환경 모두에 등록하세요.",
    );
  }
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
}

/** 개발 중 핫리로드마다 풀이 새로 생기는 것을 막는다(연결 누수). */
export function pool(): Pool {
  if (!globalThis.__hangyeolPool) globalThis.__hangyeolPool = makePool();
  return globalThis.__hangyeolPool;
}

/** 한 줄짜리 질의. 파라미터는 반드시 `$1` 자리표시자로 넘긴다(문자열 이어붙이기 금지). */
export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const res = await pool().query<T>(text, params as unknown[]);
  return res.rows;
}

/**
 * 여러 문장을 한 트랜잭션으로 묶는다.
 *
 * 🔴 입금 기록처럼 「payment 행 생성 → 상태 변경 → 로그 → participant 생성」이
 *    한 덩어리여야 하는 곳에 쓴다. 중간에 끊기면 **돈은 받았는데 참가자가 없는**
 *    상태가 된다.
 */
export async function tx<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Postgres 고유 제약 위반(중복) 여부. `phone` UNIQUE에 걸렸는지 판별할 때 쓴다. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
