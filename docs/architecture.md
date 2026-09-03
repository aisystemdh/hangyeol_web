# hangyeol_web 아키텍처 지도

작성 기준: `C:\Users\hyund\projects\hangyeol_web` 전수 읽기 (2026-09-02). 모든 경로는 저장소 루트 기준. 줄 번호는 읽은 시점의 파일 기준이다.

## 0. 한눈에

| 항목 | 값 | 출처 |
|---|---|---|
| 프레임워크 | Next.js 16.2.12 App Router · React 19.2.4 · TypeScript strict · Tailwind v4 (preflight만) | `package.json:12-30`, `CLAUDE.md:10-11` |
| DB | Neon Postgres, `pg` Pool (max 10) | `src/lib/db.ts:29-34` |
| 배포 | Vercel `hangyeol-official` (team `hangyeol3`), region `sin1` | `vercel.json:3`, `.vercel/project.json` |
| 코드 규모 | TS/TSX 약 8,200줄 (globals.css 1,610줄 별도) | `wc -l` |
| 라우트 | 공개 4 + 행사 1 + 토큰 2 + 운영 2 = 페이지 9, API 9 | §2, §3 |
| 소스 파일 수 | `src/app` 30, `src/components` 36(모듈 CSS 포함), `src/lib` 12 | `find` |
| next.config | 비어 있음 (`{}`) | `next.config.ts:3-5` |

이 저장소는 "주석이 정본"이라는 원칙으로 쓰여 있다(`CLAUDE.md:16-17`). 아래 지도는 그 주석과 실제 코드가 어긋나는 지점까지 함께 적는다.

---

## 1. 데이터 모델

### 1.1 마이그레이션 이력

| 파일 | 무엇을 바꿨나 |
|---|---|
| `db/migrations/001_applicant.sql` | `pgcrypto` 확장, `applicant`, `applicant_event`, `gender_slot`(M/F 각 capacity 10 시드), `recruit_display`(M/F high_water 0 시드), `touch_updated_at()` 트리거 |
| `db/migrations/002_payment_participant.sql` | `participant`(옛 구조: 신원·동의를 전부 보유), `answer_pre`(nick PK), `payment` + 부분 유니크 인덱스 |
| `db/migrations/003_form9_on_applicant.sql` | 폼9 컬럼 10개를 `applicant`에 추가, `applicant_marital_ck`, `applicant_pre_token_uq`; `answer_pre`·`participant`를 **drop 후 재생성**(얇은 구조) |
| `db/migrations/004_split_form9.sql` | `applicant.q_token` + `applicant_q_token_uq`, `pre_link_at`, `q_link_at` |

실행기 `db/migrate.mjs`: `schema_migration(name, applied_at)` 표에 적용 파일명을 남기고 건너뛴다(`db/migrate.mjs:37-56`). 파일 하나가 한 트랜잭션(`:60-65`). `DATABASE_URL`은 env → `.env.local` 순으로 찾는다(`:17-32`).

⚠️ `db/README.md:14-22`는 Neon 콘솔에 붙여넣기(방법 1)·psql(방법 2)만 안내하고 `migrate.mjs`를 언급하지 않는다. 콘솔로 적용하면 `schema_migration`에 기록이 남지 않으므로, 이후 `npm run db:migrate`를 돌리면 001~004가 **다시** 실행된다. 003은 `drop table if exists answer_pre`(`003:38`)·`drop table if exists participant`(`003:51`)를 무조건 실행하므로 **운영 데이터가 있는 상태에서 재실행되면 답변·참가자 표가 사라진다.** §8 참조.

### 1.2 테이블

#### `applicant` — 신청한 전원 (`001:16-52` + `003:15-25` + `004:15-22`)

