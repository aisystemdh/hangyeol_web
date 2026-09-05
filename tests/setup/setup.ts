import { afterAll, beforeEach } from "vitest";
import { loadEnvLocal, testDatabaseUrl } from "./env";
import { closeDb, resetDb } from "../helpers/db";
import { unfreeze } from "../helpers/clock";
import { clearFakeOutbox } from "@/lib/alimtalk";
import { settleAfterResponse } from "@/lib/after";

/* 이 파일은 **테스트 파일마다 한 번씩** 먼저 돈다.
   여기서 정한 환경변수는 그 파일의 앱 코드가 그대로 읽는다. */

loadEnvLocal();

/**
 * 🔴 **앱 코드는 `DATABASE_URL`을 읽는다.** 그래서 테스트용 주소를 따로 읽게 만드는
 *    대신 이 값 자체를 바꿔 끼운다. 앱 코드에 「테스트일 때는」 분기를 심지 않기
 *    위해서다 — 그런 분기는 실제로 도는 경로와 검사하는 경로를 갈라놓는다.
 *
 * ⚠️ 바꿔 끼우기 전의 값을 따로 적어 둔다. 이 파일이 같은 프로세스에서 두 번 돌 때
 *    (파일마다 프로세스를 새로 띄우지 않는 설정) 이미 바뀐 값을 운영 주소로 착각해
 *    「둘이 같다」며 멀쩡한 실행을 막아 버리기 때문이다.
 */
process.env.HANGYEOL_LIVE_DATABASE_URL ??= process.env.DATABASE_URL ?? "";
process.env.DATABASE_URL = testDatabaseUrl(process.env.HANGYEOL_LIVE_DATABASE_URL || undefined);

/** 🔴 진짜 알림톡이 나가는 일이 없게 한다. 통로를 안 고르면 발송기가 던진다. */
process.env.ALIMTALK_PROVIDER = "fake";

/**
 * 🔴 **운영자에게 가는 메일 알림도 끊는다.** `.env.local`을 통째로 올리므로 이 값이
 *    살아 있고, `notify.ts`는 **모듈을 읽는 순간** 값을 붙잡는다. 그대로 두면
 *    신청 API를 검사하는 순간 가짜 신청자 메일이 **진짜 받은편지함으로** 날아간다.
 *    「테스트에서는 밖으로 아무것도 안 나간다」가 알림톡에만 적용되면 반쪽이다.
 */
delete process.env.APPLY_NOTIFY_ENDPOINT;

/** 토큰 링크가 만들어지는 곳이 있어 기본값을 준다(없으면 앱이 localhost로 대체한다). */
process.env.NEXT_PUBLIC_SITE_URL ||= "http://localhost:3000";

beforeEach(async () => {
  /**
   * 🔴 앞 테스트가 「응답 뒤에 할 일」을 남겨 둔 채 끝났을 수 있다. 먼저 끝내지 않으면
   *    그 일이 **표를 비운 다음에** 도착해 다음 테스트에 남의 데이터가 섞인다.
   *    순서에 상관없이 돌게 하려고 표를 비우는 것인데, 이걸 빠뜨리면 그 노력이 무너진다.
   */
  await settleAfterResponse();
  // 앞 테스트가 시각을 얼려 둔 채 실패했을 수 있다.
  unfreeze();
  await resetDb();
  clearFakeOutbox();
});

afterAll(async () => {
  await settleAfterResponse();
  await closeDb();
});
