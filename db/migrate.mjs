/**
 * 마이그레이션 실행기.  실행: `node db/migrate.mjs`
 *
 * psql이 없어도 돌아가게 하려고 Node로 만들었다(윈도우에 psql이 깔려 있지 않다).
 * `DATABASE_URL`은 환경변수에서 읽고, 없으면 `.env.local`에서 찾는다.
 *
 * 이미 적용한 파일은 `schema_migration`에 기록해 두고 건너뛴다 —
 * 여러 번 돌려도 안전해야 중간에 실패했을 때 그냥 다시 돌릴 수 있다.
 *
 * ⚠️ **몸통을 `migrate()`로 빼 둔 이유** — 테스트가 시작할 때 테스트 전용 DB에
 *    같은 스키마를 세워야 하는데(#29), 여기를 복사해 두 벌로 만들면 마이그레이션을
 *    더할 때마다 한쪽이 반드시 뒤처진다. vitest의 준비 단계가 이 함수를 그대로 부른다.
 *    명령줄로 직접 실행하는 동작은 그대로다.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

/** `.env.local`에서 값 하나를 꺼낸다. dotenv를 넣지 않으려고 직접 읽는다. */
function fromEnvLocal(key) {
  try {
    const env = readFileSync(join(here, "..", ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
    const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
    return v || null;
  } catch {
    return null;
  }
}

function connectionString() {
  const v = process.env.DATABASE_URL || fromEnvLocal("DATABASE_URL");
  if (v) return v;
  console.error(
    "DATABASE_URL이 없습니다.\n" +
      "  1) Vercel > hangyeol-official > Storage 에서 Neon을 붙이고\n" +
      "  2) npx vercel env pull .env.local 로 받아온 뒤\n" +
      "  3) 다시 실행하세요.",
  );
  process.exit(1);
}

/**
 * `migrations/`의 파일을 번호 순서대로 적용한다. 이미 적용된 것은 건너뛴다.
 * @param {string} url  붙을 DB 주소
 * @param {(msg: string) => void} log  진행 상황을 어디에 찍을지
 * @returns {Promise<{ applied: number, tables: string[] }>}
 */
export async function migrate(url, log = console.log) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migration (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const done = new Set(
      (await client.query("select name from schema_migration")).rows.map((r) => r.name),
    );

    const files = readdirSync(join(here, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let applied = 0;
    for (const f of files) {
      if (done.has(f)) {
        log(`  건너뜀  ${f} (이미 적용됨)`);
        continue;
      }
      const sql = readFileSync(join(here, "migrations", f), "utf8");
      try {
        // 🔴 파일 하나가 한 트랜잭션이다. 중간에 깨지면 통째로 되돌린다 —
        //    절반만 적용된 스키마가 가장 고치기 어렵다.
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migration (name) values ($1)", [f]);
        await client.query("commit");
        log(`  적용됨  ${f}`);
        applied += 1;
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw new Error(`마이그레이션 실패 — ${f}\n${err.message}`, { cause: err });
      }
    }

    const tables = await client.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
    );
    return { applied, tables: tables.rows.map((r) => r.table_name) };
  } finally {
    await client.end();
  }
}

// ── 명령줄로 직접 실행할 때만 돈다 ─────────────────────────────
// 테스트가 import할 때는 여기가 돌면 안 된다(엉뚱한 DB에 붙는다).
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    const { applied, tables } = await migrate(connectionString());
    // 결과를 눈으로 확인할 수 있게 테이블 목록을 찍는다.
    console.log(`\n적용 ${applied}건 · 현재 테이블: ${tables.join(", ")}`);
  } catch (err) {
    console.error(`\n  ${err.message}`);
    process.exit(1);
  }
}
