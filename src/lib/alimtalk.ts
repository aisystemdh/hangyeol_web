/**
 * 알림톡 발송 통로.
 *
 * 🔴 **부르는 쪽은 「누구에게 무슨 문구를」만 넘기고, 어디로 나가는지는 모른다.**
 *    통로가 하나로 좁혀져 있어야 ① 테스트에서 진짜로 나가는 일이 없고
 *    ② 대행사가 바뀌어도 부르는 쪽 아홉 군데를 고치지 않는다.
 *
 * 🔴 **자동 발송은 「신청 직후 입금 안내」 하나뿐이다.** 나머지 여덟 가지는 운영자가
 *    대상과 시점을 골라 보낸다. 그리고 **자동 재시도를 넣지 않는다** — 같은 안내가
 *    두 번 가면 손님이 기한을 헷갈리고, 번호가 틀린 것이면 몇 번을 보내도 똑같이 실패한다.
 *
 * ⚠️ 문구 전문(`text`)을 여기까지 완성해서 넘긴다. 변수를 채우는 일은 부르는 쪽이 하고,
 *    **채우지 못한 변수가 하나라도 남으면 발송 자체를 거부한다**(`#{계좌}`가 그대로
 *    박힌 문구가 나가면 안 된다). 그 판정은 이 파일이 아니라 문구 채우기 쪽에 있다.
 */

export type AlimtalkMessage = {
  /** 받는 사람. 숫자만(`01012345678`). */
  phone: string;
  /**
   * 그 사람에게 나가는 문구 전문.
   * 🔴 발송 기록에 **이 문자열을 그대로 복사**해 둔다. 문구를 나중에 고쳐도 과거
   *    기록이 따라 바뀌면 안 된다 — 분쟁이 나면 무엇을 보냈는지가 유일한 근거다.
   */
  text: string;
  /** 카카오 심사를 통과한 템플릿 코드. 심사 전이거나 문자로만 보낼 때는 없다. */
  templateCode?: string | null;
};

/**
 * 발송 결과 세 가지.
 * ⚠️ `sms_fallback`(알림톡이 안 닿아 문자로 대체)도 **손님은 받았다.** 성공으로 센다.
 */
export type AlimtalkResult =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "sms_fallback"; providerMessageId: string | null }
  | { status: "failed"; error: string };

export interface AlimtalkSender {
  send(msg: AlimtalkMessage): Promise<AlimtalkResult>;
}

/**
 * 어느 통로로 보낼지 고른다. `ALIMTALK_PROVIDER`가 정한다.
 *
 * - `fake`  — 보내지 않고 기록만 한다. 테스트와 로컬 개발이 쓴다.
 * - `ppurio` — 대행사(뿌리오). 🟡 **아직 없다**(#37에서 만든다).
 *
 * ⚠️ 기본값을 `ppurio`로 두지 않는다. 값을 깜빡한 채로 배포됐을 때 조용히 진짜
 *    발송이 나가는 것보다, 아무것도 안 고르고 터지는 편이 낫다.
 */
export function alimtalk(): AlimtalkSender {
  const provider = process.env.ALIMTALK_PROVIDER;
  if (provider === "fake") return fakeSender();
  if (provider === "ppurio") {
    throw new Error(
      "뿌리오 발송기는 아직 만들지 않았습니다(#37). 지금은 ALIMTALK_PROVIDER=fake만 씁니다.",
    );
  }
  throw new Error(
    "ALIMTALK_PROVIDER가 없습니다. 'fake' 또는 'ppurio' 중 하나를 정해야 합니다.",
  );
}

/* ── 가짜 발송기 ────────────────────────────────────────────────
   🔴 **절대 밖으로 나가지 않는다.** 무엇을 누구에게 보냈는지 메모리에 쌓아만 둔다.
      테스트가 이 목록을 열어 「입금 안내가 한 번 나갔나」를 확인한다.
   ⚠️ 인스턴스 메모리라 서버가 여럿이면 목록이 흩어진다. 테스트는 한 프로세스
      안에서 라우트를 함수로 직접 부르므로 문제가 되지 않는다.               */

const outbox: (AlimtalkMessage & { at: Date })[] = [];

function fakeSender(): AlimtalkSender {
  return {
    async send(msg) {
      outbox.push({ ...msg, at: new Date() });
      return { status: "sent", providerMessageId: `fake-${outbox.length}` };
    },
  };
}

/** 가짜 발송기가 지금까지 「보낸」 것 전부. 보낸 순서대로. */
export function fakeOutbox(): readonly (AlimtalkMessage & { at: Date })[] {
  return outbox;
}

/** 테스트 하나가 끝나면 비운다. 앞 테스트가 보낸 것이 뒤 테스트에 보이면 안 된다. */
export function clearFakeOutbox(): void {
  outbox.length = 0;
}
