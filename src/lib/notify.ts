/**
 * 운영자에게 가는 알림.
 *
 * 지금은 **기존 Formspree 주소를 그대로 메일 알림으로 재사용**한다. 사전등록의
 * 정본은 이제 DB이고, Formspree는 "새 신청이 들어왔다"를 사람에게 알리는
 * 역할만 한다. 계정을 새로 파지 않아도 되고, 사장님이 받던 메일도 끊기지 않는다.
 *
 * ⚠️ 환경변수 이름이 `NEXT_PUBLIC_`에서 서버 전용으로 바뀌었다. 예전에는 이 주소가
 *    브라우저 번들에 박혀 누구나 읽고 직접 쏠 수 있었다. 이제 서버에서만 쓴다.
 *
 * 🔴 **알림 실패가 신청 실패가 되면 안 된다.** 메일이 안 가는 것보다 신청이
 *    저장되지 않는 것이 훨씬 나쁘다. 모든 호출은 실패해도 조용히 삼킨다.
 *
 * 알림톡 대행사가 정해지면 `sendKakao()`를 여기에 더하고 부르는 쪽은 그대로 둔다.
 */

const NOTIFY_ENDPOINT = process.env.APPLY_NOTIFY_ENDPOINT;

type NewApplicant = {
  seq: number;
  name: string;
  phone: string;
  gender: "M" | "F";
  birth: string;
  age: number;
  ageOutOfRange: boolean;
  marketingAgreed: boolean;
};

export async function notifyNewApplicant(a: NewApplicant): Promise<void> {
  if (!NOTIFY_ENDPOINT) return;
  const flag = a.ageOutOfRange ? " ⚠️ 나이 범위 밖 — 확인 필요" : "";
  try {
    await fetch(NOTIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        순번: a.seq,
        이름: a.name,
        연락처: a.phone,
        성별: a.gender === "M" ? "남" : "여",
        생년월일: a.birth,
        만나이: `${a.age}세${flag}`,
        "다음 회차 안내 동의": a.marketingAgreed ? "동의" : "미동의",
        _subject: `[한결] 사전등록 #${a.seq} — ${a.name}${flag}`,
      }),
      // 응답을 기다리되 오래 매달리지 않는다. 알림은 신청보다 덜 중요하다.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // 의도적으로 삼킨다. 위 주석 참조.
  }
}

/**
 * 참가자에게 링크를 보낸다.
 *
 * 🟡 **아직 아무것도 보내지 않는다.** 알림톡 발송 플랫폼이 정해지지 않았다
 *    (2026-08-30 기준 미결 · 템플릿 13건 심사 리드타임이 9/28을 문다).
 *    지금은 운영자가 화면에서 링크를 복사해 직접 보낸다.
 *
 * ⭐ 플랫폼이 정해지면 **이 두 함수의 몸통만** 채운다. 부르는 쪽(`/api/admin/.../token`)은
 *    그대로 둔다. 그래서 미리 자리를 만들어 뒀다.
 *
 * 알림톡 템플릿 대응 — 1단계 링크 = T1, 2단계 링크 = T4(확정 안내)에 얹는다.
 */

export type LinkDelivery = { channel: "manual" | "alimtalk"; ok: boolean };

/* eslint-disable @typescript-eslint/no-unused-vars --
   플랫폼이 정해지면 이 인자들을 쓴다. 지금 지웠다가 그때 다시 만드는 것보다
   자리를 남겨두는 편이 「무엇을 넘겨야 하는지」를 문서처럼 보여준다. */
export async function sendPreLink(_p: {
  name: string;
  phone: string;
  url: string;
  dueAt: string | null;
}): Promise<LinkDelivery> {
  return { channel: "manual", ok: false };
}

export async function sendQuestionLink(_p: {
  name: string;
  phone: string;
  url: string;
}): Promise<LinkDelivery> {
  return { channel: "manual", ok: false };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
