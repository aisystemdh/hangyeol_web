# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소

한결(Hangyeol) 회사 홈페이지 + 1차 오프라인 모임의 **신청 전 과정**
(사전등록 → 자리 확보 → 사전 문항 → 운영자 현황판).

Next.js 16.2.12 (App Router) · React 19.2.4 · TypeScript · Tailwind v4(preflight만, `@theme` 없음) ·
Postgres(Neon, `pg`). shadcn은 쓰지 않는다. 경로 alias `@/*` → `src/*`.

배포: Vercel 프로젝트 `hangyeol-official`(team `hangyeol3`), 리전 `sin1`.
원격: `github.com/aisystemdh/hangyeol_web`.

**이 코드베이스는 주석이 정본이다.** 아래 표는 지도일 뿐이고, 왜 그 값인지·무엇을 되돌리면
안 되는지는 각 파일 상단 주석에 실측 근거와 함께 적혀 있다. 파일을 고치기 전에 그 주석을 먼저 읽는다.

## 문서

- `docs/architecture.md` — 코드 전수 지도(테이블·API·화면·하드코딩·위험). **구조를 물으면 여기부터.**
- `docs/handoff/` — 세션 핸드오프. SessionStart 훅이 최신 파일을 자동 주입한다. 세션이 200k에 가까우면 `/handoff`.
- `docs/decisions/` — 설계 결정과 근거. 한 결정 한 파일.
- 기획 정본은 지식베이스 레포 `econoai0119-tech/hangyeol-knowledge-base`(로컬 `~/projects/hangyeol-knowledge-base`). 필요한 문서만 그때 읽는다.
- 작업 단위는 GitHub 이슈. 브랜치 `동현-<이슈번호>-<제목>` → PR → `main`.

## 소유자

여동현(한결 CTO, 기획·기술). HTML/CSS/JS를 학부 때 배우고 잊었고 이번이 첫 실제 웹사이트다.
수치 기준(초·px·대비)에 대한 직관이 없어 **왜 그 값인지 근거를 함께** 설명받기를 원한다 —
설명 없이 값만 바꾸면 배우지 못한다고 명시적으로 요청했다.

- 수치를 정할 때마다 임계값의 근거(WCAG 기준, 뷰포트 계산 등)를 한 줄이라도 붙인다.
- 큰 시각 결정(스크롤 방식·진행 표시 등)은 선택지를 주면 직접 고른다 — AskUserQuestion으로 묻는다.
- 실사용자 피드백을 수집해 와서 방향을 지시하는 스타일이다.
- 대화는 한국어.
- **이슈 작업을 끝내면 매번 자연어로 풀어서 보고한다.** 파일명·함수명·코드 diff를 나열하는 게 아니라
  "무엇이 문제였고(비유·상황으로) → 무엇이 바뀌었고 → 어떻게 확인했는지"를 전문용어 없이 설명한다.
  기술 용어가 필요하면 그 자리에서 한 줄로 풀어준다. PR·커밋 메시지와 별개로 대화창에서 매번 한다.

## 라우팅

경로·파일·인증·robots·API 목록 표는 `docs/architecture.md` §2(API 목록)·§3(화면 목록) 참고.

NAV 라벨과 순서는 `src/lib/site.ts`의 `NAV` 한 곳에서 온다.
경로는 `/mission`·`/principles` 그대로 두고 라벨만 다르다 — 이미 공유된 링크를 깨지 않기 위해서다.

🔴 토큰 경로(`/pre/[token]`, `/q/[token]`) 둘 다 `robots: { index: false }`다. 1단계는 남의 토큰이
색인될 수 있어서, 2단계는 **문항 자체가 영업비밀**이라서다. 지우지 말 것.

