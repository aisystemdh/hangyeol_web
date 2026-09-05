import { vi } from "vitest";

/**
 * 시스템 시각을 흉내 낸다. 「72시간 뒤」·「행사 당일」을 만들기 위한 것이다.
 *
 * ⚠️ **`Date`만 바꿔치고 타이머는 건드리지 않는다.** `setTimeout`까지 가짜로 만들면
 *    pg가 내부에서 쓰는 타이머가 영영 안 울려 질의가 그대로 매달린다.
 *
 * 🔴 **DB의 `now()`는 흉내 낼 수 없다.** 그건 Postgres 서버의 시계라 이쪽에서 손댈
 *    방법이 없다. 그래서 시각이 걸린 값(기한 같은 것)은 **앱이 계산해서 넘겨야**
 *    검사할 수 있다 — SQL 안에서 `now() + interval '72 hours'`로 만들면 테스트가
 *    영원히 「지금」만 보게 된다. 스펙이 기한을 신청 행에 박아 두라고 한 것과 같은 방향이다.
 */
export function freezeAt(iso: string): void {
  const now = new Date(iso);
  if (Number.isNaN(now.getTime())) throw new Error(`읽을 수 없는 시각: ${iso}`);
  vi.useFakeTimers({ now, toFake: ["Date"] });
}

/** 시각을 되돌린다. 공용 준비 단계가 매 테스트 앞에서 불러 준다. */
export function unfreeze(): void {
  vi.useRealTimers();
}

/** 그 시각인 척하고 한 덩어리를 돌린다. 끝나면 실패했더라도 시각을 되돌린다. */
export async function at<T>(iso: string, fn: () => T | Promise<T>): Promise<T> {
  freezeAt(iso);
  try {
    return await fn();
  } finally {
    unfreeze();
  }
}
