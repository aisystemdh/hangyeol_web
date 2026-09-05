import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Design 핸드오프 번들 — 참조용 프로토타입이라 빌드·검사 대상이 아니다
    "design/**",
    // Claude Code 훅 — 앱이 아니라 도구 쪽 스크립트다(Node CommonJS).
    // 앱 규칙(`require()` 금지 등)을 적용할 대상이 아니다.
    ".claude/**",
  ]),
]);

export default eslintConfig;
