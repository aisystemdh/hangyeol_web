/**
 * 운영자 화면의 조작 버튼들이 공유하는 fetch 뼈대 (원래 `ApplicationDrawer.tsx`
 * 안에 있었다 — 이슈 #54).
 *
 * 🔴 코드리뷰(2026-09-06) — 네트워크 오류 시 `busy`를 풀어주는 try/catch/finally를
 *    화면마다 복붙하다 보면 언젠가 하나를 빠뜨린다(`ApplicationDrawer.tsx`의
 *    `applyScreen`이 실제로 그렇게 빠뜨렸었다). `TemplateBoard.tsx`(#38)가 같은
 *    모양을 또 필요로 하면서 한 곳으로 옮겼다. `busy`를 여기서 풀지 않는 이유는
 *    성공했을 때 호출부가 후속 처리(로컬 상태 갱신 등)를 마칠 때까지 버튼이 다시
 *    눌리지 않게 하기 위해서다 — 호출부가 자기 타이밍에 풀어준다.
 */

export type PostResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function postAdminAction<T>(
  url: string,
  body: unknown,
  failPrefix: string,
): Promise<PostResult<T>> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: `${failPrefix}: ${j.message ?? j.error ?? r.status}` };
    return { ok: true, data: j.data as T };
  } catch {
    return { ok: false, message: `${failPrefix}: 네트워크 오류. 다시 시도해주세요.` };
  }
}