🔴 `/admin`은 참가자 20명의 이름·연락처·생년월일이 전부 보이는 화면이다.
**화면에서 한 번, API 하나하나에서 또 한 번** 막는다 — 둘 중 하나만 있으면 새기 쉽다.
운영자가 셋뿐이라 계정을 따로 두지 않고 공유 비밀번호 + HMAC 서명 쿠키(12시간)로 간다.
누가 눌렀는지는 남지 않으므로 상태를 바꿀 때 `actor`를 화면에서 고르게 해 기록에 이름을 남긴다.

🔴 **화면 검증을 믿지 않는다.** 주소만 알면 API를 직접 때릴 수 있다.
서버는 클라이언트가 보낸 나이를 믿지 않고 항상 `birth`로 다시 계산한다(`src/lib/age.ts`).

## 단일 출처 파일 — 값을 여기 말고 다른 데 적지 않는다

- **`src/lib/event.ts`** — 행사의 확정 사실. `EVENT`(날짜·시간·장소·정원·가격·나이) ·
  `REFUND` · `AGE_RANGE`. 카피에 숫자를 하드코딩하지 말고 여기서 가져온다.
  🔴 `EVENT.dateISO`(현재 `2026-10-24`)가 **기계가 읽는 행사일**이고 입금 기한·환불 경계·
  전체 마감이 전부 여기서 계산된다. 날짜가 바뀌면 이 한 줄만 고친다.
  화면 표기 `EVENT.date`("10월 24일 (토)")는 같은 날을 가리켜야 한다.
- **`src/lib/site.ts`** — 브랜드명·슬로건·NAV·CTA·연락처·`SITE_URL`.
  ⚠️ `SITE_URL`은 `??`가 아니라 `||`다. `??`로 되돌리면 환경변수를 빈 값으로 둔 순간
  `new URL("")`이 던져 **전 페이지가 500으로 죽는다**(실제로 죽었다).
- **`src/lib/deadline.ts`** — 기한 계산. 기한이 둘이고 **먼저 오는 쪽이 이긴다**:
  개인 기한(폼9 제출 시각 + 72시간)과 전체 마감(행사 7일 전 23:59:59 KST).
- **`src/lib/form9-copy.ts`** — 폼9 화면 문구 **전부**. 화면 코드에는 문자열이 없다.
  🔴 `import "server-only"`를 지우지 말 것 — 클라이언트 컴포넌트에서 import하면
  문항 전문이 브라우저 번들에 박혀 토큰 없는 사람도 JS만 열면 다 읽는다.
- **`src/lib/biz.ts`** — 사업자 신원·계좌. 🔴 **값을 저장소에 적지 않는다**(환경변수에서만).
  비어 있으면 화면이 빨간 경고를 띄운다 — 전자상거래법 §10① 표시 의무를 조용히 빠뜨리지 않기 위해서다.
- **`src/app/globals.css`** — 디자인 토큰과 공통 프리미티브 전부(약 1,600줄).

## 스타일 규칙

- **팔레트(2026-08 리브랜딩)**: 오프화이트 `--paper #F5F1E8` 바탕 + 딥그린 `--green-900 #1E3A2F` 잉크.
  테라코타 `--terra #C97B5A`는 **장식(선·점·바) 전용** — 종이 위 2.88:1이라 글자 금지,
  글자에는 `--terra-ink #9A5637`(4.95:1). `#fff`·`#111`을 다시 하드코딩하지 말 것.
  다크 모드 대응 없음(디자인 확정 사항).
- **px을 직접 적지 말고 토큰에서 고른다.** 고정 `--fs-1`~`--fs-5`(14·16·18·21·26px),
  반응형 제목 `--fs-6`~`--fs-8`·`--fs-display`·`--fs-display-page`, 여백 `--sp-1`~`--sp-7`,
  자간 `--ls-label`, 행간 `--lh-display/title/ui/body/prose`, 헤더 높이 `--header-h`.
  예외로 남는 일점물: `.hero__headline`(100px) · 워드플레이 2종 · 홈 퍼널 `.q`(하한 34px).
  `padding`·`left`·`grid-template-columns`는 토큰화하지 않았다 — 정렬을 떠받치는 값이 섞여 있다.
