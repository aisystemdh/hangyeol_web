import { __popRequest, __pushRequest } from "../setup/next-headers-stub";

/**
 * 주소를 함수로 부른다.
 *
 * Next의 라우트 핸들러는 `(요청, 문맥) => 응답`인 평범한 함수다. 서버를 띄우지 않고
 * import해서 그대로 부를 수 있고, 그래서 **화면을 거치지 않고 API만** 검사할 수 있다.
 * 화면 검증을 믿지 않는다는 원칙이 테스트에도 그대로 적용된다 —
 * 실제 공격자도 화면을 거치지 않고 여기를 직접 부른다.
 */

type Params = Record<string, string>;

/**
 * ⚠️ **`P`를 제네릭으로 두는 이유** — `/api/pre/[token]` 같은 라우트의 문맥 타입은
 *    `{ params: Promise<{ token: string }> }`이다. 여기를 `Record<string, string>`로
 *    고정하면 그런 핸들러를 넘기는 순간 **타입 검사가 깨진다**(`token`이 없다).
 *    동적 주소야말로 이 헬퍼를 만든 이유인데 그쪽만 못 부르게 된다.
 */
type RouteHandler<P extends Params = Params> = (
  req: Request,
  ctx: { params: Promise<P> },
) => Response | Promise<Response>;

export type RouteResult<T> = {
  status: number;
  headers: Headers;
  /** JSON으로 읽은 응답 본문. */
  body: T;
  /**
   * 응답 본문 **원문 그대로**.
   *
   * 🔴 새는 것을 잡을 때 이걸 본다. 계좌번호나 문항이 응답 어딘가에 딸려 나갔다면
   *    필드 이름을 몰라도 `raw`에 문자열로 남는다. 「있어야 할 것」은 `body`로,
   *    「없어야 할 것」은 `raw`로 확인한다.
   */
  raw: string;
};

export async function callRoute<T = unknown, P extends Params = Params>(
  handler: RouteHandler<P>,
  opts: {
    method?: string;
    /** 경로. 라우트가 쿼리스트링을 읽을 때만 의미가 있다. */
    path?: string;
    query?: Record<string, string>;
    /** 있으면 JSON으로 실어 보낸다. */
    body?: unknown;
    headers?: Record<string, string>;
    /** 쿠키. 운영자 세션을 태울 때 쓴다. `headers`의 `cookie`보다 이쪽이 읽기 쉽다. */
    cookies?: Record<string, string>;
    /** `/me/[token]` 같은 동적 구간. Next가 넘기는 것과 같은 모양으로 만들어 준다. */
    params?: P;
  } = {},
): Promise<RouteResult<T>> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = new URL(opts.path ?? "/", base);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const headers = new Headers(opts.headers ?? {});
  const jar = Object.entries(opts.cookies ?? {});
  if (jar.length > 0) {
    headers.set("cookie", jar.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; "));
  }

  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  const req = new Request(url, init);

  // 🔴 `cookies()`·`headers()`가 이 요청을 보게 해 둔다. 없으면 운영자 API가
  //    무엇을 보내도 401이 되어 「로그인하면 열린다」를 확인할 수 없다.
  __pushRequest(req);
  let res: Response;
  try {
    // params는 Next 15부터 Promise다. 진짜와 같은 모양으로 넘겨야
    // 라우트 안의 `await params`가 실제 동작과 똑같이 돈다.
    res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
  } finally {
    __popRequest();
  }

  const raw = await res.text();
  let body: T;
  try {
    body = raw === "" ? (undefined as T) : (JSON.parse(raw) as T);
  } catch {
    body = raw as unknown as T; // JSON이 아니면 원문을 그대로 준다.
  }
  return { status: res.status, headers: res.headers, body, raw };
}

/** 응답이 심어 준 쿠키를 이름→값으로 읽는다. 로그인 응답에서 세션을 꺼낼 때 쓴다. */
export function setCookies(res: RouteResult<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) {
    const first = line.split(";")[0];
    const i = first.indexOf("=");
    if (i < 0) continue;
    out[first.slice(0, i).trim()] = decodeURIComponent(first.slice(i + 1).trim());
  }
  return out;
}
