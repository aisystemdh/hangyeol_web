import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/setup/server-only-stub.ts", import.meta.url));
const nextHeadersStub = fileURLToPath(new URL("./tests/setup/next-headers-stub.ts", import.meta.url));

/**
 * 검증 자리(seam) 하나 — **주소를 함수로 직접 부른다.**
 *
 * 라우트 핸들러는 요청을 받아 응답을 돌려주는 함수일 뿐이라 서버를 띄우지 않고
 * 그대로 부를 수 있다. 진짜 Postgres를 붙이고 **알림톡만 가짜**로 바꾼다.
 * 여기 한 자리에 기한 계산 · 화면 선택 · 대기자 판정 · 정보 노출 · 상태 전이가 전부 모인다.
 *
 * 🔴 **계산만 따로 검사하는 자리를 만들지 않는다.** 이 시스템에서 제일 무서운 사고는
 *    계산 실수가 아니라 계좌·문항이 **새는 것**이고, 그건 계산만 봐서는 안 잡힌다 —
 *    계산은 다 맞는데 응답에 필드가 하나 딸려 나가는 식으로 샌다.
 */
export default defineConfig({
  resolve: {
    /**
     * ⚠️ 문자열 별칭(`{"@": src}`)을 쓰지 말 것. Vite의 문자열 별칭은 **앞부분만
     *    맞으면 바꿔치므로** `@vercel/analytics`까지 `src/vercel/analytics`로
     *    끌고 간다. `@/`까지 포함한 정규식이라야 안전하다.
     */
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      /**
       * `server-only`는 import되는 순간 던지는 것이 일인 패키지다(클라이언트 번들에
       * 딸려 들어가는 것을 막는 장치). 테스트는 애초에 서버 쪽이므로 빈 파일로 바꿔 끼운다.
       * 🔴 `src/lib/form9-copy.ts`의 `import "server-only"`를 **지우면 안 된다** —
       *    그 한 줄이 없으면 문항 전문이 브라우저 번들에 박힌다. 그래서 코드가 아니라
       *    테스트 쪽에서 비켜 간다.
       */
      { find: /^server-only$/, replacement: serverOnlyStub },
      /**
       * 🔴 `next/headers`의 `cookies()`는 요청 문맥 밖에서 던지고, `isAdmin()`은 그
       *    예외를 삼켜 `false`를 준다. 그대로 두면 **운영자 API는 무엇을 보내도 401**이라
       *    「로그인하면 열린다」를 영영 확인할 수 없다. 가짜가 `callRoute`가 만든
       *    요청의 쿠키를 그대로 읽어 준다.
       */
      { find: /^next\/headers$/, replacement: nextHeadersStub },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    /** 테스트 DB에 스키마를 세운다. 전체에서 한 번만 돈다. */
    globalSetup: ["./tests/setup/global-setup.ts"],
    /** 파일마다 돈다 — DB 주소 바꿔 끼우기 · 가짜 발송기 고르기 · 데이터 비우기. */
    setupFiles: ["./tests/setup/setup.ts"],
    /**
     * 🔴 **파일을 동시에 돌리지 않는다.** 테스트 DB가 하나뿐이라, 한 파일이 표를
     *    비우는 동안 다른 파일이 그 표에 쓰고 있으면 서로의 데이터를 지운다.
     *    순서에 상관없이 도는 것과 동시에 도는 것은 다른 이야기다 — 앞의 것만 지킨다.
     */
    fileParallelism: false,
    /** Neon이 잠들어 있으면 첫 연결에 몇 초가 걸린다. 그것 때문에 실패하지 않게 넉넉히. */
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