- **힌지식 4단 구조**를 예외 없이 반복: eyebrow → 큰 제목 → 본문 → 링크/CTA.
- **밴드 교차**: 종이 → 딥그린 → 종이 → 딥그린. `.band--dark`는 배경색이 아니라 **토큰을 반전**시키므로
  안의 요소가 자동으로 따라온다. 딥그린 밴드 안에서 색을 하드코딩하면 종이 위 종이가 된다.
- 토큰 대비는 전 조합 계산돼 있다(각 토큰 옆 주석). `--faint`(4.79:1)와 `--num`(19px 이상 굵은 글자
  전용)을 미달값으로 되돌리지 말 것.
- `word-break: keep-all`이 `body`에 있다. 없으면 한글이 어절 중간에서 끊긴다.
- 페이지 전용 스타일은 CSS Module로 만들고 globals.css는 건드리지 않는다.

## 되돌리면 깨지는 것 (전부 실측으로 확인됨)

자세한 근거는 각 파일 주석에 있다. 여기 있는 것은 **목록**이다.

**홈 무대 `HomeStage`** — 게이트 → 질문 3개 → 허브를 한 화면에서 잇는 상태 머신.

1. 레이어는 **상시 마운트 + opacity/visibility + inert**. 언마운트하면 인트로가 재생되고 스냅 높이가 요동친다.
2. `.layer`에 **position/z-index 금지** — 스태킹 컨텍스트가 생기면 안의 fixed 건너뛰기(z:61)가
   헤더(z:20) 아래 갇혀 클릭이 막힌다.
3. 인트로 끝은 `animationend`(`ulIn`)로 감지 — setTimeout 금지(스킵과 어긋난다).
4. **자동 진행 없음**(소유자 결정 — 읽는 속도를 강제하지 않는다). 전부 버튼 진행.
5. 진행 복원의 진실은 **sessionStorage**(`dialog-phase`·`dialog-chosen`)다.
   `html[data-dialog-phase]` 속성은 전체 로드의 첫 페인트용 보조일 뿐 — SPA 내비는 문서를
   재로드하지 않아 속성만 읽으면 그 경로의 복원이 통째로 빠진다. 속성 제거는 복원 phase가
   **커밋된 뒤**(별도 이펙트). 이펙트 안에서 flushSync 금지(하이드레이션 경고).
   React는 이 속성들을 렌더에서 읽지 않는다. 무대 내부에 `data-reveal` 금지.

**홈 퍼널 스냅** — `html:has([data-funnel])`이 루트에 `scroll-snap-type: y proximity`를 건다.
⚠️ mandatory 금지(Footer 도달 불가), `.screen`은 `min-height`+`svh`
(dvh 금지 — 주소창 개폐마다 스냅 지점이 흔들린다).
진행 표시는 `FunnelNav` — IO 1개가 점 레일과 모바일 진행 바를 함께 구동한다. 진실을 둘로 나누지 말 것.

**`SiteHeader.tsx`** — 모바일 오버레이는 **포털로 body에** 렌더한다. 헤더 안으로 되돌리면
헤더의 backdrop-filter가 fixed 자손의 컨테이닝 블록이 되어 메뉴가 64px 띠로 깨진다.
회전으로 768px를 넘으면 matchMedia 리스너가 메뉴를 닫는다 — 없으면 body 잠금·inert가 남아 페이지가 죽는다.

**`PageEffects.tsx`** — 스크롤 리빌·헤더 축소 전용. 앵커 이동은 CSS가 맡는다(JS 수동 보정 되살리지 말 것).

1. `useEffect` 의존성은 `[pathname]`이어야 한다. `[]`이면 헤더 링크로 이동한 페이지의
   `[data-reveal]`이 영원히 발화하지 않는다(이 컴포넌트는 layout에 있어 언마운트되지 않는다).
