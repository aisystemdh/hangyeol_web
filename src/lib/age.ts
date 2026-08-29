/**
 * 만 나이. 기준일을 인자로 받는 이유 —
 * 「신청일 기준」과 「행사일 기준」이 다를 수 있고, 경계에 걸린 사람이 실제로 나온다.
 * 어느 기준을 쓸지는 부르는 쪽이 정한다.
 *
 * 🔴 서버는 클라이언트가 보낸 나이를 믿지 않는다. 항상 `birth`로 다시 계산한다.
 */
export function ageOn(birth: Date | string, on: Date = new Date()): number {
  const b = typeof birth === "string" ? new Date(birth + "T00:00:00Z") : birth;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** `YYYY-MM-DD`가 실재하는 날짜인가. 2월 30일 같은 것을 거른다. */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}
