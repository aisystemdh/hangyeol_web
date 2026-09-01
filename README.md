# 한결 (Hangyeol)

한결 회사 홈페이지. 브랜드 소개 5페이지 + 1차 오프라인 모임 신청(사전등록 → 자리 확보 →
사전 문항 → 운영자 현황판)까지 전 과정을 포함한다.

Next.js 16(App Router) · React 19 · TypeScript · Tailwind v4 · Postgres(Neon).

## 개발

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

DB 스키마를 새로 받거나 마이그레이션을 추가할 때는 `db/README.md`를 먼저 읽는다.

```bash
npm run db:migrate
```

## 배포

Vercel 프로젝트 `hangyeol-official`(team `hangyeol3`)에 배포한다.

```bash
npx vercel --prod --scope hangyeol3
```

## 더 알아보기

라우팅 구조·카피 규칙·대외비 취급·코드 구조 등 실제 작업 규칙은
**[`CLAUDE.md`](./CLAUDE.md)**에 있다. 기획 원본은 이 저장소가 아니라 별도 옵시디언
볼트에 있다 — 자세한 건 `CLAUDE.md`의 "문서 라우팅" 참조.