2. `[data-bar]`/`[data-line]`은 **부모를 관찰한다** — 시작 상태가 `scale(0)`이라 면적이 0이고,
   자기 자신을 관찰하면 IntersectionObserver가 절대 교차하지 않는다.

**`layout.tsx`** — `HOME_FLAGS_SCRIPT`가 하이드레이션 전에 `<html>`에 속성을 붙이므로
`<html>`의 `suppressHydrationWarning`이 필수다. 지우면 재방문 시 hydration mismatch가 난다.

**게이트 로고(`/`의 첫 화면, `LogoMark.tsx`)** — 소유자 모션그래픽
(`design/hangyeol-intro-motion.mp4`)을 벡터로 옮긴 1.5초 인트로다. 점이 가운데서 부풀어
올라가고(0–0.33초), 획이 터지듯 제 크기가 된 뒤(0–0.5초), 숨 쉬듯 두 번 커졌다 작아지고 멈춘다
(0.5–1.5초). 배율은 영상 37프레임을 한 장씩 실측한 값이다 — 근거는 `globals.css`의 같은 이름 절.
🔴 **하트를 되살리지 말 것.** 획이 커질수록 두 안쪽 끝이 서로 다가오는데, 맞닿는 순간 가운데
여백이 하트로 읽힌다. 그래서 최대 배율이 1.06으로 묶여 있다(영상 원본은 1.108이었고, 그대로
넣었더니 실제로 하트가 됐다 — 2026-09-03 화면 확인). `heart` 문자열로는 안 잡히니
**가장 커지는 순간을 직접 렌더해서 확인**할 것.
⚠️ 영상 파일 자체를 `<video>`로 붙이지 말 것 — 배경이 검정이고(사파리는 웹m 알파 미지원),
영상 속 로고가 실물보다 11% 넓으며 마지막 프레임도 흔들리는 중이다.
`prefers-reduced-motion`에서는 globals의 `animation: none`만으로 완성된 로고가 남는다
(시작 배율을 요소 style에 적으면 쪼그라든 채 굳는다).
⚠️ CSS Module 안에서 `animation: <globals의 키프레임 이름>`을 쓰면 **조용히 무시된다**
(모듈이 이름을 지역 해시로 바꿔친다). 게이트 문구·버튼이 그 함정으로 2026-08부터 지연 없이
떠 있었다. 모듈에서 쓸 키프레임은 그 모듈 안에 적는다 — `HomeHero.module.css`의 `riseIn`
3곳은 아직 그 상태다.

**`db.ts` 풀 크기** — ⚠️ `max: 1`로 두지 말 것. Neon 풀러는 **서버 쪽** 풀링이다.
클라이언트 풀이 1이면 한 인스턴스의 모든 질의가 한 줄로 서고, 동시 제출이 몰리면 뒤에 선 요청이
연결 타임아웃(500)으로 죽는다(폼9 27건 동시 제출 중 8건 사망, 2026-08-29 실측).
선착순 폼은 "다 같이 한 번에 몰리는" 것이 정상 동작이라 이 값이 곧 사고다.
연결은 풀러 주소(호스트에 `-pooler`)를 쓴다.

**알림** — `notify.ts`의 모든 호출은 실패해도 조용히 삼킨다.
🔴 알림 실패가 신청 실패가 되면 안 된다. 메일이 안 가는 것보다 신청이 저장되지 않는 것이 훨씬 나쁘다.

**레이트리밋** — `ratelimit.ts`는 인스턴스 메모리에만 있어 정확하지 않다. 막으려는 것은 분산 공격이
아니라 한 사람의 연타다. 진짜 방어선은 `phone` UNIQUE와 허니팟(`_gotcha`)이다.

## DB

테이블·컬럼·상태 머신 표는 `docs/architecture.md` §1(데이터 모델) 참고.

🔴 **개인정보 보유기간 3단을 화면에 고지했으므로 파기가 실제로 돌아야 한다.**
고지만 하고 안 지우면 그 고지 자체가 새 위반이 된다. 파기 배치는 아직 없다 — 만들 때 폼9와 한 번에 묶는다.

