import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 운영자 인증.
 *
 * 🔴 `/admin` 은 참가자 20명의 **이름·연락처·생년월일이 전부 보이는 화면**이다.
 *    주소를 아는 사람만 들어오는 「비추측 URL」로 두지 않는다 — 링크 한 번 새면 끝이다.
 *
 * 공유 비밀번호 하나 + 서명 쿠키로 간다. 운영자가 셋뿐이라 계정을 따로 두지 않는다.
 * ⚠️ 대신 **누가 눌렀는지는 남지 않는다.** 상태를 바꿀 때 `actor`를 화면에서 직접
 *    고르게 해서, 최소한 기록에는 사람 이름이 남게 한다.
 */

const COOKIE = "hg_admin";
const TTL_MS = 12 * 60 * 60 * 1000; // 12시간 — 하루 두 번 입금 확인하는 주기에 맞춘다

function secret(): string {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD가 없습니다.");
  return s;
}

function sign(exp: number): string {
  return createHmac("sha256", secret()).update(String(exp)).digest("base64url");
}

/** 비밀번호가 맞으면 쿠키 값을 만든다. 틀리면 null. */
export function makeSession(input: string): { value: string; maxAge: number } | null {
  const want = Buffer.from(secret());
  const got = Buffer.from(input ?? "");
  // 길이가 다르면 timingSafeEqual이 던지므로 먼저 맞춘다.
  // 🔴 `===` 로 비교하지 않는다 — 앞에서부터 몇 글자가 맞는지가 응답 시간에 새어
  //    비밀번호를 한 글자씩 알아낼 수 있다.
  const ok = want.length === got.length && timingSafeEqual(want, got);
  if (!ok) return null;
  const exp = Date.now() + TTL_MS;
  return { value: `${exp}.${sign(exp)}`, maxAge: Math.floor(TTL_MS / 1000) };
}

function valid(raw: string | undefined): boolean {
  if (!raw) return false;
  const [expStr, mac] = raw.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(mac ?? "");
  return want.length === got.length && timingSafeEqual(want, got);
}

/** 서버 컴포넌트·라우트에서 부른다. 로그인 안 됐으면 false. */
export async function isAdmin(): Promise<boolean> {
  try {
    const jar = await cookies();
    return valid(jar.get(COOKIE)?.value);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = COOKIE;

/** 토큰 발급용. 추측 불가한 16자 이상 — 이 토큰이 곧 신원이다. */
export function newToken(): string {
  return randomBytes(16).toString("base64url");
}
