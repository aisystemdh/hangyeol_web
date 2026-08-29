/**
 * 마이그레이션 실행기.  실행: `node db/migrate.mjs`
 *
 * psql이 없어도 돌아가게 하려고 Node로 만들었다(윈도우에 psql이 깔려 있지 않다).
 * `DATABASE_URL`은 환경변수에서 읽고, 없으면 `.env.local`에서 찾는다.
 *
 * 이미 적용한 파일은 `schema_migration`에 기록해 두고 건너뛴다 —
 * 여러 번 돌려도 안전해야 중간에 실패했을 때 그냥 다시 돌릴 수 있다.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(here, "..", ".env.local"), "utf8");
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (v) return v;
  } catch {}
  console.error(
    "DATABASE_URL이 없습니다.\n" +
      "  1) Vercel > hangyeol-official > Storage 에서 Neon을 붙이고\n" +
      "  2) npx vercel env pull .env.local 로 받아온 뒤\n" +
      "  3) 다시 실행하세요.",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: connectionString() });
await client.connect();

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
    console.log(`  건너뜀  ${f} (이미 적용됨)`);
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
    console.log(`  적용됨  ${f}`);
    applied += 1;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error(`\n  실패    ${f}\n`, err.message);
    await client.end();
    process.exit(1);
  }
}

// 결과를 눈으로 확인할 수 있게 테이블 목록을 찍는다.
const tables = await client.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`,
);
console.log(`\n적용 ${applied}건 · 현재 테이블: ${tables.rows.map((r) => r.table_name).join(", ")}`);

await client.end();
