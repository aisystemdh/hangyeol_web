import { after } from "next/server";

/**
 * 「응답을 보낸 뒤에 할 일」.
 *
 * 알림톡 발송처럼 **손님을 기다리게 하면서 할 만큼 급하지 않은 일**을 여기에 넘긴다.
 * 예전에 알림을 그냥 `await` 했더니 대행사 왕복이 응답 경로에 그대로 얹혀
 * 신청자가 1초 넘게 더 기다렸다(실측). 그렇다고 `await` 없이 부르면 서버리스에서는
 * 응답과 함께 프로세스가 정리되며 요청이 중간에 끊긴다 — `after()`가 그 사이를 메운다.
 *
 * 🔴 **`after()`를 직접 부르지 말고 이 함수를 부른다.** `after()`는 요청 문맥
 *    안에서만 돌고 밖에서는 던진다. 테스트는 라우트를 **함수로 직접** 부르므로
 *    요청 문맥이 없고, 그래서 `after()`를 직접 쓴 라우트는 검사하는 순간 통째로
 *    500이 된다(2026-09-05 실측 — `after was called outside a request scope`).
 *    자동 발송이 붙는 곳이 바로 그 라우트라, 여기를 비켜 가면 **이 시스템의 유일한
 *    자동화를 아무도 검사할 수 없게 된다.**
 *
 * ⚠️ 문맥이 없을 때는 그냥 돌린다. 프로덕션에서 이 경로로 빠질 일은 없지만,
 *    빠지더라도 최악이 「알림이 안 갔다」이고 그건 신청이 사라지는 것보다 낫다.
 */
const pending = new Set<Promise<unknown>>();

export function afterResponse(fn: () => Promise<unknown>): void {
  try {
    after(fn);
  } catch {
    // 요청 문맥이 없다(테스트가 라우트를 함수로 직접 부를 때).
    // 🔴 여기서 던지면 안 된다. 뒷일이 앞일을 죽이는 것이 이 파일이 막으려는 것이다.
    // ⚠️ `fn()`을 그냥 부르지 말 것 — **동기 throw는 catch로 안 잡힌다.**
    //    실제로 `alimtalk()`은 통로를 안 고르면 그 자리에서 던지므로,
    //    환경변수 하나 빠진 배포에서 라우트가 통째로 500이 된다.
    //    `Promise.resolve().then(fn)`이 동기 throw를 거절로 바꿔 준다.
    const p = Promise.resolve()
      .then(fn)
      .catch(() => {})
      .finally(() => pending.delete(p));
    pending.add(p);
  }
}

/**
 * 문맥 없이 돌린 뒷일이 전부 끝나기를 기다린다.
 *
 * ⚠️ **테스트만 쓴다.** 뒷일이 끝났는지 확인하지 않고 발송 기록을 열어보면
 *    「보냈는데 아직 안 보인다」로 테스트가 들쭉날쭉해진다.
 */
export async function settleAfterResponse(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}
