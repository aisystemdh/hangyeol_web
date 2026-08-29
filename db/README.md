# db — 사전등록과 결제 상태

## 왜 있나

이 폴더가 생기기 전, 랜딩 신청 폼은 Formspree로 **메일만** 보냈다. 사전 등록을
받고 있다고 생각했지만 실제로는 아무 데도 쌓이지 않았고, 그래서 「몇 명이
등록했나」·「성비가 어떤가」·「누가 입금했나」를 아무도 알 수 없었다.

## 마이그레이션 돌리는 법

`DATABASE_URL`은 Vercel > Storage에서 Neon을 붙이면 자동으로 생긴다.
로컬로 받아오려면 `npx vercel env pull .env.local`.

**방법 1 — Neon 콘솔 (권장)**
Neon 대시보드 > SQL Editor를 열고 `migrations/` 안의 파일을 **번호 순서대로**
통째로 붙여넣어 실행한다. 결과가 눈에 보여서 처음 한 번은 이 편이 안전하다.

**방법 2 — psql**

```bash
psql "$DATABASE_URL" -f db/migrations/001_applicant.sql
```

## 규칙

- **마이그레이션은 고치지 않고 새로 더한다.** 이미 돌아간 파일을 고치면 어느
  환경이 어디까지 적용됐는지 알 수 없게 된다. `002_...sql`을 새로 만든다.
- 모든 문장은 **여러 번 돌려도 안전하게**(`if not exists`, `on conflict do nothing`)
  쓴다. 중간에 실패했을 때 처음부터 다시 돌릴 수 있어야 한다.
- 스키마의 근거는 지식베이스
  `오프라인 프로그램/8_참가자모집/한결_신청결제_DB인계.md`다. 컬럼을 바꾸기 전에
  그 문서를 먼저 본다.

## 지금까지

| 파일 | 무엇 |
|---|---|
| `001_applicant.sql` | `applicant`(신청 전원) · `applicant_event`(상태 전이 로그) · `gender_slot`(남10·여10 선착순 카운터) · `recruit_display`(공개용 워터마크) |

## 잔여

`payment` · `participant` · `answer_pre`는 폼9 작업(`002`)에서 만든다.
