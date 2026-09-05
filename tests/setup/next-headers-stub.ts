/**
 * `next/headers` 자리에 끼우는 가짜. `vitest.config.mts`의 별칭이 여기를 가리킨다.
 *
 * 🔴 **왜 필요한가** — `cookies()`는 요청 문맥 안에서만 돌고 밖에서는 던진다.
 *    그런데 `isAdmin()`은 그 예외를 삼켜 `false`를 돌려준다(`src/lib/admin.ts`).
 *    그대로 두면 운영자 API 테스트가 **무엇을 보내든 401**이 되어,
 *    「로그인 안 하면 막힌다」는 엉뚱한 이유로 통과하고 「로그인하면 열린다」는
 *    아예 확인할 수 없다. 운영자 화면은 참가자 스무 명의 신원이 전부 있는 곳이라
 *    바로 그 자리를 못 보는 것이 제일 곤란하다.
 *
 * 지금 부르는 쪽이 쓰는 것은 `cookies().get(이름)?.value` 하나뿐이라
 * 딱 그만큼만 만든다. 더 필요해지면 그때 늘린다.
 */

/** 지금 처리 중인 요청. `callRoute`가 핸들러를 부르기 직전에 넣고 끝나면 뺀다. */
const stack: Request[] = [];

export function __pushRequest(req: Request): void {
  stack.push(req);
}
export function __popRequest(): void {
  stack.pop();
}

function currentHeaders(): Headers {
  const req = stack[stack.length - 1];
  if (!req) {
    // 진짜 Next와 같은 자리에서 같은 이유로 던진다. 삼키면 원인을 못 찾는다.
    throw new Error("`cookies`/`headers` was called outside a request scope. (테스트 가짜)");
  }
  return req.headers;
}

type Cookie = { name: string; value: string };

function parse(): Map<string, string> {
  const raw = currentHeaders().get("cookie") ?? "";
  const out = new Map<string, string>();
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
  }
  return out;
}

export async function cookies() {
  const jar = parse();
  return {
    get(name: string): Cookie | undefined {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(): Cookie[] {
      return [...jar].map(([name, value]) => ({ name, value }));
    },
    has(name: string): boolean {
      return jar.has(name);
    },
  };
}

export async function headers(): Promise<Headers> {
  return new Headers(currentHeaders());
}
