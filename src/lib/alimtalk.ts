/**
 * 알림톡 발송 통로.
 *
 * 🔴 **부르는 쪽은 「누구에게 무슨 문구를」만 넘기고, 어디로 나가는지는 모른다.**
 *    통로가 하나로 좁혀져 있어야 ① 테스트에서 진짜로 나가는 일이 없고
 *    ② 대행사가 바뀌어도 부르는 쪽 아홉 군데를 고치지 않는다.
 *
 * 🔴 **자동 발송은 신청 직후 둘뿐이다** — 자리가 있으면 입금 안내, 없으면 대기 안내.
 *    나머지 일곱 가지는 운영자가 대상과 시점을 골라 보낸다. 그리고 **자동 재시도를
 *    넣지 않는다** — 같은 안내가 두 번 가면 손님이 기한을 헷갈리고, 번호가 틀린
 *    것이면 몇 번을 보내도 똑같이 실패한다.
 *
 * ⚠️ 문구 전문(`text`)을 여기까지 완성해서 넘긴다. 변수를 채우는 일과
 *    **채우지 못한 변수가 남으면 발송을 거부하는 판정**은 `notification.ts`에 있다.
 */

export type AlimtalkButton = {
  /** 버튼에 보이는 글자. 카카오에 등록한 템플릿의 버튼과 **글자까지 같아야** 한다. */
  name: string;
  /** 카카오 버튼 종류. 우리가 쓰는 것은 웹링크(`WL`)뿐이다. */
  type: string;
  /**
   * 🔴 **완성된 주소.** `#{}`를 못 쓰므로 부르는 쪽이 그 사람의 주소를 통째로 만들어
   *    넣는다. 도메인은 고정이고 뒤의 토큰만 다르다.
   */
  url_mobile?: string;
  url_pc?: string;
};

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
  /**
   * 우리 발송 기록의 id. 뿌리오가 결과 웹훅에 **그대로 돌려주므로** 짝을 맞추는 열쇠다.
   * (그래서 `notification.id`를 그대로 넘긴다 — 따로 만들면 두 벌이 된다.)
   */
  refkey?: string;
  /** 템플릿에 버튼이 있으면 **발송 요청에도 같은 버튼을 실어야** 한다. */
  buttons?: AlimtalkButton[] | null;
  /**
   * 알림톡이 안 닿았을 때 대신 나갈 문자 문구. **90바이트**뿐이다.
   * 🔴 비어 있으면 **대체 발송을 아예 걸지 않는다.** 본문을 자동으로 잘라 보내면
   *    문장 중간에서 끊긴 문자가 손님에게 간다 — 잘린 문장보다 안 보내는 편이 낫다.
   */
  smsBody?: string | null;
};

/**
 * 발송 결과 세 가지.
 * ⚠️ `sms_fallback`(알림톡이 안 닿아 문자로 대체)도 **손님은 받았다.** 성공으로 센다.
 *
 * 🔴 여기서 말하는 성공은 **「대행사가 접수했다」**까지다. 손님이 실제로 받았는지는
 *    웹훅으로 따로 오고(`/api/alimtalk/result`), 발송 기록의 다른 칸에 들어간다.
 *    접수와 도달을 한 칸에 뭉치면, 접수는 됐는데 도달이 안 된 사람이 「보냈음」으로
 *    묻혀 운영자가 영영 못 본다.
 */
export type AlimtalkResult =
  | { status: "sent"; providerMessageId: string | null; acceptCode?: string | null }
  | { status: "sms_fallback"; providerMessageId: string | null; acceptCode?: string | null }
  | { status: "failed"; error: string; acceptCode?: string | null };

export interface AlimtalkSender {
  send(msg: AlimtalkMessage): Promise<AlimtalkResult>;
}

/**
 * 어느 통로로 보낼지 고른다. `ALIMTALK_PROVIDER`가 정한다.
 *
 * - `fake`   — 보내지 않고 기록만 한다. 테스트와 로컬 개발이 쓴다.
 * - `ppurio` — 대행사(뿌리오). 키가 전부 있어야 만들어진다.
 *
 * 🔴 **기본값을 두지 않는다.** 값을 깜빡한 채로 배포됐을 때 조용히 진짜 발송이
 *    나가는 것보다, 아무것도 안 고르고 터지는 편이 낫다.
 * 🔴 **`ppurio`인데 키가 없으면 조용히 가짜로 넘어가지 않고 던진다.** 그 반대도 사고다 —
 *    「진짜로 보내라」고 해놓고 아무 데도 안 나가면, 스무 명이 안내를 받은 줄 알고
 *    운영자가 기다린다. 키가 준비되기 전에는 `fake`를 **명시적으로** 고른다.
 *    (그래서 키가 나와도 **코드는 손대지 않는다.** 환경변수 넷을 채우고
 *     `ALIMTALK_PROVIDER=ppurio`로 바꾸면 그대로 진짜 발송이 된다.)
 */
