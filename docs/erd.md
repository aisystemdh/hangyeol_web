# 데이터 모델 (ERD)

이슈 #6 산출물. **승인 전 초안이다.** 승인되면 이슈 #11(마이그레이션 005~)이 이 문서를 그대로 구현한다.
현재 구조는 `docs/architecture.md` §1에 있다 — 이 문서는 **바뀔 모습**만 적는다.

작성 2026-09-05. 짝 문서: [`api.md`](./api.md).

---

## 0. 이 설계가 선 자리 — 소유자 결정 4건 (2026-09-05)

| # | 결정 | 왜 물었나 |
|---|---|---|
| 1 | **「사람」과 「신청」을 두 테이블로 나눈다** | 지금은 `applicant` 한 장에 신원과 이번 행사 상태가 섞여 있다. 전화번호가 UNIQUE라 **2차 행사 때 같은 사람이 못 들어온다.** |
| 2 | **정원의 정본은 코드(`src/lib/event.ts`)** | 숫자 `10`이 코드와 DB 두 곳에 따로 적혀 있었다. 화면 문구는 코드를, 마감 판정은 DB를 읽어 어긋날 수 있었다. |
| 3 | **참가자 링크는 하나로 통합** (`/me/[token]`) | 지금은 한 사람에게 링크가 3개(`pre`·`q`·현장) 나간다. 알림톡에는 **마이페이지 링크 하나만** 보낸다. |
| 4 | **백필 없음 — 새 스키마를 깨끗하게 세운다** | 프로덕션 `applicant` **0건** 확인(2026-09-05, 아래 §7). 옮길 데이터가 없다. |

---

## 1. 한 장 그림

```
                    ┌──────────────┐
                    │    event     │  회차 (1차 = 2026-10-24)
                    └──────┬───────┘
                           │
            ┌──────────────┼───────────────┐
            │              │               │
      ┌─────▼─────┐  ┌─────▼──────┐  ┌─────▼──────────┐
      │   slot    │  │application │  │recruit_display │
      │  성별 정원 │  │  신청 하나  │  │  공개 워터마크  │
      └───────────┘  └─────┬──────┘  └────────────────┘
                           │
        ┌──────────┬───────┼────────┬──────────────┐
        │          │       │        │              │
  ┌─────▼────┐ ┌───▼───┐ ┌─▼─────┐ ┌▼───────────┐ ┌▼─────────┐
  │applicant │ │payment│ │answer │ │notification│ │ event_log│
  │   사람    │ │  입금  │ │  답변  │ │   알림 큐   │ │ 모든 기록 │
  └──────────┘ └───────┘ └───────┘ └────────────┘ └──────────┘

                                    purge_log  ← 파기 기록 (독립)
                                    schema_migration
```

**읽는 법.** `applicant`는 사람 한 명, `application`은 「그 사람이 이 회차에 낸 신청 한 건」이다.
2차 행사가 열리면 `application` 행만 하나 더 생기고 사람 정보는 그대로 재사용된다.
`event`가 회차를 묶고, 나머지는 전부 `application`에 매달린다.

---

## 2. 테이블

### 2.1 `event` — 회차

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | smallint PK | 1차 = `1` |
| `code` | text UNIQUE | `"1"` — URL `/events/1`과 같은 값 |
| `title` | text | `"한결 1차 모임"` |
| `date` | date | 🔴 **`EVENT.dateISO`에서 시드된다.** DB가 진실이 아니다 |
| `closed_at` | timestamptz | 전체 마감. `overallDeadline()` 결과를 시드 |
| `created_at` | timestamptz | |

🔴 **이 표는 코드의 사본이다.** 정본은 `src/lib/event.ts` 하나다(결정 2).
DB에 두는 이유는 딱 하나 — `application`·`slot`이 회차를 **외래키로** 가리켜야
2차 행사 때 표를 안 고치기 때문이다. 값을 DB에서 손으로 고치면 화면 문구와 어긋난다.

