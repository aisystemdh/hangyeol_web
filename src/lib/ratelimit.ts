/**
 * IP당 슬라이딩 윈도 제한.
 *
 * ⚠️ **인스턴스 메모리에만 있다.** 서버리스는 인스턴스가 여럿일 수 있어
 *    한도가 정확히 지켜지지는 않는다. 그래도 두는 이유는, 이게 막으려는 것이
 *    분산 공격이 아니라 **한 사람이 실수로 혹은 장난으로 연타하는 것**이기
 *    때문이다. 진짜 방어선은 `phone` UNIQUE와 허니팟이다.
 *
 * 정확한 제한이 필요해지면 그때 DB나 Vercel 방화벽으로 옮긴다.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  // 메모리가 무한정 자라지 않게 가끔 청소한다.
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** 프록시를 거치므로 소켓 주소가 아니라 헤더를 본다. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