export function alimtalk(): AlimtalkSender {
  const provider = process.env.ALIMTALK_PROVIDER;
  if (provider === "fake") return fakeSender();
  if (provider === "ppurio") return ppurioSender();
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
      return { status: "sent", providerMessageId: `fake-${outbox.length}`, acceptCode: "1000" };
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

/* ── 뿌리오 ─────────────────────────────────────────────────────
   규격 근거: `docs/decisions/003-scenario-redesign-2026-09-05.md` §3
   (2026-09-05 `bizppurio.github.io` 개발 문서 실측).
   ⚠️ 계정이 아직 없어 **살아 있는 서버로 왕복해 본 적은 없다.** 키가 나오면
      첫 발송 한 건을 눈으로 확인할 것.                                     */

const TOKEN_URL = "https://api.bizppurio.com/v1/token";
const MESSAGE_URL = "https://api.bizppurio.com/v3/message";

/**
 * 토큰 캐시. 🔴 **발송마다 새로 받지 않는다** — 24시간짜리다.
 * 만료 직전(1시간 여유)에 새로 받는다. 스무 명에게 한 번에 보내는 중에
 * 토큰이 끊기면 뒤쪽 몇 명만 실패하는 이상한 모양이 된다.
 */
let cachedToken: { value: string; until: number } | null = null;

/** 테스트가 캐시를 비울 수 있게 열어 둔다. 앱 코드에서는 부르지 않는다. */
export function __clearPpurioToken(): void {
  cachedToken = null;
}

function ppurioConfig() {
  const account = process.env.PPURIO_ACCOUNT;
  const password = process.env.PPURIO_PASSWORD;
  const senderKey = process.env.PPURIO_SENDER_KEY;
  const from = process.env.PPURIO_FROM;
  const missing = [
    ["PPURIO_ACCOUNT", account],
    ["PPURIO_PASSWORD", password],
    ["PPURIO_SENDER_KEY", senderKey],
    ["PPURIO_FROM", from],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `뿌리오 키가 없습니다: ${missing.join(", ")}. ` +
        "키가 나오기 전에는 ALIMTALK_PROVIDER=fake로 두세요.",
    );
  }
  // 🔴 발신 프로필 키와 발신번호는 회차·문구와 무관하게 하나뿐이라 DB가 아니라
  //    환경변수에 둔다. DB에 두면 회차마다 다를 수 있는 값처럼 읽힌다.
  return { account: account!, password: password!, senderKey: senderKey!, from: from! };
}

async function ppurioToken(cfg: { account: string; password: string }): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;

  const basic = Buffer.from(`${cfg.account}:${cfg.password}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`뿌리오 토큰 발급 실패 (HTTP ${res.status})`);

  const body = (await res.json()) as { token?: string; expired?: string };
  if (!body.token) throw new Error("뿌리오 토큰 발급 실패 — 응답에 token이 없습니다.");

  // 응답의 만료 시각을 쓰되, 못 읽으면 24시간에서 한 시간 뺀 값으로 잡는다.
  const parsed = body.expired ? Date.parse(body.expired.replace(" ", "T")) : NaN;
  const until = Number.isFinite(parsed) ? parsed - 60 * 60 * 1000 : Date.now() + 23 * 60 * 60 * 1000;
  cachedToken = { value: body.token, until };
  return body.token;
}

function ppurioSender(): AlimtalkSender {
  const cfg = ppurioConfig();
  return {
    async send(msg) {
      try {
        const token = await ppurioToken(cfg);

        const at: Record<string, unknown> = {
          senderkey: cfg.senderKey,
          templatecode: msg.templateCode,
          // 🔴 **변수를 다 채운 최종 본문이다.** 뿌리오는 `#{}`를 대신 채워주지 않는다.
          message: msg.text,
        };
        if (msg.buttons && msg.buttons.length > 0) at.button = msg.buttons;

        const payload: Record<string, unknown> = {
          account: cfg.account,
          refkey: msg.refkey,
          type: "at",
          from: cfg.from,
          to: msg.phone,
          content: { at },
        };
        // 🔴 대체문자 문구가 있을 때만 대체 발송을 건다. 없는데 걸면 대행사가 본문을
        //    90바이트로 잘라 보내고, 문장 중간에서 끊긴 문자가 손님에게 간다.
        if (msg.smsBody) {
          payload.resend = { first: "sms" };
          payload.recontent = { sms: { message: msg.smsBody } };
        }

        const res = await fetch(MESSAGE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as {
          code?: number | string;
          description?: string;
          messagekey?: string;
        };
        const code = body.code == null ? null : String(body.code);

        // 🔴 `1000`은 「접수됨」이지 「손님이 받았다」가 아니다. 도달은 웹훅으로 온다.
        if (res.ok && code === "1000") {
          return { status: "sent", providerMessageId: body.messagekey ?? null, acceptCode: code };
        }
        return {
          status: "failed",
          error: `뿌리오 접수 거절 (HTTP ${res.status} · code ${code ?? "?"}${
            body.description ? ` · ${body.description}` : ""
          })`,
          acceptCode: code,
        };
      } catch (err) {
        return { status: "failed", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