| 컬럼 | 타입 | 제약/기본값 | 채우는 곳 |
|---|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` | 자동 |
| `name` | text | not null | `/api/apply` INSERT (`apply/route.ts:87-99`), `/api/pre` UPDATE (`pre/[token]/route.ts:196-207`) |
| `phone` | text | not null, **UNIQUE** `applicant_phone_uq` (`001:55`) | 위와 같음 (숫자만 저장) |
| `gender` | text | not null, check `M`/`F` | 위와 같음 |
| `birth` | date | not null (`age` 컬럼 없음 — `001:23-24`) | 위와 같음 |
| `status` | text | not null default `pre_registered`, check 9값 (`001:27-29`) | §1.4 |
| `seq` | bigserial | not null. **선착순 근거. 번호가 빈다**(`001:31-36`) | 자동 |
| `notified_at` | timestamptz | | 운영자 전이 `→awaiting_payment` 때만 now() (`transition/route.ts:82`) |
| `due_at` | timestamptz | 부분 인덱스 `applicant_due_at where status='awaiting_payment'` (`001:57-58`) | `/api/pre` POST (`pre:203`), 전이 `→awaiting_payment` (`transition:83`) |
| `reminded_at` | timestamptz | | **아무 코드도 쓰지 않음** |
| `kakao_linked` | boolean | not null default false | **아무 코드도 쓰지 않음** |
| `privacy_agreed_at` | timestamptz | not null | `/api/apply` (now()) |
| `marketing_agreed_at` | timestamptz | nullable | `/api/apply` (`apply:97`) |
| `memo` | text | | `/api/apply` 나이 범위 밖일 때 `"자격 확인 필요 — 신청 시점 만 N세"` (`apply:98`) |
| `created_at` / `updated_at` | timestamptz | default now(); `applicant_touch` 트리거가 `updated_at` 갱신 (`001:98-107`) | 자동 |
| `pre_token` | text | 부분 UNIQUE `applicant_pre_token_uq where not null` (`003:33-34`) | `/api/admin/applicants/[id]/token` stage=pre (`token/route.ts:66-69`) |
| `marital` | text | check null 또는 `미혼`/`기혼` (`003:27-30`) | `/api/pre` POST |
| `job` | text | | `/api/pre` POST |
| `email` | text | nullable | `/api/pre` POST |
| `depositor_name` | text | 신청자와 다를 때만 | `/api/pre` POST (`pre:174-177`) |
| `truth_agreed_at` / `refund_agreed_at` | timestamptz | | `/api/pre` POST now() (`pre:200-201`) |
| `email_agreed_at` | timestamptz | | `/api/pre` POST, 이메일 있을 때만 (`pre:206`) |
| `held_at` | timestamptz | 🔴 선착순 기준점 (`003:23`) | `/api/pre` POST (`pre:203`) |
| `submitted_at` | timestamptz | 1단계 제출 시각. 두 번째 제출 거부 근거 (`pre:126`) | `/api/pre` POST |
| `q_token` | text | 부분 UNIQUE `applicant_q_token_uq` (`004:17-18`) | token 라우트 stage=q |
| `pre_link_at` / `q_link_at` | timestamptz | 링크 발급 시각 (`004:21-22`) | token 라우트 (`token:71`) |

인덱스: `applicant_phone_uq(phone)`, `applicant_status_seq(status, seq)`, `applicant_due_at(due_at) where status='awaiting_payment'`, `applicant_pre_token_uq`, `applicant_q_token_uq`.

#### `applicant_event` — 상태 전이 로그 (`001:62-71`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `applicant_id` | uuid not null FK → applicant **on delete cascade** | |
| `from_status` | text | nullable (최초 등록은 null) |
| `to_status` | text not null | |
| `reason` | text | |
| `actor` | text not null | `'system'` 또는 운영자가 화면에서 적은 이름 |
| `at` | timestamptz default now() | 인덱스 `(applicant_id, at)` |

기록하는 곳: `/api/apply` (`apply:102-107`, actor `system`, reason `랜딩 사전등록`), `/api/pre` POST (`pre:209-213` reason `1단계 제출 — 자리 확보`; `pre:223-227` reason `1단계 제출 시점에 해당 성별 자리 마감`), 전이 (`transition:88-92`, actor = body.actor), 입금 (`payments:61-65`, actor = `verified_by`, reason `입금 확인 N원 · 입금자 X`).

#### `gender_slot` — 성별 선착순 카운터 (`001:79-85`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `gender` | text PK check M/F | 시드 `('M',0,10),('F',0,10)` |
| `taken` | integer not null default 0 check ≥0 | |
| `capacity` | integer not null | **DB 값 10이 코드의 `EVENT.capacityPerGender`(10)와 별개로 존재** |

증감하는 곳: `/api/pre` POST `taken+1 where taken<capacity` (`pre:188-194`), 전이 라우트에서 슬롯 보유 상태 진입/이탈 시 ±1 (`transition:61-75`). 입금 라우트는 건드리지 않는다(이미 awaiting_payment가 쥐고 있음).

#### `recruit_display` — 공개 워터마크 (`001:90-95`)

| 컬럼 | 타입 |
|---|---|
| `gender` | text PK |
| `high_water` | integer default 0 |

`/api/recruit` GET이 `confirmed` 수가 더 크면 올린다(`recruit/route.ts:33-39`). 내려가지 않는다. **GET이 호출될 때만 갱신된다**(lazy).

#### `participant` — 확정된 20명 (`003:51-58`, 002 구조를 drop)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `nick` | text PK | `결1`~`결20`, 가장 작은 빈 번호 (`payments:73-81`) |
| `applicant_id` | uuid unique not null FK | |
| `site_token` | text unique not null | 현장 폼(10~14)용. **생성만 되고 읽는 라우트가 없음** |
| `created_at` | timestamptz | |

#### `answer_pre` — 사전 10문항 (`003:38-47`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `applicant_id` | uuid PK FK on delete cascade | |
| `a` | jsonb not null | 길이 10. 인덱스 3·5(0-based)는 `[나, 상대]` 2원 배열, 마지막은 1~3 |
| `consent` | boolean not null | 2부 비교표 동의 |
| `at` | timestamptz | |

쓰는 곳: `/api/q` POST (`q/[token]/route.ts:129-132`). 읽는 곳: `/api/q` GET의 `answered` 판정(`q:35-39`)뿐. **운영자 화면·API 어디에서도 답 내용을 읽지 않는다.**

#### `payment` — 입금 대사 (`002:54-78`)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `applicant_id` | uuid not null FK | 부분 UNIQUE `payment_applicant_uq where refunded_at is null` |
| `amount` | integer not null | 원 단위 |
| `depositor` | text not null | 통장 입금자명 |
| `deposited_at` | timestamptz not null | 미지정 시 now() (`payments:34`) |
| `method` | text default `bank_transfer` | |
| `verified_by` | text not null | 운영자 이름 |
| `verified_at` | timestamptz default now() | |
| `refunded_amount` | integer default 0 | **쓰는 코드 없음** |
| `refunded_at` / `refund_reason` | | **쓰는 코드 없음** (환불 API 없음) |
| `note` | text | |

#### `schema_migration` (`db/migrate.mjs:37-42`)
`name text PK`, `applied_at`.

### 1.3 열거값

| 종류 | 값 | 정의 위치 |
|---|---|---|
| `applicant.status` | `pre_registered`, `approved`, `awaiting_payment`, `confirmed`, `waitlist`, `rejected`, `expired`, `refund_requested`, `refunded` | `001:27-29` (DB check), `transition/route.ts:16-26` (전이표), `Board.tsx:7-11` (한글 라벨), `Board.tsx:13-20` (전이표 복제) |
| `gender` | `M`, `F` | DB check 3곳, 라벨 `남/여` (`Board.tsx:177`, `notify.ts:41`), `남성/여성` (`recruit:23`) |
| `marital` | `미혼`, `기혼` | `003:29`, `pre:152`, `form9-copy` 없음(화면 하드코딩 `PreForm.tsx:202`) |
| `payment.method` | `bank_transfer`만 | `002:62` |
| 모집 phase | `hidden`, `counting`, `closed`, `unknown` | `recruit/route.ts:60-79, 92` |
| 링크 stage | `pre`, `q` | `token/route.ts:39` |
| `LinkDelivery.channel` | `manual`, `alimtalk` | `notify.ts:68` |
| 홈 Phase | `gate hero a1 t1 a2 t2 a3 why cmp a4 hub` | `HomeStage.tsx:41-52` |

### 1.4 `applicant.status` 상태 머신

허용 전이(운영자 API, `src/app/api/admin/applicants/[id]/transition/route.ts:16-26`; 동일 표가 `src/app/admin/Board.tsx:13-20`에 복제됨):

```
pre_registered   → approved | waitlist | rejected
approved         → awaiting_payment | waitlist | rejected
awaiting_payment → confirmed | expired | waitlist
waitlist         → approved
confirmed        → refund_requested
refund_requested → refunded
expired          → waitlist
rejected         → (없음)
refunded         → (없음)
```

- 슬롯 보유 상태 = `{awaiting_payment, confirmed}` (`transition:29`). 보유→비보유로 나가면 `taken-1`(`:61-67`), 비보유→보유로 들어오면 `taken+1 where taken<capacity`, 실패 시 409 `full`(`:68-75`).
- `→awaiting_payment`일 때만 `notified_at=now()`, `due_at=dueAtFrom(now)` (`:78-85`).
- 화면(`Board.tsx:209`)은 `confirmed` 버튼을 **숨긴다** — 확정은 입금 기록(`/api/admin/payments`)으로만 하게 유도. API 자체는 `awaiting_payment→confirmed`를 허용한다(슬롯 변화 없음).

시스템 전이(운영자 손을 거치지 않음):

| 전이 | 어디서 | 조건 |
|---|---|---|
| (없음) → `pre_registered` | `/api/apply` INSERT 기본값 (`001:27`, `apply:87-99`) | phone UNIQUE 통과 |
| (현재값 무관) → `awaiting_payment` | `/api/pre/[token]` POST (`pre:196-207`) | `pre_token` 일치 · `submitted_at` null · 마감 전 · `gender_slot` 확보 성공. **현재 status를 검사하지 않는다** |
| (현재값, `confirmed` 제외) → `waitlist` | `/api/pre/[token]` POST 슬롯 실패 (`pre:219-222`) | 트랜잭션 밖에서 별도 UPDATE |
| `awaiting_payment` → `confirmed` | `/api/admin/payments` (`payments:49-59`) | `from === 'awaiting_payment'`만 허용 |

자동 만료(`due_at` 경과 → `expired`)는 **없다**. 현황판이 `지남`으로 표시할 뿐(`Board.tsx:190-191`)이고 운영자가 `기한초과` 버튼을 눌러야 슬롯이 풀린다. 개인정보 파기 배치도 없다(`CLAUDE.md:178-180`이 인정).

⚠️ 슬롯 이중 확보 경로: 운영자가 `approved→awaiting_payment`를 누르면 슬롯 +1(`transition:68-75`). 그 뒤 같은 사람이 1단계 링크를 제출하면 `/api/pre` POST가 다시 +1(`pre:188-194`)한다 — 한 사람이 두 칸을 쥔다. 반대로 슬롯 실패 시 `waitlist`로 내릴 때(`pre:219-222`) 기존 보유 슬롯을 반납하지 않는다. `rejected`·`expired` 상태인 사람도 `pre_token`만 있으면 1단계를 제출해 `awaiting_payment`가 된다.

---

## 2. API 목록

인증 구분: **public** = 누구나, **token** = URL 토큰이 신원, **admin** = `hg_admin` 쿠키(`isAdmin()`). 모든 라우트가 `runtime="nodejs"`, `dynamic="force-dynamic"`.

| # | 메서드·경로 | 파일 | 인증 | 읽기 | 쓰기 | 보호 장치 |
|---|---|---|---|---|---|---|
| 1 | `POST /api/apply` | `src/app/api/apply/route.ts` | public | — | `applicant`, `applicant_event` | IP 레이트리밋 5회/60초(`:35`), 허니팟 `_gotcha`(`:50-52`), phone UNIQUE |
| 2 | `GET /api/recruit` | `src/app/api/recruit/route.ts` | public | `applicant`(confirmed 집계), `recruit_display` | `recruit_display` (워터마크 상향) | CDN 캐시 `s-maxage=60, swr=300`(`:85`) |
| 3 | `GET /api/pre/[token]` | `src/app/api/pre/[token]/route.ts` | token(`pre_token`) | `applicant` | — | 토큰 정규식 `^[A-Za-z0-9_-]{12,64}$`(`:56`) |
| 4 | `POST /api/pre/[token]` | 같은 파일 | token | `applicant` | `gender_slot`, `applicant`, `applicant_event` (tx) | 위 + `submitted_at` 이중 제출 거부, 마감 |
| 5 | `GET /api/q/[token]` | `src/app/api/q/[token]/route.ts` | token(`q_token`) | `applicant` ⨝ `answer_pre` | — | `status='confirmed'`만 문항 반환 |
| 6 | `POST /api/q/[token]` | 같은 파일 | token | 위 | `answer_pre` | PK 충돌 → 409 |
| 7 | `POST /api/admin/login` | `src/app/api/admin/login/route.ts` | public (비밀번호) | — | 쿠키 발급 | 600ms 고정 지연(`:8,12`). **레이트리밋 없음** |
| 7' | `DELETE /api/admin/login` | 같은 파일 | public | — | 쿠키 삭제 | — |
| 8 | `GET /api/admin/applicants` | `src/app/api/admin/applicants/route.ts` | admin | `applicant` ⟕ `participant` ⟕ `payment` | — | `isAdmin()` (`:10`) |
| 9 | `POST /api/admin/applicants/[id]/transition` | `.../[id]/transition/route.ts` | admin | `applicant` (for update) | `gender_slot`, `applicant`, `applicant_event` (tx) | `isAdmin()` (`:32`), ALLOWED 표 |
| 10 | `POST /api/admin/applicants/[id]/token` | `.../[id]/token/route.ts` | admin | `applicant` | `applicant.pre_token/q_token`, `*_link_at` | `isAdmin()` (`:35`), q는 confirmed만 |
| 11 | `POST /api/admin/payments` | `src/app/api/admin/payments/route.ts` | admin | `applicant` (for update), `participant` | `payment`, `applicant.status`, `applicant_event`, `participant` (tx) | `isAdmin()` (`:20`), `payment_applicant_uq` |

### 2.1 `POST /api/apply`
요청 JSON: `name`(trim 후 1~20자, `:55-58`), `phone`(비숫자 제거 후 `^010\d{8}$`, `:60-64`), `gender`(`M`/`F`, `:66-67`), `birth`(`YYYY-MM-DD` 실재 날짜, 만 10~100세, `:69-77`), `privacy_agreed`(`=== true`, `:79-81`), `marketing_agreed`(선택), `_gotcha`(허니팟). 나이가 `EVENT.ageMin~ageMax` 밖이어도 **저장**하고 `memo`에 남긴다(`:73-78, 98`).
응답: 201 `{ok:true, seq}`; 허니팟 걸리면 201 `{ok:true, seq:0}`(`:51`); 400 `bad_json|bad_name|bad_phone|bad_gender|bad_birth|need_privacy`; 409 `duplicate`(`:124-130`); 429 `rate_limited`; 500 `server`.
부수효과: `after()`로 응답 후 `notifyNewApplicant()` 호출(`:116-120`).

### 2.2 `GET /api/recruit`
`confirmed` 수만 센다(`:36-38`). 응답 `{phase, message, remaining?}`: `closed`(양쪽 0), `counting`(확정 합 ≥ `EVENT.capacity/2`=10, `remaining:{M,F}` 포함), `hidden`(그 미만). 실패 시 200 `{phase:"unknown", message:""}`(`:92`). 메시지 문구가 라우트에 하드코딩(`:65, 71, 78`).

### 2.3 `GET/POST /api/pre/[token]` (폼9 1단계 — 자리 확보)
GET 응답 3종: 이미 제출 `{submitted:true, due_at, name, copy:{already,done}, biz}`(`:74-83`); 마감 `{closed:true, copy:{closed}}`(`:85-92`); 정상 `{prefill:{name,gender,phone,birth}, copy:STAGE1_COPY, biz}`(`:94-102`). `biz()`는 계좌·사업자 값(환경변수)을 포함해 **토큰만 맞으면 누구에게나** 내려간다. 문항은 없다(`:36-50`).
POST 요청 `{profile:{name(≥2자), phone(010), birth, gender, marital(미혼|기혼), job(필수), email(선택, 형식+email_agreed 필수), privacy_agreed, truth_agreed}, payment:{depositor_name?, refund_policy_agreed}}` (`:137-177`).
처리: `dueAtFrom(now)` 계산(`:180-181`) → tx: `gender_slot` +1 조건부(`:188-194`) → `applicant` UPDATE(신원 덮어쓰기 + `status='awaiting_payment'`, `held_at=submitted_at=now`, `due_at`) → 이벤트 로그.
응답: 201 `{ok, due_at, depositor}`; 404 `unknown_token`; 409 `already_submitted`; 410 `closed`; 400 검증 코드 9종; 409 `full` + `{gender, copy:{full}}`(`:228`, 이때 status→`waitlist`); 500.

### 2.4 `GET/POST /api/q/[token]` (폼9 2단계 — 10문항)
GET: 이미 답함 `{submitted:true, copy:{already,qDone}}`(`:51-57`); 미확정 **403** `{error:"not_paid", copy:{notPaid}}`(`:60-65`); 정상 `{name, questions:QUESTIONS, pairedIndexes, copy:{qStart,questions,compare,qDone,already,unknown}}`(`:67-81`).
POST `{answers: (number|[1|2,1|2])[10], consent: boolean}` 검증(`:109-127`): 길이 = `QUESTIONS.length`, 페어드 인덱스는 길이 2 배열의 1|2, 그 외 1..choices.length. `bad_answers`에 `at`(1-based) 포함. 201 `{ok}`; 409 `already_submitted`(사전 검사 및 23505); 403 `not_paid`; 404; 500.

### 2.5 `POST/DELETE /api/admin/login`
`{password}` → `makeSession()` (§6). 성공 시 `hg_admin` 쿠키 `httpOnly, secure, sameSite=lax, path=/, maxAge=43200`(`:20-26`). 실패 401 `{ok:false}`. DELETE는 maxAge 0으로 지운다. 화면(`LoginForm.tsx:15-21`)은 성공 시 `window.location.href="/admin"`.

### 2.6 `GET /api/admin/applicants`
`loadBoard()`(§4 `admin-data.ts`) 결과 `{ok, counts, items}`. 현황판이 30초마다 호출(`Board.tsx:54`). 401이면 화면이 로그인으로 보낸다(`Board.tsx:42`).

### 2.7 `POST /api/admin/applicants/[id]/transition`
`{to, reason?, actor}` — `to`·`actor` 필수(`:40-42`). 응답 200 `{ok, from, to}`; 404 `not_found`; 409 `not_allowed {from,to}` / `full {gender}`; 400; 500. 상세는 §1.4.

### 2.8 `POST /api/admin/applicants/[id]/token`
`{stage:"pre"|"q"}`. `q`는 `status==='confirmed'`가 아니면 409 `not_confirmed`(`:55-60`). 기존 토큰이 있으면 재사용(`:64-69`), `*_link_at=now()` 갱신(`:71`). URL은 `${SITE_URL}/pre|q/${token}`(`:73`). `sendPreLink`/`sendQuestionLink`는 항상 `{channel:"manual", ok:false}`(`notify.ts:73-88`). 응답 `{ok, url, sent}`. 화면은 클립보드 복사(`Board.tsx:87-93`).

### 2.9 `POST /api/admin/payments`
`{applicant_id, amount:number, depositor, verified_by, deposited_at?, note?}` 필수 4개(`:31-33`). tx(`:40-87`): `for update` 잠금 → `awaiting_payment` 아니면 409 `not_awaiting {from}` → `payment` INSERT → `status='confirmed'` → 이벤트 로그 → `participant` INSERT(`결N` 최소 빈 번호 + `newToken()` site_token). 금액 ≠ `FEE`(`EVENT.priceLabel`에서 숫자 추출, `:10`)면 저장하되 `warn` 문자열 반환(`:85`). 23505 → 409 `already_paid`(`:94-96`). 응답 `{ok, payment_id, nick, warn}`.

---

## 3. 화면 목록

| 경로 | 파일 | 렌더 | 데이터 | 컴포넌트 | robots | API 호출 |
|---|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | 서버(정적) + 클라이언트 무대 | `EVENT`, `SITE`, `EVENT_HREF` (모듈 상수) | `FunnelNav`, `HomeStage`(→`HomeGate`,`HomeHero`,`HomeDialog`), `InstagramLink` | index (canonical `/`) | 없음 (track만) |
| `/mission` | `src/app/mission/page.tsx` | 서버(정적) | 파일 내 상수 `WORDS`, `LAYERS`, `ANATOMY` 등 카피 | `BackToDialog`, `StickyBar`, `Link` | index, canonical `/mission` | 없음 |
| `/why` | `src/app/why/page.tsx` | 서버(정적) | 파일 내 카피 | `BackToDialog`, `StickyBar` | index | 없음 |
| `/principles` | `src/app/principles/page.tsx` | 서버(정적) | 파일 내 `PRINCIPLES`, `GROUND_RULES`, `HIDDEN`, `ALLOWED` | `BackToDialog`, `StickyBar` | index | 없음 |
| `/events/1` | `src/app/events/1/page.tsx` | 서버(정적) + `RecruitStatus`/`ApplyForm` 클라이언트 | `EVENT`, `EVENT_SCHEMA`, `SITE`; JSON-LD `Event` (`:30-65`) | `Hero`, `Identity`, `Timeline`, `Founders`, `Apply`(→`ApplyForm`,`RecruitStatus`), `Faq`, `StickyBar` | index, canonical `/events/1` | `GET /api/recruit`(`RecruitStatus.tsx:26`), `POST /api/apply`(`ApplyForm.tsx:166`) |
| `/pre/[token]` | `src/app/pre/[token]/page.tsx` | 서버 셸(`force-dynamic`) → `PreForm` 클라이언트 | 전부 `/api/pre/[token]`에서 | `PreForm` | **noindex, nofollow, nocache** (`:10`) | GET/POST `/api/pre/[token]` |
| `/q/[token]` | `src/app/q/[token]/page.tsx` | 동일 구조 | `/api/q/[token]` | `QuestionForm` | **noindex** (`:10`) | GET/POST `/api/q/[token]` |
| `/admin/login` | `src/app/admin/login/page.tsx` | 서버 셸 → `LoginForm` 클라이언트 | — | `LoginForm` | **noindex** (`:12`) | `POST /api/admin/login` |
| `/admin` | `src/app/admin/page.tsx` | 서버(`force-dynamic`): `isAdmin()` 아니면 `redirect("/admin/login")`(`:24`), `loadBoard()` 결과를 `Board`에 initial로 | `loadBoard()` 직접 (DB) | `Board` | **noindex** (`:20`) | 30초마다 `GET /api/admin/applicants`, 버튼별 transition/token/payments |
| `/robots.txt` | `src/app/robots.ts` | 전부 allow + sitemap URL | `SITE_URL` | — | — | — |
| `/sitemap.xml` | `src/app/sitemap.ts` | `/` + `NAV` + `EVENT_HREF` (5개) | `site.ts` | — | — | — |

레이아웃(`src/app/layout.tsx`): `metadataBase = new URL(SITE_URL)`(`:72`), 제목/설명 템플릿(`:50-52`), OG `/og-v2.png`(`:63-68`), `Organization` JSON-LD(`:100-113`, founder = `SITE.operators`), `HOME_FLAGS_SCRIPT` 인라인(`:142`), `<html suppressHydrationWarning>`(`:153`). 본문 순서: `SiteChrome>GrainCanvas` → skip-link → JSON-LD → `SiteChrome>SiteHeader` → `<main id="main">` → `SiteChrome>(Footer, PageEffects, Analytics)`.

`SiteChrome`(`src/components/SiteChrome.tsx:21-25`)은 `/admin*`, `/pre/*`, `/q/*`에서 자식을 렌더하지 않는다 → 그 경로들에는 헤더·푸터·나뭇결·**Analytics(GA4·Pixel·Vercel)·PageEffects**가 전부 빠진다.

### 3.1 홈 무대 상태 머신 (`HomeStage.tsx`)

```
gate ─시작(gate_start)──▶ a1 ─▶ t1 ─▶ a2 ─▶ t2 ─▶ a3 ─▶ why ─▶ cmp ─▶ a4 ─▶ hub
  └──건너뛰기(gate_skip)─▶ hero ─CTA(hero_start)─▶ a1
```

| Phase | 레이어 소유 | 진입 | 의미 |
|---|---|---|---|
| `gate` | `HomeStage`→`HomeGate` (`HomeStage.tsx:348-356`) | 초기값. `replayFromGate()`(`:289-306`) | 로고 + 「시작/건너뛰기」 |
| `hero` | `HomeHero` (`:359-366`) | `skipFromGate` (`:166-169`) | 텍스트 애니메이션 + 「세 번 물어보겠습니다 →」 |
| `a1` | `HomeDialog` | `startFromGate`(`:161-164`), `startFromHero`(`:172-175`), `restartQuestions`(`:233-236`), `goToQuestion(1)` | 질문 1 (pass/say) |
| `t1` | `HomeDialog` | `onA1` (`:181-190`) — a2를 null로 리셋 | 되돌림 1 (타자기) |
| `a2` | `HomeDialog` | 「다음」 `NEXT` 표 (`:70-82`) | 질문 2 (이유: minor/futile 또는 accurate/future) |
| `t2` | `HomeDialog` | `onA2` (`:196-203`) | 되돌림 2 |
| `a3` | `HomeDialog` | 「다음」 | 질문 3 (tell/leave) |
| `why` | `HomeDialog` | `onA3` (`:205-212`) | 겹침 (a1×a3 4갈래, `HomeDialog.tsx:165-196`) |
| `cmp` | `HomeDialog` | 「다음」 | 「답은 같은데, 이유는 다릅니다.」 |
| `a4` | `HomeDialog` | 「다음」 | 착지 — 내 답/이유/상대 대조 |
| `hub` | `HomeDialog` (`:760-815`) | 「다음」 | 정체 한 줄(HubIdentity) + CTA(`EVENT_HREF`) + `NAV` 링크 + 「질문 다시 보기」「처음부터 다시 보기」 |

전이 규칙: 자동 전이 없음(`:28-33`). 레이어는 상시 마운트, `data-active`/`inert`로 전환(`:35-36`, `:348-366`). 뒤로 가기 `goToQuestion(n)`은 n≤1이면 전부, 아니면 a2·a3를 지운다(`:223-231`).

sessionStorage 키:

| 키 | 값 | 쓰기 | 읽기 |
|---|---|---|---|
| `dialog-phase` | Phase (gate 제외) | `HomeStage.tsx:316` (phase 바뀔 때마다), 삭제 `:242, 296` | `HomeStage.tsx:266`(복원), `layout.tsx:142`(첫 페인트용 `html[data-dialog-phase]`, 정규식 `^(hero|a[1234]|t[12]|why|cmp|hub)$`), `BackToDialog.tsx:23`(`IN_DIALOG = a1,t1,a2,t2,a3,why,cmp,a4`이면 「← 하던 대화로 돌아가기」 표시) |
| `dialog-chosen` | `{a1,a2,a3}` JSON | `HomeStage.tsx:317` | `:267-281` (키 화이트리스트 검증, 옛 포맷 폐기) |
| `hub-tracked` | `"1"` | `:330` | `:329` — `hub_reached`를 세션당 1회만 |

복원 조건: `RESUMABLE`(`:56-67`)에 있고 `restorable()`(`:104-109`, `NEEDS_A1/A2/A3` `:100-102`)을 통과해야 한다. 아니면 속성과 저장값을 모두 지운다(`:290-301`). `html[data-dialog-phase]` 속성은 복원 phase가 커밋된 뒤 별도 이펙트가 제거(`:305-309`).

`FunnelNav`(`src/components/FunnelNav.tsx`): `page.tsx:29-33`의 `FUNNEL = [s-hero "시작", s-event "1차 모임", s-cta "신청"]`을 받아 IntersectionObserver 1개(`rootMargin -45%/-45%`, `:32-40`)로 점 레일과 모바일 진행 바를 함께 구동. 스냅은 `globals.css:180-` `html:has([data-funnel])`.

localStorage 키: `hg-actor`(현황판 조작자 이름, `Board.tsx:50,133`), `hg-q-<token>`(2단계 답안 초안, `QuestionForm.tsx:45,58,73,99`).

---

## 4. lib 단일 출처 파일

| 파일 | exports | import하는 곳 | server-only | 읽는 env |
|---|---|---|---|---|
| `src/lib/admin-data.ts` | `AdminRow`(type), `Counts`(type), `loadBoard()` | `admin/page.tsx`, `admin/Board.tsx`(type만), `api/admin/applicants/route.ts` | **예** (`:1`) | — |
| `src/lib/admin.ts` | `makeSession()`, `isAdmin()`, `ADMIN_COOKIE`, `newToken()` | `admin/page.tsx`, `api/admin/{login,applicants,applicants/[id]/transition,applicants/[id]/token,payments}` | **예** | `ADMIN_PASSWORD` (`:20`) |
| `src/lib/age.ts` | `ageOn(birth, on=now)`, `isRealDate(s)` | `api/apply`, `api/pre/[token]`, `admin-data.ts` | 아니오 (순수) | — |
| `src/lib/biz.ts` | `Biz`(type), `biz()` | `api/pre/[token]/route.ts`만 | **예** | `HANGYEOL_BIZ_NAME/CEO/REGNO/MAILORDER/ADDRESS/PHONE/EMAIL`, `HANGYEOL_BANK_NAME/ACCOUNT/HOLDER` (`:32-41`) |
| `src/lib/db.ts` | `pool()`, `q()`, `tx()`, `isUniqueViolation()` | API 7개 + `admin-data.ts` | 아니오 (`pg` 자체가 node 전용) | `DATABASE_URL` (`:21`) |
| `src/lib/deadline.ts` | `overallDeadline()`, `dueAtFrom(heldAt)`, `isClosed(now)` | `api/pre/[token]`, `api/admin/.../transition` | 아니오 | — |
| `src/lib/event.ts` | `EVENT`, `EVENT_SCHEMA`, `REFUND`, `REFUND_LAW`, `AGE_RANGE`, `CONDITION_LABEL` | 14곳: `api/{apply,recruit,admin/payments}`, `layout.tsx`, `page.tsx`, `events/1/page.tsx`, `Apply`, `ApplyForm`(클라이언트), `Faq`, `Hero`, `Identity`, `StickyBar`, `admin-data.ts`, `deadline.ts` | 아니오 → **클라이언트 번들에 포함됨** | — |
| `src/lib/form9-copy.ts` | `Choice`, `Question`(types), `QUESTIONS`, `PAIRED_INDEXES`, `COPY` | `api/pre/[token]`, `api/q/[token]`만 | **예** (`:1`) — 문항이 번들에 안 들어가게 | — |
| `src/lib/notify.ts` | `notifyNewApplicant()`, `LinkDelivery`(type), `sendPreLink()`, `sendQuestionLink()` | `api/apply`, `api/admin/.../token` | 아니오(서버에서만 import됨) | `APPLY_NOTIFY_ENDPOINT` (`:17`, 모듈 로드 시 1회) |
| `src/lib/ratelimit.ts` | `rateLimit(key, limit, windowMs)`, `clientIp(req)` | `api/apply`만 | 아니오 | — |
| `src/lib/site.ts` | `SITE_URL`, `NAV`, `EVENT_HREF`, `EVENT_CTA_LABEL`, `SITE{name,slogan,operators}`, `CONTACT{instagram,kakao,email,phone}` | 15곳: `layout`, `page`, `events/1`, `mission`, `why`, `principles`, `robots`, `sitemap`, `api/admin/.../token`, `Footer`, `Founders`, `HomeDialog`, `InstagramLink`, `SiteHeader`, `StickyBar` | 아니오 (클라이언트 포함) | `NEXT_PUBLIC_SITE_URL` (`:17`, `\|\|` 폴백 `http://localhost:3000`) |
| `src/lib/track.ts` | `TrackEvent`(type), `track()` | `ApplyForm`, `HomeStage` | 클라이언트 전용 (`typeof window` 가드 `:61`) | — |

`Analytics.tsx`(컴포넌트)가 추가로 `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`를 읽는다(`:27-28`).

---

## 5. 외부 연동 지도

### 5.1 Neon Postgres
- 연결 문자열은 `DATABASE_URL` 하나만 읽는다(`db.ts:21`). 주석(`db.ts:6-8`)은 이 값이 `-pooler` 호스트여야 한다고 하지만 **코드는 검증하지 않는다.**
- `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, `PGHOST_UNPOOLED` 등 비풀 주소는 어디서도 쓰지 않는다.
- Pool 설정: `max: 10`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 10000`(`db.ts:29-34`). 개발 핫리로드 대비 `globalThis.__hangyeolPool` 싱글턴(`:38-41`).
- 트랜잭션은 `tx()` (begin/commit/rollback, `:59-72`). 사용처: `/api/pre` POST, transition, payments.
- `db/migrate.mjs`는 `pg.Client` 단일 연결.

### 5.2 Vercel
- 리전 `sin1`(`vercel.json:3`). 프로젝트 ID `prj_VImcnktsOkVAam3RFVu1op6tdpG0`, org `team_N7ADu3hjA46rIjyhcpZwdMwr`(`.vercel/project.json`).
- `@vercel/analytics/react`의 `<Analytics />`를 `Analytics.tsx:33`에서 렌더(브랜드 화면에서만). `track()`이 `@vercel/analytics`의 `track`을 동적 import로 호출(`track.ts:65-67`) — Hobby 요금제라 402(`track.ts:10-11`, `CLAUDE.md:201`).
- 배포 후 alias 수동 지정 필요(`CLAUDE.md:214-217`).
- `.env.local`의 `VERCEL_OIDC_TOKEN`은 `vercel env pull`이 넣은 것. 코드에서 미사용.

### 5.3 GA4
- `NEXT_PUBLIC_GA4_ID`가 있을 때만 gtag 스크립트 로드(`Analytics.tsx:34-47`, `afterInteractive`).
- `track()`이 `window.gtag("event", name, props)`(`track.ts:74`).

### 5.4 Meta Pixel
- `NEXT_PUBLIC_META_PIXEL_ID`가 있을 때만 로드 + `fbq('track','PageView')` + noscript 이미지(`Analytics.tsx:48-72`).
- `track()`이 `window.fbq("trackCustom", name, props)`(`track.ts:81`) — 표준 이벤트 아님.

### 5.5 계측 이벤트 전체 (`TrackEvent`, `track.ts:36-45`) 와 호출 지점

| 이벤트 | props | 호출 |
|---|---|---|
| `gate_start` | — | `HomeStage.tsx:162` |
| `gate_skip` | — | `HomeStage.tsx:167` |
| `hero_start` | — | `HomeStage.tsx:173` |
| `q1_answer` | `{choice: A1_LABEL}` | `HomeStage.tsx:183` |
| `q2_answer` | `{choice: A2_TEXT, after: A1_LABEL}` | `HomeStage.tsx:198` |
| `q3_answer` | `{choice: A3_LABEL}` | `HomeStage.tsx:207` |
| `hub_reached` | — (세션당 1회) | `HomeStage.tsx:334` |
| `apply_view` | — (IO threshold 0.3, 1회) | `ApplyForm.tsx:126` |
| `apply_submit` | `{gender: "남"\|"여"}` | `ApplyForm.tsx:189` (201일 때만) |

세 수집처에 동일하게 전송. 개인정보 없음(성별만). `/pre`·`/q`·`/admin`에는 스크립트 자체가 없다(§3).

### 5.6 운영자 알림 (`notify.ts`)
- `notifyNewApplicant()` → `APPLY_NOTIFY_ENDPOINT`(Formspree 주소, `notify.ts:4-6`)로 POST JSON. 본문 키: `순번, 이름, 연락처, 성별(남/여), 생년월일, 만나이("N세" + 범위 밖이면 " ⚠️ 나이 범위 밖 — 확인 필요"), "다음 회차 안내 동의"(동의/미동의), _subject("[한결] 사전등록 #N — 이름")`(`:37-46`). 타임아웃 4초, 실패 삼킴(`:48-52`). `/api/apply`에서 `after()`로 호출.
- ⚠️ 이름·연락처·생년월일이 **제3자(Formspree) 서버에 저장**된다. 개인정보 처리위탁·국외이전 고지 대상인지 검토 필요(화면 고지문 `ApplyForm.tsx:389-427`에는 위탁 언급이 없다).
- `sendPreLink()`/`sendQuestionLink()`는 스텁(`:73-88`) — 항상 `{channel:"manual", ok:false}`. 알림톡 미정(`:58-59`).

### 5.7 Formspree / `NEXT_PUBLIC_FORM_ENDPOINT`
- 코드에서 `NEXT_PUBLIC_FORM_ENDPOINT`를 읽는 곳은 **없다**(`grep process.env` 결과). 주석에서만 언급(`ApplyForm.tsx:13`, `notify.ts:8`). `.env.local`에는 남아 있다 → 미사용 변수.

### 5.8 환경변수 대조

코드가 읽는 이름(전수, `grep -rn "process.env"`):

| 이름 | 위치 | 없을 때 |
|---|---|---|
| `DATABASE_URL` | `db.ts:21`, `migrate.mjs:18` | throw |
| `ADMIN_PASSWORD` | `admin.ts:20` | `/admin`·admin API throw(500) |
| `APPLY_NOTIFY_ENDPOINT` | `notify.ts:17` | 알림 생략 |
| `NEXT_PUBLIC_SITE_URL` | `site.ts:17` | `http://localhost:3000` (토큰 링크·OG·sitemap이 전부 localhost가 됨) |
| `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | `Analytics.tsx:27-28` | 해당 스크립트 미로드 |
| `HANGYEOL_BIZ_NAME` (기본 "한결 (Hangyeol)"), `HANGYEOL_BIZ_CEO` (기본 "이현우"), `HANGYEOL_BIZ_REGNO`, `HANGYEOL_BIZ_MAILORDER`, `HANGYEOL_BIZ_ADDRESS`, `HANGYEOL_BIZ_PHONE` (기본 "010-5938-7074"), `HANGYEOL_BIZ_EMAIL` (기본 "hangyeolgachi2026@gmail.com"), `HANGYEOL_BANK_NAME` (기본 "IBK기업은행"), `HANGYEOL_BANK_ACCOUNT`, `HANGYEOL_BANK_HOLDER` (기본 "이현우") | `biz.ts:32-41` | `regno/mailorder/address/account` 비면 `missing`에 추가 → `PreForm.tsx:143-149` 빨간 경고 |

`.env.local`에 있는 이름(값 제외, 31개): `ADMIN_PASSWORD, APPLY_NOTIFY_ENDPOINT, DATABASE_URL, DATABASE_URL_UNPOOLED, HANGYEOL_BIZ_ADDRESS, HANGYEOL_BIZ_CEO, HANGYEOL_BIZ_EMAIL, HANGYEOL_BIZ_NAME, HANGYEOL_BIZ_PHONE, HANGYEOL_BIZ_REGNO, NEON_AUTH_BASE_URL, NEON_PROJECT_ID, NEXT_PUBLIC_FORM_ENDPOINT, NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_SITE_URL, PGDATABASE, PGHOST, PGHOST_UNPOOLED, PGPASSWORD, PGUSER, POSTGRES_DATABASE, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PRISMA_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL_NO_SSL, POSTGRES_USER, VERCEL_OIDC_TOKEN, VITE_NEON_AUTH_URL`.

- **`.env.local`에 있지만 코드가 안 읽는 것**: `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_PROJECT_ID`, `NEXT_PUBLIC_FORM_ENDPOINT`, `PG*`(5), `POSTGRES_*`(8), `VERCEL_OIDC_TOKEN`, `VITE_NEON_AUTH_URL` — 19개. (Neon 통합이 자동 주입한 것이 대부분. `NEXT_PUBLIC_FORM_ENDPOINT`만 유일한 "과거 잔재".)
- **코드가 읽지만 `.env.local`에 없는 것**: `HANGYEOL_BIZ_MAILORDER`, `HANGYEOL_BANK_NAME`, `HANGYEOL_BANK_ACCOUNT`, `HANGYEOL_BANK_HOLDER` → 로컬에서는 `missing = ["통신판매업 신고번호", "입금 계좌번호"]`이고 1단계 완료 화면 계좌가 `IBK기업은행 —`으로 나간다. 프로덕션 env는 이 지도 범위 밖(확인 못 함). `CLAUDE.md:190-198` 환경변수 표에도 `HANGYEOL_BANK_*`가 빠져 있다.

---

## 6. 인증·보안

### 6.1 운영자 쿠키 (`src/lib/admin.ts`)
- 쿠키명 `hg_admin`(`:16`), TTL 12시간(`:17`).
- 비밀번호 = HMAC 비밀키(`:19-23`): `secret()`이 `ADMIN_PASSWORD`를 그대로 반환. 비밀번호가 새면 쿠키 위조도 가능하고, 비밀번호를 바꾸면 모든 세션이 즉시 무효가 된다(의도치 않은 부수효과).
- 값 형식 `${exp}.${HMAC-SHA256(exp, secret) base64url}`(`:25-27, 38-39`). 만료는 `exp < Date.now()`(`:46`). 비교는 길이 확인 후 `timingSafeEqual`(`:36, 49`).
- 검사 지점: 페이지 `admin/page.tsx:24`(`redirect("/admin/login")`), API 5곳 각각 `isAdmin()` 401(`applicants:10`, `transition:32`, `token:35`, `payments:20`; `login`은 제외). 미들웨어 없음. 화면+API 이중 차단 원칙(`CLAUDE.md:63-64`)은 지켜진다.
- 쿠키 속성 `httpOnly, secure:true, sameSite:lax, path:/`(`login/route.ts:20-26`). `secure:true`라 http 로컬에서는 브라우저에 따라 쿠키가 저장되지 않을 수 있다(Chrome은 localhost 예외 허용).
- 로그인 무차별 대입 완화는 600ms 지연뿐(`login/route.ts:8`). `rateLimit()`은 적용되지 않는다.
- 누가 눌렀는지는 쿠키에 없고, 화면의 `actor` 입력(`Board.tsx:36-37`, localStorage `hg-actor`)이 `applicant_event.actor`·`payment.verified_by`로 들어간다. 서버는 `actor`가 빈 문자열이 아닌지만 본다(`transition:40`).

### 6.2 참가자 토큰 (`/pre/[token]`, `/q/[token]`)
- 생성: `newToken()` = `randomBytes(16).toString("base64url")`(`admin.ts:65-67`) → 22자, 128비트.
- 저장: `applicant.pre_token`, `applicant.q_token` (각각 부분 UNIQUE). 운영자 API가 발급·재사용(`token/route.ts:64-69`). 회전(재발급) API 없음.
- 검증: 형식 `^[A-Za-z0-9_-]{12,64}$`(`pre:56`, `q:33`) 후 `where pre_token=$1` / `where q_token=$1` 조회. 만료 없음.
- 두 단계 토큰 분리 이유: `004:14`, `q/route.ts:13-15`.
- 페이지 둘 다 `robots: {index:false, follow:false, nocache:true}`. `robots.txt`에는 Disallow를 적지 않는 것이 의도(`admin/login/page.tsx:6-8`).
- `/api/pre` GET은 토큰만 맞으면 `biz()`(계좌·사업자번호)를 내려준다(`pre:81, 101`) — 링크 유출 = 계좌 노출.

### 6.3 공개 API 방어
- 레이트리밋: `rateLimit("apply:"+ip, 5, 60000)`(`apply:35`) — 인스턴스 메모리 Map(`ratelimit.ts:11`), 500키 넘으면 청소(`:24-28`). IP는 `x-forwarded-for` 첫 값 → `x-real-ip` → `"unknown"`(`:33-36`). 스푸핑 가능. `/api/pre`, `/api/q`, `/api/admin/login`에는 미적용.
- 허니팟: `_gotcha` 필드(`ApplyForm.tsx:434-443` 화면 밖 input, `apply:50-52` 값 있으면 201 `{seq:0}` 위장 성공).
- 나이 재계산: 클라이언트 `ApplyForm.ageOf()`(`:48-55`)는 화면 검증용, 서버는 `ageOn(birth)`(`apply:72`)로 다시 계산해 `memo`와 알림에 쓴다. 현황판 `ageFlag`도 서버 `ageOn` 기준(`admin-data.ts:46-53`). 기준일은 항상 **오늘**(행사일 기준 아님).
- 중복 신청: DB `applicant_phone_uq` → 23505 → 409(`apply:124-130`).
- `/api/pre` POST의 두 번째 제출 거부는 `submitted_at`(`pre:126`), `/api/q`는 `answer_pre` PK(`q:98, 137`).
- SQL은 전부 `$n` 파라미터. 단 `token/route.ts:68,71`은 컬럼명을 문자열 보간하지만 값은 `stage` 검증(`:39`)으로 두 값 중 하나로 고정.

---

## 7. 하드코딩 목록

운영자(비개발자)가 바꿀 가능성이 있는 값 중 DB/환경변수가 아니라 **코드에 적혀 있는 것**. "정본" 열은 그 값이 다른 곳에도 중복돼 있으면 표시.

### 7.1 행사 사실 (정본은 `src/lib/event.ts`)

| 값 | 위치 | 비고 |
|---|---|---|
| 행사일 `2026-10-24` | `event.ts:17` `dateISO` | 기한·마감 전부 여기서 파생 |
| 표기 `10월 24일 (토)` | `event.ts:20` | dateISO와 손으로 맞춰야 함 |
| 시간 `18:00–21:00`, `17:30 입장` | `event.ts:21, 25` | `EVENT_SCHEMA.startISO/endISO`(`:54-56`)에 18:00/21:00 **다시** 적힘 |
| 장소 `합정`, `신청자에게 개별 안내` | `event.ts:26-27` | JSON-LD 주소 `마포구 합정동`/`서울`은 `events/1/page.tsx:46-47`에 별도 하드코딩 |
| 정원 20 / 성별 10 | `event.ts:28-29` | DB `gender_slot.capacity`(`001:84`)에 10이 **따로** 있음. 코드 값을 바꿔도 DB는 안 바뀐다 |
| 참가비 `39,000원`, `남녀 동일` | `event.ts:30-31` | 중복 4곳: `EVENT_SCHEMA.priceKRW "39000"`(`event.ts:58`), `form9-copy.ts:222` `"39,000원  (남녀 동일)"`, `PreForm.tsx:319` `39,000원`, `Board.tsx:102` prompt 기본값 `"39000"`. `payments/route.ts:10`은 `priceLabel`에서 파싱 |
| 나이 20~32 | `event.ts:32-33` | `AGE_RANGE`, `CONDITION_LABEL`, JSON-LD `typicalAgeRange` 파생 |
| `rotationPartners 10`, `rotationMinutes 9` | `event.ts:39-40` | **아무 데서도 안 씀** |
| 환불 3단 (7일 전 전액 / 3일 전 절반 / 그 이후 불가) | `event.ts:65-72` `REFUND` | `form9-copy.ts:233-236` `refundRows`에 **다른 문구로 재작성**("절반을 돌려드립니다" vs "절반 환불"). 두 벌 |
| 청약철회 문구 2줄 | `event.ts:85-88` `REFUND_LAW` | `form9-copy.ts:238-242` `refundNotes`에 3줄로 재작성 |
| 개인 입금 기한 72시간, 전체 마감 행사 7일 전 23:59:59 KST | `deadline.ts:21`, `:29-34` | 문구 `"안내드린 시각으로부터 최대 3일"`(`form9-copy.ts:224`), `"안내드린 시각으로부터 3일"`(`PreForm.tsx:327`), `"기한 하루 전에 한 번 더"`(`form9-copy.ts:272`) |
| 타임테이블 `18:10–20:00`, `20:10–20:30`, `20:30–21:00`, `하루 전` | `Timeline.tsx:9-39` | EVENT와 무관하게 별도 |

### 7.2 상태·라벨·운영 문구

| 값 | 위치 |
|---|---|
| 상태 한글 라벨 9종 (`사전등록/승인/입금대기/확정/대기/부적격/기한초과/환불요청/환불완료`) | `Board.tsx:7-11` `STATUS_KO` |
| 허용 전이표 | `transition/route.ts:16-26` **와** `Board.tsx:13-20` (복제) |
| 필터 탭 `전체/확정/입금대기/사전등록/대기/그 밖` | `Board.tsx:22, 117-122` |
| 카운터 카드 라벨 `확정/입금대기/사전등록/대기/남은 자리` | `Board.tsx:139-141` |
| 표 헤더 `# 이름 성 나이 혼인 직업 연락처 상태 닉 입금자명 기한 할 일` | `Board.tsx:168-169` |
| 버튼 문구 `1단계 링크(다시)`, `입금 확인`, `2단계 링크(다시)`, `새로고침` | `Board.tsx:196-207, 159` |
| 운영 화면 제목 `한결 운영 · 1차`, `한결 운영` | `Board.tsx:128`, `admin/page.tsx:18`, `login/page.tsx:11`, `LoginForm.tsx:31` |
| 확인/프롬프트 문구 (`… 로 바꿉니다.`, `이유 (기록에 남습니다)`, `통장에 찍힌 입금자명`, `입금액 (숫자만)`) | `Board.tsx:61-62, 100-102` |
| 기한 경고 임계 12시간 | `Board.tsx:187` |
| 갱신 주기 30초 | `Board.tsx:54` |
| 닉네임 접두 `결` | `payments/route.ts:80, 86` (`결${n}`), `Board.tsx`는 표시만 |
| 이벤트 로그 reason 문구 (`랜딩 사전등록`, `1단계 제출 — 자리 확보`, `1단계 제출 시점에 해당 성별 자리 마감`, `입금 확인 N원 · 입금자 X`) | `apply:105`, `pre:211, 225`, `payments:64` |
| 금액 불일치 경고 `금액이 N원과 다릅니다 (M원)` | `payments/route.ts:85` |
| `memo` 자동 문구 `자격 확인 필요 — 신청 시점 만 N세` | `apply/route.ts:98` |
| 모집 현황 문구 (`마감되었습니다 — 대기 신청은 받습니다`, `여성 N자리 · 남성 마감`, `지금 신청받고 있습니다`) + 절반 임계 | `recruit/route.ts:23, 65-78`, `RecruitStatus.tsx:47` (`— 자리가 나면 순서대로 안내드립니다`) |
| 알림 메일 필드명·제목 | `notify.ts:38-45` |
| 폼9 문구 전체 (문항 10개, 화면 문안) | `form9-copy.ts` — 의도된 단일 출처. 단 `PreForm.tsx:127, 130, 145-147, 181, 202, 238, 296, 298, 312-327`, `QuestionForm.tsx:107, 114, 147`에 한글 문자열이 남아 있다(`불러오는 중…`, `잠시 문제가 있었습니다`, `남/여`, `미혼/기혼`, `이전`, `자리 잡기`, `입금 계좌/예금주/금액/입금자명/입금 기한`, `보내지 못했습니다…`) |
| 운영자 이름·직함 3인 | `site.ts:44-48` `SITE.operators` (Founders·Footer·JSON-LD) |
| 연락처 (인스타 `hangyeol_kr`, 이메일, 전화) | `site.ts:59-74` `CONTACT`; `biz.ts:37-38` 기본값에 **같은 전화·이메일 중복** |
| 대표자 `이현우`, 은행 `IBK기업은행` 기본값 | `biz.ts:33, 39, 41` (env 없을 때) |
| NAV 3개 · CTA `1차 모임 신청` · `/events/1` | `site.ts:20-29` |
| 슬로건 · 브랜드명 | `site.ts:32-34` |
| 홈 퍼널 구간 라벨 `시작/1차 모임/신청` | `page.tsx:29-33` |
| 게이트 `단 1분으로 “나” 찾기`, `시작`, `건너뛰기` | `HomeGate.tsx:32-43` |
| 히어로 CTA `세 번 물어보겠습니다 →`, `1분이면 됩니다 · 정답은 없습니다` | `HomeHero.tsx:195, 205` |
| 온보딩 문안 전체 (`SIM`, 허브 문장) | `HomeDialog.tsx:87-204, 253-259, 714-815` |
| 사전등록 완료 문구 `9월 28일에 … 질문지와 참가 안내를 한 번에` | `ApplyForm.tsx:200-202` |
| 개인정보 고지문 (보유 3년 / 30일 / 5년·3년) | `ApplyForm.tsx:385-429` |
| 참가 조건·금지 사항 문단 | `Apply.tsx:74-79` |
| FAQ 4문답 | `Faq.tsx:4-26` |
| 정체성 카드 3개 | `Identity.tsx:5-32` |
| 운영자 소개 문단 | `Founders.tsx:28-36` |
| 히어로 리드 `생각이 닮은 사람과도…`, `신청하기` | `Hero.tsx:76, 86` |
| 메타 설명문 `답이 아니라 이유를 묻는 오프라인 대화 모임…` | `layout.tsx:52`, `events/1/page.tsx:34` (두 벌) |
| 제목 `1차 오프라인 모임`, `한결 1차 모임 · 참가 신청`, `한결 1차 모임 · 사전 질문` | `events/1/page.tsx:14`, `pre/[token]/page.tsx:9`, `q/[token]/page.tsx:9` (후자 둘은 `form9-copy` `start.title`/`qStart.title`과 중복) |
| /mission·/why·/principles 카피 전체 | 각 `page.tsx` 상단 상수 |

### 7.3 기술 상수 (운영자보다 개발자용)

| 값 | 위치 |
|---|---|
| 레이트리밋 5회/60초 | `apply/route.ts:35` |
| 로그인 지연 600ms | `login/route.ts:8` |
| 쿠키 TTL 12h, 쿠키명 `hg_admin` | `admin.ts:16-17` |
| 토큰 길이 16바이트, 정규식 12~64자 | `admin.ts:66`, `pre:56`, `q:33` |
| 알림 타임아웃 4초 | `notify.ts:48` |
| Pool max 10, 타임아웃 10초 | `db.ts:31-33` |
| 캐시 `s-maxage=60, swr=300` | `recruit/route.ts:85` |
| 나이 하한/상한 10~100 (검증용) | `apply:76`, `ApplyForm.tsx:69` |
| 이름 최대 20자, 직업 30자 | `apply:57`, `ApplyForm.tsx:228`, `PreForm.tsx:171, 213` |
| 크로스페이드 500ms, 타자기 600/45ms, 허브 450/34/420/620/260ms | `HomeStage.tsx:122`, `HomeDialog.tsx:10-12, 266-271` |
| IO rootMargin/threshold | `FunnelNav.tsx:38`, `PageEffects.tsx:40, 58`, `ApplyForm.tsx:128` |
| 스크롤 축소 임계 120px | `PageEffects.tsx:71` |
| 색 토큰 | `globals.css:95-133`, 반전 `:420-433`; `admin.module.css:7-16`은 `#212529` 등 별도 하드코딩(의도, `:4-6`) |

---

## 8. 죽은 코드·불일치

### 8.1 컴포넌트·export 사용 여부 (grep 검증)
- `Hero`, `Identity`, `Timeline`, `Founders`, `StickyBar` — **모두 사용 중.** 앞 넷은 `events/1/page.tsx:2-8`, `StickyBar`는 `events/1` + `mission` + `why` + `principles`(`href={EVENT_HREF}`).
- `src/components/*.tsx` 25개 중 어디서도 import되지 않는 파일: **없음.**
- 미사용 export/필드: `EVENT.rotationPartners`, `EVENT.rotationMinutes`(`event.ts:39-40`, 정의뿐), `Biz.address/phone/email/mailorder`는 API로 내려가지만 `PreForm`은 `bank/account/holder/name/regno/ceo`만 표시(`PreForm.tsx:313-343`) → **통신판매업 신고번호·소재지가 화면에 안 나온다**(`biz.ts:10-12`가 전자상거래법 §10① 근거로 든 바로 그 항목).
- DB 컬럼 미사용: `applicant.reminded_at`, `applicant.kakao_linked`, `payment.refunded_amount/refunded_at/refund_reason`(환불 API 없음), `participant.site_token`(생성만).
- `answer_pre.a`를 읽는 코드 없음 — 2부 비교표·리포트 생성은 이 저장소 밖.

### 8.2 코드와 어긋나는 카피
1. `ApplyForm.tsx:200-202` 완료 문구: "9월 28일에 등록해주신 분들께 **질문지와** 참가 안내를 한 번에 보내드립니다" — (a) 날짜 하드코딩, (b) 004 분리 이후 문항은 **입금 확인 후** 발송(`004:4-8`)이라 사실과 다름.
2. `Identity.tsx:9` "신청하시면 10개 주제의 질문을 보내드립니다. 하루 전까지 답해주시면" 및 `Timeline.tsx:10-14` "하루 전 · 사전 질문" — 같은 이유로 2단계 흐름과 어긋남. `form9-copy.ts:320` `qDone`은 "행사 이틀 전에 준비 안내".
3. `form9-copy.ts:272` "기한 하루 전에 한 번 더 알려드립니다" — 리마인드 발송 코드가 없다(`reminded_at` 미사용).
4. `form9-copy.ts:275` "입금 확인은 하루 두 번(오전·저녁)" — 운영 약속이며 코드 강제 없음(참고).
5. 환불 규정이 `event.ts`와 `form9-copy.ts`에 서로 다른 문구로 두 벌 (§7.1).

### 8.3 오래된 주석·문서
1. `Analytics.tsx:15` "q1~q3_answer·**q3_reason**" — `track.ts:33-35`가 `q3_reason` 삭제를 명시. 주석만 남음.
2. `db/README.md:36-42` "지금까지: 001만 / 잔여: payment·participant·answer_pre는 002에서" — 002~004가 이미 있음. `migrate.mjs`·`npm run db:migrate`도 미언급(README.md·CLAUDE.md만 언급).
3. `README.md:34-35` "`CLAUDE.md`의 '문서 라우팅' 참조" — CLAUDE.md에 그 절이 **없다**(grep 0건).
4. `robots.ts:6` "숨길 경로가 없는 5페이지 정적 사이트" — 현재 admin/pre/q(noindex 메타)가 있음. 동작은 의도대로지만 설명이 낡음.
5. `.claude/workflows/hangyeol-company-site.js:13` `ROOT = 'C:\\Users\\hyund\\projects\\hangyeol'`(현재 폴더는 `hangyeol_web`), `:32-34` 옛 팔레트(`--ink #111`, Gothic A1) — 리브랜딩 전 워크플로. git 무시 대상이지만 실행하면 다른 디렉터리를 건드린다.
6. `CLAUDE.md:190-198` 환경변수 표에 `HANGYEOL_BANK_*`, `HANGYEOL_BIZ_MAILORDER` 없음. `CLAUDE.md:53` "토큰 경로 둘 다 robots index:false" ✔ 일치.
7. `notify.ts:2-6` "기존 Formspree 주소를 그대로 재사용" — 맞지만 `.env.local`에 옛 `NEXT_PUBLIC_FORM_ENDPOINT`가 그대로 남아 있어 두 변수가 공존.
8. `.gitignore:37/48` `.vercel`, `:34/49` `.env*` 중복(무해).

### 8.4 논리 불일치·위험
1. **슬롯 이중 확보** (§1.4 ⚠️): `approved→awaiting_payment` 운영자 전이 + 참가자 1단계 제출이 각각 `gender_slot`을 +1. 1단계 제출은 현재 status를 검사하지 않아 `rejected/expired`도 자리를 잡을 수 있음.
2. **003 재실행 시 데이터 소실** (§1.1): Neon 콘솔 적용 → `schema_migration` 미기록 → `npm run db:migrate`가 003을 다시 돌려 `answer_pre`·`participant` drop.
3. `gender_slot.capacity`(DB 10)와 `EVENT.capacityPerGender`(코드 10)가 별개 — 정원 변경 시 두 곳.
4. 만료 배치·파기 배치 없음(`CLAUDE.md:178-180` 인정). `due_at` 지나도 슬롯은 운영자가 풀 때까지 잠김.
5. `recruit_display` 워터마크는 `/api/recruit` GET 호출 시에만 갱신 — 랜딩에 아무도 안 오면 안 오름(공개 숫자 정의상 문제는 아님).
6. `/api/admin/login` 레이트리밋 없음; `ADMIN_PASSWORD`가 HMAC 키 겸용.
7. `SiteChrome`이 `/pre`·`/q`에서 `Analytics`까지 제거 → 폼9 전환율은 어떤 수집처에도 안 쌓인다(주석 `SiteChrome.tsx:8-15`는 `/admin` 오염 방지만 근거로 듦).
8. `after()`로 보내는 Formspree 알림에 이름·연락처·생년월일 포함(§5.6).
9. `Board.tsx`가 `confirm()`/`prompt()` 브라우저 대화상자로 이유·입금자명·금액을 받는다 — 비개발자 운영에 취약(오타·취소 시 흐름 중단).
10. `PreForm.tsx:319` 금액 `39,000원`이 `EVENT`와 무관한 문자열 — 가격 변경 시 누락 1순위.

---

## 9. 컴포넌트 의존 그래프

```
src/app/layout.tsx  (server)
├─ globals.css
├─ lib/site (SITE, SITE_URL) · lib/event (EVENT)
├─ components/SiteChrome  (client, usePathname; /admin,/pre,/q 에서 null)
│  ├─ components/GrainCanvas (client, canvas)
│  ├─ components/SiteHeader (client)
│  │  ├─ components/InstagramLink ── lib/site (CONTACT)
│  │  └─ lib/site (NAV, EVENT_HREF, EVENT_CTA_LABEL, SITE)
│  ├─ components/Footer (server) ── lib/site (CONTACT, NAV, SITE, EVENT_HREF, EVENT_CTA_LABEL)
│  ├─ components/PageEffects (client, usePathname)
│  └─ components/Analytics (client) ── @vercel/analytics/react · env GA4/PIXEL
└─ <main> children

src/app/page.tsx  (/)  (server)
├─ lib/event (EVENT) · lib/site (EVENT_HREF, EVENT_CTA_LABEL, SITE)
├─ home.module.css
├─ components/FunnelNav (client)
├─ components/HomeStage (client) ── lib/track
│  ├─ components/HomeGate (client)
│  │  └─ components/LogoMark
│  ├─ components/HomeHero
│  └─ components/HomeDialog (client) ── lib/site (EVENT_HREF, EVENT_CTA_LABEL, NAV, SITE)
│        └─ (type만) HomeStage {A1,A2,A3,Phase,SimState}
└─ components/InstagramLink

src/app/mission|why|principles/page.tsx  (server)
├─ components/BackToDialog (client, sessionStorage)
├─ components/StickyBar ── components/InstagramLink · lib/event · lib/site
└─ lib/site (EVENT_HREF, EVENT_CTA_LABEL, SITE[mission만])

src/app/events/1/page.tsx  (server)
├─ lib/site (EVENT_HREF, SITE, SITE_URL) · lib/event (EVENT, EVENT_SCHEMA)
├─ components/Hero ── lib/event
├─ components/Identity ── lib/event · sectionHead.module.css
├─ components/Timeline ── sectionHead.module.css
├─ components/Founders ── lib/site (SITE.operators)
├─ components/Apply ── lib/event (AGE_RANGE, CONDITION_LABEL, EVENT)
│  ├─ components/ApplyForm (client) ── lib/event · lib/track → POST /api/apply
│  └─ components/RecruitStatus (client) → GET /api/recruit
├─ components/Faq ── lib/event (AGE_RANGE, EVENT, REFUND, REFUND_LAW)
└─ components/StickyBar

src/app/pre/[token]/page.tsx  (server, force-dynamic, noindex)
└─ components/PreForm (client) → GET/POST /api/pre/[token]   [form9.module.css]

src/app/q/[token]/page.tsx  (server, force-dynamic, noindex)
└─ components/QuestionForm (client, localStorage 초안) → GET/POST /api/q/[token]

src/app/admin/page.tsx  (server, force-dynamic, noindex)
├─ lib/admin (isAdmin) · lib/admin-data (loadBoard) ── lib/db · lib/event · lib/age
└─ admin/Board.tsx (client) ── (type) lib/admin-data · admin.module.css
     → GET /api/admin/applicants · POST …/transition · POST …/token · POST /api/admin/payments

src/app/admin/login/page.tsx  (server, noindex)
└─ admin/login/LoginForm.tsx (client) → POST /api/admin/login

API → lib
├─ /api/apply ── db, age, notify, ratelimit, event
├─ /api/recruit ── db, event
├─ /api/pre/[token] ── db, age, deadline, form9-copy, biz
├─ /api/q/[token] ── db, form9-copy
├─ /api/admin/login ── admin
├─ /api/admin/applicants ── admin, admin-data
├─ /api/admin/applicants/[id]/transition ── db, admin, deadline
├─ /api/admin/applicants/[id]/token ── db, admin, site, notify
└─ /api/admin/payments ── db, admin, event

lib 내부: admin-data → db, event, age · deadline → event · 나머지 독립
```

CSS 모듈 대응: `home.module.css`↔`page.tsx`, `admin.module.css`↔`Board`/`LoginForm`, `mission|why|principles.module.css`↔각 페이지, `BackToDialog|FunnelNav|HomeDialog|HomeGate|HomeHero|HomeStage|SiteHeader|form9|sectionHead.module.css`↔동명 컴포넌트(`form9`는 `PreForm`+`QuestionForm`, `sectionHead`는 `Apply`·`Faq`·`Founders`·`Identity`·`Timeline`). `HomeDialog.module.css`는 `HomeStage.module.css`의 `.layer`를 `composes`로 상속.

`scripts/*.py`(빌드와 무관, 수동 실행): `recolor-logo.py`(로고 잉크 → 딥그린 재염색) → `make-mark.py`(헤더용 심볼 크롭 `hangyeol-mark-v2.png`) → `make-og.py`(OG 1200×630, 날짜·가격 의도적 제외) · `make-favicon.py`(ICO). 전부 Pillow 의존.