마이그레이션은 `db/migrations/`에 번호 순서로 있다(`001_applicant` → `004_split_form9`).
스키마를 새로 받거나 마이그레이션을 추가할 때는 **`db/README.md`를 먼저 읽는다.**

```bash
npm run db:migrate
npx vercel env pull .env.local   # DATABASE_URL 등을 로컬로 받아온다
```

## 환경변수

없을 때 무엇이 대체되는지 전 목록은 `docs/architecture.md` §5.8(환경변수 대조) 참고 —
코드가 읽는 이름·기본값·`.env.local`과의 어긋남까지 대조돼 있다. 가장 경계할 것 셋만 여기 남긴다:
`DATABASE_URL` 없으면 즉시 throw(저장되지 않는데 접수됐다고 말하는 사고가 가장 나쁘다),
`ADMIN_PASSWORD` 없으면 `/admin` throw, `NEXT_PUBLIC_SITE_URL` 없으면 `localhost:3000`으로
대체돼 토큰 링크·OG·sitemap이 전부 로컬 주소가 된다.

계측은 `src/lib/track.ts` 한 곳에서 정의하고 GA4 · Meta 픽셀 · Vercel Analytics로 보낸다.
⚠️ Vercel 커스텀 이벤트는 Pro 요금제부터라 Hobby에서 402로 막힌다(2026-08-21 실측).
🔴 이벤트에 개인정보를 절대 싣지 않는다 — 이름·연락처·나이를 인자로 넘기지 말 것.

## 개발 명령

```bash
npm run dev       # localhost:3000
npm run build     # 프로덕션 빌드 + 타입 검사
npm run lint
npx tsc --noEmit  # 타입만 검사
```

배포는 **GitHub `main` push → Vercel 자동 배포**다(프로젝트에 레포가 연결돼 있고 `git-main` 도메인이 붙어 있다).
`npx vercel --prod`로 CLI 배포하면 alias를 손으로 다시 걸어야 하므로 쓰지 않는다.

⚠️ Next 16은 **같은 프로젝트 디렉터리에 두 번째 dev 서버를 거부**한다(`-p`로 포트를 바꿔도 소용없다).
이미 떠 있는 서버가 있으면 그쪽에 붙어 확인하고, 남의 프로세스를 죽이지 않는다.
dev 서버가 떠 있는 동안 `npm run build`를 돌리면 `.next`가 충돌한다 — `distDir`를 임시로 바꿔
빌드하고 반드시 되돌릴 것(`next build`는 `tsconfig.json`도 함께 고쳐 놓는다).

## 저장소 위생

`01_brand_philosophy.md`는 `.gitignore`에 등록돼 있고 추적되지 않는다. `.claude/`는 `settings.local.json`만 제외하고 팀과 공유한다.
한 번 푸시되면 히스토리에서 지우기 매우 어렵다 — **`.gitignore`의 대외비 항목을 절대 건드리지 말 것.**

## Agent skills

Matt Pocock 엔지니어링 스킬(`/triage` · `/to-tickets` · `/to-spec` · `/wayfinder` 등)이
저장소별 설정을 여기서 읽는다. 값은 `docs/agents/`에 있고 이 절은 요약일 뿐이다.

### Issue tracker

이슈는 GitHub Issues(`aisystemdh/hangyeol_web`)에 있고 `gh` CLI로 다룬다. `docs/agents/issue-tracker.md` 참고.

### Triage labels

triage 5역할에 한국어 라벨을 쓴다 — `wontfix`만 저장소에 이미 있는 영어 라벨을 재사용한다. `docs/agents/triage-labels.md` 참고.

### Domain docs

단일 컨텍스트. 결정 문서는 템플릿 기본값 `docs/adr/`가 아니라 기존 `docs/decisions/`다. `docs/agents/domain.md` 참고.