시드·동기화는 `npm run db:migrate`가 `event.ts`를 읽어서 upsert한다(이슈 #11).
어긋나면 `/admin` 상단에 빨간 경고 — 조용히 어긋나는 것이 이 설계에서 가장 나쁘다.

### 2.2 `applicant` — 사람

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text | not null | |
| `phone` | text | **UNIQUE** | 숫자만 저장(`01012345678`) |
| `gender` | text | check `M`/`F` | |
| `birth` | date | not null | 🔴 나이 컬럼을 두지 않는다 — 나이는 항상 `ageOn(birth)`로 계산 |
| `email` | text | nullable | 1단계 폼에서 받음 |
| `created_at` / `updated_at` | timestamptz | | |

**신원만 남긴다.** 동의·상태·기한·토큰은 전부 `application`으로 내려갔다.
전화번호 UNIQUE는 그대로 유지된다 — 사람을 식별하는 열쇠이고, 한 사람이 두 번
신청하는 것을 막는 진짜 방어선이다(레이트리밋은 부정확하다).

### 2.3 `application` — 신청 한 건 ⭐ 이 설계의 중심

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `applicant_id` | uuid FK → applicant, on delete cascade | |
| `event_id` | smallint FK → event | |
| — | | **UNIQUE(`applicant_id`, `event_id`)** — 한 사람 한 회차 한 신청 |
| `status` | text not null | §3 상태 머신 |
| `seq` | bigserial | 선착순 근거. 번호가 빌 수 있다(트랜잭션 롤백) |
| `token` | text UNIQUE | 🔴 **마이페이지 링크의 전부.** `newToken()` |
| `token_issued_at` | timestamptz | 발급 시각 |
| **자리·기한** | | |
| `held_at` | timestamptz | 자리를 잡은 시각 |
| `submitted_at` | timestamptz | 1단계 폼 제출 시각. 두 번째 제출 거부 근거 |
| `due_at` | timestamptz | 🔴 `dueAtFrom(submitted_at)` — 개인 72h와 전체 마감 중 **먼저 오는 쪽** |
| `nick` | text | `결1`~`결20`. 확정될 때 배정. UNIQUE(`event_id`, `nick`) |
| **신청 경로** (이슈 #13) | | |
| `source` | text | `instagram` / `threads` / `direct` / `referral` … |
| `utm` | jsonb | `{source, medium, campaign, content, term}` 원문 |
| `referrer` | text | `source` 판정 실패 시 원본 도메인 |
| **1단계 폼 답** | | |
| `marital` | text | check null 또는 `미혼`/`기혼` |
| `job` | text | |
| `depositor_name` | text | 신청자와 입금자가 다를 때만 |
| **동의 이력** | | 🔴 전부 `timestamptz` — 「받았다/안 받았다」가 아니라 **언제 받았는지**를 남긴다 |
| `privacy_agreed_at` | timestamptz not null | 개인정보 수집·이용 |
| `marketing_agreed_at` | timestamptz | 선택 |
| `truth_agreed_at` | timestamptz | 기재 사실 확인 |
| `refund_agreed_at` | timestamptz | 환불 규정 |
| `email_agreed_at` | timestamptz | 이메일 수신 |
| **운영** | | |
| `memo` | text | 운영자 메모 + 자동 경고(나이 범위 밖 등) |
| `created_at` / `updated_at` | timestamptz | 트리거로 갱신 |

인덱스: `(event_id, status, seq)` · `(due_at) where status='awaiting_payment'` · `token` UNIQUE · `(event_id, nick)` UNIQUE.

**동의를 `application`에 둔 이유.** 개인정보 동의는 「수집 시점」에 매인다.
보유기간도 회차 기준(행사+30일 / +3년)이라 회차를 따라가야 계산이 된다.
사람에 붙여두면 2차 행사 때 「1차 때 동의했으니 됐다」가 되는데, 그건 법적으로 안 된다.

### 2.4 `slot` — 성별 정원 (선착순 심장)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `event_id` | smallint FK | PK(`event_id`, `gender`) |
| `gender` | text | check `M`/`F` |
| `taken` | integer not null default 0 | check ≥ 0 |
| `capacity` | integer not null | `EVENT.capacityPerGender`에서 시드 |

🔴 **이 한 줄이 정원 초과를 막는 전부다.** 되돌리거나 「먼저 읽고 나중에 쓰기」로 바꾸지 말 것:

```sql
update slot set taken = taken + 1
 where event_id = $1 and gender = $2 and taken < capacity
```

Postgres의 `UPDATE`가 스스로 행을 잠그므로, 27명이 같은 순간에 눌러도 정확히
정원만큼만 성공한다(2026-08-29 동시 제출 27건 실측). `select` 후 `update`로 나누면
그 사이에 남이 끼어든다.

⚠️ `capacity`가 DB에 있는 이유는 위 UPDATE 한 줄 안에서 비교돼야 하기 때문이다.
값의 정본은 여전히 `event.ts`이고, DB 값은 시드된 사본이다(결정 2).

### 2.5 `payment` — 입금·환불

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `application_id` | uuid FK → application, **on delete set null** | 🔴 아래 참조 |
| `amount` | integer not null | 원 단위 |
| `depositor` | text not null | 통장 입금자명 |
| `deposited_at` | timestamptz not null | |
| `method` | text default `bank_transfer` | |
| `verified_by` | text not null | 운영자 이름 |
| `verified_at` | timestamptz default now() | |
| `refunded_amount` | integer default 0 | |
| `refunded_at` / `refund_reason` | | 환불 API로 채운다(이슈 #12) |
| `note` | text | |

부분 UNIQUE `(application_id) where refunded_at is null` — 살아 있는 입금은 신청당 하나.

🔴 **`on delete set null`인 이유 — 보유기간이 서로 다르다.**
신원은 3년 뒤 지우는데(고지함) **계약·결제 기록은 5년 보존이 법정 의무**다
(전자상거래법 제6조, `ApplyForm.tsx:404-407`에서 고지). cascade로 두면 3년 파기 때
결제 기록이 함께 날아가 **법정 의무 위반**이 된다. 그래서 끊어만 두고, 금액·입금자명·
일시는 `payment` 행 안에 이미 복사돼 있어 5년까지 스스로 살아남는다.

### 2.6 `answer` — 폼 답변 (사전질문 + 현장)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `application_id` | uuid FK on delete cascade | PK(`application_id`, `form`) |
| `form` | text | `pre`(사전 10문항) / `site`(현장 폼 10~14) |
| `form_version` | integer not null | 🔴 아래 참조 |
| `a` | jsonb not null | 답 배열 |
| `consent` | boolean | 2부 비교표 동의(`pre`만) |
| `at` | timestamptz default now() | |

**두 테이블(`answer_pre`/`answer_site`)로 나누지 않고 한 표에 `form` 컬럼으로 둔 이유.**
구조가 완전히 같다 — 신청 하나에 폼 하나, jsonb 배열 하나, 제출 시각 하나.
나누면 조회·파기·내보내기 코드가 전부 두 벌이 된다.

🔴 **`form_version`을 빠뜨리지 말 것.** 문항 정본은 `src/lib/form9-copy.ts`인데
문항이 바뀌면 **과거 답의 뜻이 통째로 달라진다**(3번 문항이 다른 질문이 된다).
버전 없이 저장하면 리포트를 쓸 때 어느 문항에 대한 답인지 복원할 수 없다.
`form9-copy.ts`에 `FORM_VERSION` 상수를 두고 저장할 때 함께 박는다.

### 2.7 `notification` — 알림 큐 (이슈 #15·#16)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `application_id` | uuid FK on delete cascade | nullable(운영자 알림) |
| `template` | text not null | `T1`~`T13` 또는 내부 코드 |
| `channel` | text not null | `alimtalk` / `sms` / `email` / `manual` |
| `scheduled_at` | timestamptz not null | 보낼 시각. 즉시 발송은 `now()` |
| `sent_at` | timestamptz | |
| `status` | text not null default `queued` | `queued`/`sending`/`sent`/`failed`/`canceled` |
| `attempts` | integer default 0 | |
| `provider_msg_id` | text | 딜러사가 준 식별자 |
| `error` | text | 마지막 실패 사유 |
| `payload` | jsonb | 템플릿 변수(이름·금액·기한 등) |
| `created_at` | timestamptz | |

인덱스 `(status, scheduled_at) where status = 'queued'` — 스케줄러가 5분마다 이것만 훑는다.

🔴 **발송 실패가 신청 실패가 되면 안 된다.** 지금 `notify.ts`가 지키는 원칙 그대로다.
큐에 넣는 것은 신청 트랜잭션 **안에서**, 실제 발송은 **밖에서**(스케줄러). 이렇게 하면
딜러사가 죽어 있어도 신청은 저장되고, 살아나면 밀린 것이 나간다.

⚠️ `payload`에 이름·전화가 들어간다. 파기 배치가 이 표도 함께 지워야 한다(§5).

### 2.8 `event_log` — 모든 조작 기록 (옛 `applicant_event` 확장)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `application_id` | uuid FK on delete cascade | nullable |
| `kind` | text not null | `status` / `edit` / `payment` / `notify` / `purge` / `admin_login` |
| `from_status` / `to_status` | text | `kind='status'`일 때만 |
| `reason` | text | |
| `actor` | text not null | `system` 또는 **운영자가 화면에서 고른 이름** |
| `meta` | jsonb | 수정 전후 값 등 |
| `at` | timestamptz default now() | 인덱스 `(application_id, at)` |

🔴 **`actor`가 이 표의 존재 이유다.** 운영자 셋이 공유 비밀번호를 쓰므로 쿠키로는
누가 눌렀는지 알 수 없다. 상태를 바꿀 때 화면에서 이름을 고르게 해 여기 남긴다.

### 2.9 `recruit_display` — 공개 워터마크

| 컬럼 | 타입 |
|---|---|
| `event_id` | smallint, PK(`event_id`, `gender`) |
| `gender` | text |
| `high_water` | integer default 0 |

확정자 수가 늘면 올라가고 **절대 내려가지 않는다.** 「남은 자리 3」이 다음 새로고침에
「5」로 늘어나는 것을 막기 위해서다 — 취소가 나도 공개 숫자는 유지된다.

### 2.10 `purge_log` — 파기 기록 (이슈 #21)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `rule` | text not null | `event+30d` / `event+3y` / `manual` |
| `subject` | text not null | `answer` / `application` / `applicant` / `notification` |
| `subject_id` | text not null | 지운 행의 id(문자열) |
| `event_id` | smallint | |
| `purged_at` | timestamptz default now() | |
| `actor` | text not null | `system` 또는 운영자 |

🔴 **여기에 이름·전화·생년월일을 남기지 말 것.** 파기 기록에 개인정보를 적으면
파기가 안 된 것이다. id와 규칙만 남긴다 — "무엇을 언제 왜 지웠나"는 그것으로 증명된다.

### 2.11 사라지는 표

| 옛 표 | 어디로 갔나 |
|---|---|
| `applicant`(옛, 전부 섞인 것) | `applicant`(신원) + `application`(나머지) |
| `applicant_event` | `event_log` (`kind` 컬럼 추가) |
| `gender_slot` | `slot` (`event_id` 추가) |
| `answer_pre` | `answer` (`form='pre'`) |
| `participant` | `application.nick`. **`site_token`은 소멸** — 링크가 하나로 합쳐졌다(결정 3) |

프로덕션 데이터가 0건이므로(§7) 005 마이그레이션에서 **옛 표를 drop해도 잃을 것이 없다.**
⚠️ 단 `db/migrate.mjs`는 파일 하나가 한 트랜잭션이므로, drop과 create를 같은 파일에 둔다.

---

## 3. 상태 머신 (`application.status`)

정본은 **`src/lib/status.ts` 한 곳**(이슈 #12). 지금은 API 라우트와 `Board.tsx`에
같은 표가 두 벌 복사돼 있어 한쪽만 고치면 화면과 서버가 어긋난다.

### 3.1 상태 9개

| 상태 | 뜻 | 자리를 쥐고 있나 |
|---|---|---|
| `pre_registered` | 신청 접수. 아직 자리 없음 | ✗ |
| `awaiting_payment` | 자리 확보. 입금 대기 | ✅ |
| `confirmed` | 입금 확인. 확정 | ✅ |
| `waitlist` | 정원이 차서 대기 | ✗ |
| `expired` | 기한 넘김 | ✗ |
| `canceled` | 본인 취소(입금 전) | ✗ |
| `refund_requested` | 환불 요청 | ✗ |
| `refunded` | 환불 완료 | ✗ |
| `rejected` | 자격 미달·운영자 거절 | ✗ |

**옛 `approved`는 없앤다.** 「운영자가 승인해야 1단계 링크가 나가는」 단계였는데,
새 흐름에서는 신청 즉시 마이페이지 링크가 자동 발송되므로(N1) 아무도 지나지 않는
빈 방이 된다. 대기자를 끌어올릴 때는 `waitlist → awaiting_payment`로 바로 간다.

**`canceled`는 새로 만든다.** 지금은 본인이 취소해도 붙일 상태가 없어 `expired`나
`rejected`로 뭉뚱그려진다. 셋은 뜻이 다르다 — 기한을 넘긴 것, 우리가 거절한 것,
본인이 그만둔 것. 리포트와 재모집 판단이 이 구분에 걸린다.

### 3.2 전이표

```
                    ┌──── 본인이 폼 제출, 자리 확보 성공 ────┐
pre_registered ─────┤                                       ├──▶ awaiting_payment
                    └──── 자리 없음 ──▶ waitlist             │
                                          │                  │
                        운영자가 자리 배정 ─┘                  │
                                                             │
awaiting_payment ──── 입금 기록 ───────────────────────────▶ confirmed
       │                                                       │
       ├── 기한 경과(스케줄러) ──▶ expired ──▶ waitlist         │
       ├── 본인 취소 ──▶ canceled                               │
       └── 운영자 거절 ──▶ rejected                             │
                                                               │
confirmed ──── 환불 요청 ──▶ refund_requested ──▶ refunded      │
                                  └── 철회 ────────────────────┘

종단: rejected · refunded · canceled
```

| from | 갈 수 있는 곳 | 누가 |
|---|---|---|
| `pre_registered` | `awaiting_payment` · `waitlist` | 본인(폼 제출) |
| | `rejected` · `canceled` | 운영자 / 본인 |
| `awaiting_payment` | `confirmed` | 입금 기록(운영자) |
| | `expired` | 스케줄러 또는 운영자 |
| | `canceled` · `rejected` · `waitlist` | 본인 / 운영자 |
| `waitlist` | `awaiting_payment` | 운영자(자리 확보 필요) |
| | `canceled` · `rejected` | |
| `expired` | `waitlist` · `awaiting_payment` | 운영자 |
| `confirmed` | `refund_requested` | 운영자 |
| `refund_requested` | `refunded` · `confirmed` | 운영자 |
| `rejected` · `refunded` · `canceled` | — | 종단 |

### 3.3 자리(slot) 규칙

- **자리를 쥔 상태** = `{awaiting_payment, confirmed}`. 이 집합은 `status.ts` 한 곳에만 적는다.
- 비보유 → 보유로 들어갈 때 `taken + 1 where taken < capacity`. 실패하면 **409 `full`**이고 상태는 안 바뀐다.
- 보유 → 비보유로 나갈 때 `taken - 1`.
- 🔴 **보유 → 보유는 아무것도 하지 않는다**(`awaiting_payment → confirmed`).
  #9 핫픽스가 고친 것이 이 경로다 — 한 사람이 두 칸을 쥐면 정원이 실질 18명으로 준다.

### 3.4 확정될 때 함께 일어나는 일

`awaiting_payment → confirmed` 한 번에 네 가지가 **같은 트랜잭션에서** 일어난다:

1. `payment` 행 INSERT
2. `application.status = 'confirmed'`
3. `nick` 배정 — `결1`~`결20` 중 가장 작은 빈 번호
4. `event_log` 기록 + `notification` 큐에 확정 안내·사전질문 링크 적재

하나라도 실패하면 전부 되돌아간다. **입금은 기록됐는데 확정이 안 된 상태가 가장 나쁘다.**

---

## 4. 알림이 걸리는 지점 (문구는 이슈 #4에서 확정)

이 문서는 **테이블이 언제 알림 큐를 건드리는지**만 못박는다.

| 시점 | 상태 변화 | 큐에 들어가는 것 |
|---|---|---|
| 신청 즉시 | → `pre_registered` | **N1** 감사 + 마이페이지 링크 (`scheduled_at = now()`) |
| 1단계 제출 | → `awaiting_payment` | **N2** 계좌·금액·「3일」 안내 |
| 자리 실패 | → `waitlist` | 대기 안내 |
| 기한 24h 전 | (없음) | 리마인드 (`scheduled_at = due_at - 24h`) |
| 기한 경과 | → `expired` | 만료 안내 |
| 입금 확인 | → `confirmed` | **N3** 확정 + **N4** 사전질문 (`max(now, 행사일-28일)`) |
| 행사 상대일 | (없음) | D-2 · D-1 · D-0 · 체크인 · T+1 · T+3 · T+5 |

⚠️ 행사가 10/24라 28일 전은 **9/26**인데 모집 시작이 9/28이다. 즉 1차 행사에서는
N4가 **항상 입금 확인 즉시** 나간다. 규칙은 그대로 구현한다 — 2차 행사부터 의미가 생긴다.

🔴 **「3일」이 사실과 다른 구간이 있다** — 10/15·16·17 제출자는 전체 마감(10/17 23:59)에
걸려 72시간을 못 받는다. 코드로 처리하지 않고 소유자가 개별 안내한다
([`decisions/001`](./decisions/001-payment-deadline-copy-2026-09-04.md)).

---

## 5. 개인정보 보유·파기 (이슈 #21)

🔴 **화면에 고지한 이상 실제로 돌아야 한다.** 고지만 하고 안 지우면 그 고지가 새 위반이 된다.
고지 원문은 `src/components/ApplyForm.tsx:387-412`.

| 규칙 | 시점 | 지우는 것 |
|---|---|---|
| `event+30d` | 행사 종료 후 30일 | `answer` 전부 · `application`의 `job` · `marital` · `depositor_name` · `memo` · `utm` · `notification`(payload 포함) |
| `event+3y` | 행사 후 3년 | `application` 행 · `applicant` 행(다른 회차 신청이 없을 때만) |
| 법정 보존 | 5년 | `payment`는 **남긴다**(전자상거래법 제6조) |

**순서가 중요하다.** `payment.application_id`가 `on delete set null`이라 3년 파기 때
결제 기록은 끊어진 채 살아남는다(§2.5). cascade였다면 여기서 법정 의무를 어긴다.

파기 한 건마다 `purge_log` 한 줄. 배치는 Vercel Cron 일 1회(이슈 #16).

---

## 6. 재사용하는 것 (다시 만들지 말 것)

전부 실전에서 검증된 코드다. 이슈 #11·#12는 이것을 **그대로 가져다 쓴다.**

| 무엇 | 어디 | 왜 |
|---|---|---|
| 선착순 UPDATE 한 줄 | `api/pre/[token]/route.ts:188-194` | 동시 27건 실측 통과 |
| `tx()` · `isUniqueViolation()` | `src/lib/db.ts` | 트랜잭션·23505 판정 |
| `ageOn(birth)` | `src/lib/age.ts` | 🔴 서버는 클라이언트가 보낸 나이를 절대 믿지 않는다 |
| `dueAtFrom()` · `overallDeadline()` · `isClosed()` | `src/lib/deadline.ts` | 기한 둘 중 먼저 오는 쪽 |
| `newToken()` | `src/lib/admin.ts` | 토큰 생성 |
| `import "server-only"` | `src/lib/form9-copy.ts` | 🔴 문항이 브라우저 번들에 박히는 것을 막는다 |
| 풀 크기 `max: 10` | `src/lib/db.ts:29-34` | ⚠️ `max:1`로 되돌리면 동시 제출이 줄서다 죽는다 |

---

## 7. 프로덕션 실측 (2026-09-05)

마이그레이션을 짜기 전에 확인한 값이다. **백필이 필요 없다는 근거.**

```
applicant           0건
gender_slot         M taken 0 / capacity 10 · F taken 0 / capacity 10
schema_migration    001_applicant.sql · 002_payment_participant.sql
                    003_form9_on_applicant.sql · 004_split_form9.sql   ← 4건 모두 기록됨
```

- 신청자 0건 → **백필 스크립트·전환 시점 문서 불필요.** 옛 표를 drop해도 잃을 데이터가 없다.
- `schema_migration`에 001~004가 기록돼 있음 → `npm run db:migrate`가 003을 재실행해
  표를 날릴 위험이 **없다**(`architecture.md` §1.1이 경고하던 사고). 핸드오프 미해결 항목 해소.

⚠️ 005를 적용하기 직전에 위 세 줄을 **다시 확인한다.** 그 사이에 신청자가 생겼다면
이 문서의 전제가 깨지고 백필이 필요해진다.

---

## 8. 승인 후 할 일

| 이슈 | 무엇 |
|---|---|
| #11 | 마이그레이션 `005_redesign.sql` — 이 문서 그대로 |
| #12 | `src/lib/status.ts` 단일 전이표 + API 재편([`api.md`](./api.md)) |
| #13 | `source`·`utm` 채우기 + `/me` 계측 |
| #21 | 파기 배치 + `purge_log` |
