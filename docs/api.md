# API 설계

이슈 #6 산출물. **승인 전 초안이다.** 승인되면 이슈 #12가 이 문서를 그대로 구현한다.
현재 API 9개는 `docs/architecture.md` §2에 있다 — 이 문서는 **바뀔 모습**만 적는다.

작성 2026-09-05. 짝 문서: [`erd.md`](./erd.md) (테이블·상태 머신).

---

## 1. 응답 규약 — 여기 한 곳에만 적는다

지금은 라우트마다 응답 모양이 조금씩 다르다. `{ok:true, seq}`도 있고 `{error:"..."}`도 있고
`{submitted:true, ...}`도 있다. 화면이 라우트마다 다르게 읽어야 해서, 새 화면을 붙일 때마다
"이 라우트는 뭘 주더라"를 다시 확인해야 한다. **한 모양으로 고정한다.**

### 1.1 성공

```json
{ "ok": true, "data": { ... } }
```

### 1.2 실패

```json
{ "ok": false, "error": "already_submitted", "message": "이미 제출하셨습니다.", "detail": { } }
```

| 필드 | 누가 읽나 | 규칙 |
|---|---|---|
| `ok` | 화면 코드 | 🔴 **성공·실패를 이 값 하나로만 판정한다.** HTTP 상태 코드는 보조다 |
| `error` | 화면 코드 | `snake_case` 소문자. §1.4 목록에 없는 값을 새로 만들지 않는다 |
| `message` | 사람 | 화면에 그대로 띄워도 되는 한 문장. 없을 수 있다 |
| `detail` | 화면 코드 | 맥락(`{gender:"M"}`, `{at:3}`, `{from:"waitlist"}`). 없을 수 있다 |

🔴 **`message`에 내부 사정을 적지 않는다.** "DB 연결 실패", "row not found" 같은 문장은
공격자에게 구조를 알려준다. 사람에게는 "잠시 후 다시 시도해 주세요", 개발자에게는 서버 로그.

### 1.3 HTTP 상태 코드

| 코드 | 언제 |
|---|---|
| 200 | 조회 성공 |
| 201 | 새로 만들어짐(신청·제출·입금 기록) |
| 400 | 요청 형식·검증 실패 |
| 401 | 운영자 인증 없음 |
| 403 | 인증은 됐지만 이 상태에서는 못 함(예: 미확정자가 사전질문 요청) |
| 404 | 토큰·id 없음 |
| 409 | 충돌 — 정원 마감, 중복 신청, 허용되지 않은 전이 |
| 410 | 전체 마감이 지남 |
| 429 | 레이트리밋 |
| 500 | 서버 |

### 1.4 오류 코드 전체

| 코드 | 상태 | 뜻 |
|---|---|---|
| `bad_json` | 400 | 본문이 JSON이 아님 |
| `bad_field` | 400 | 검증 실패. `detail.field`에 어느 칸인지 |
| `need_consent` | 400 | 필수 동의 누락. `detail.which` |
| `bad_answers` | 400 | 답 형식 오류. `detail.at`(1-based 문항 번호) |
| `unauthorized` | 401 | 운영자 쿠키 없음·만료 |
| `not_eligible` | 403 | 이 상태에서는 안 됨. `detail.status` |
| `unknown_token` | 404 | 토큰 없음 |
| `not_found` | 404 | id 없음 |
| `duplicate` | 409 | 같은 전화번호가 이미 이 회차에 신청함 |
| `already_submitted` | 409 | 두 번째 제출 |
| `full` | 409 | 정원 마감. `detail.gender` |
| `not_allowed` | 409 | 허용되지 않은 상태 전이. `detail.from` · `detail.to` |
| `already_paid` | 409 | 살아 있는 입금 기록이 이미 있음 |
| `closed` | 410 | 전체 마감(행사 7일 전) 경과 |
| `rate_limited` | 429 | |
| `server` | 500 | |

### 1.5 참가자 화면 문구는 서버가 준다

🔴 **`/api/me/*` 응답에만 `copy` 블록이 붙는다.** 이유는 하나 —
사전 문항이 **영업비밀**이라 브라우저 번들에 들어가면 안 되기 때문이다
(`src/lib/form9-copy.ts`의 `import "server-only"`). 문항·안내 문구는 서버가 상태를 보고
그때그때 골라 내려준다. 운영자·공개 API에는 `copy`가 없다.

---

## 2. 인증 세 종류

| 종류 | 무엇이 신원인가 | 어디에 |
|---|---|---|
| **public** | 없음 | `/api/apply` · `/api/recruit` |
| **token** | URL 토큰(`application.token`) | `/api/me/*` |
| **admin** | `hg_admin` 쿠키(HMAC 서명, 12시간) | `/api/admin/*` |
| **cron** | `Authorization: Bearer $CRON_SECRET` | `/api/cron/*` |

🔴 **화면 검증을 믿지 않는다.** 주소만 알면 API를 직접 때릴 수 있다.
`/admin` 화면에서 한 번 막고, **API 하나하나에서 또 막는다.** 둘 중 하나만 있으면 샌다.

🔴 **서버는 클라이언트가 보낸 나이를 절대 믿지 않는다.** 항상 `birth`로 다시 계산한다(`ageOn`).

⚠️ `CRON_SECRET`은 Vercel Cron이 자동으로 헤더에 실어준다. 이 값이 없으면
`/api/cron/*`가 **누구나 부를 수 있는 주소**가 된다 — 없으면 500으로 죽게 만든다.

---

## 3. API 전체 목록

### 3.1 공개 (public)

| 메서드·경로 | 하는 일 |
|---|---|
| `POST /api/apply` | 신청 접수 |
| `GET /api/recruit` | 모집 현황(공개 워터마크) |

### 3.2 참가자 (token) — 전부 `/api/me` 아래로

| 메서드·경로 | 하는 일 | 옛 경로 |
|---|---|---|
| `GET /api/me/[token]` | 내 상태 + 지금 할 일 | `GET /api/pre` · `GET /api/q` |
| `POST /api/me/[token]/hold` | 1단계 폼 제출 → 자리 확보 | `POST /api/pre` |
| `POST /api/me/[token]/answers` | 사전 10문항 제출 | `POST /api/q` |
| `POST /api/me/[token]/site` | 현장 폼 제출(행사 당일) | 없었음 |
| `POST /api/me/[token]/cancel` | 본인 취소 | 없었음 |
| `POST /api/me/resend` | 링크 재발송(전화+생년월일) | 없었음 |

### 3.3 운영 (admin)

| 메서드·경로 | 하는 일 |
|---|---|
| `POST` / `DELETE /api/admin/session` | 로그인 / 로그아웃 |
| `GET /api/admin/applications` | 목록(필터·검색·정렬) |
| `POST /api/admin/applications` | 수동 추가(지인 충당용) |
| `GET /api/admin/applications/[id]` | 상세 — 답변·입금·알림·로그 전부 |
| `PATCH /api/admin/applications/[id]` | 필드 수정 |
| `DELETE /api/admin/applications/[id]` | 삭제(파기 로그 남김) |
| `POST /api/admin/applications/[id]/transition` | 상태 전이 |
| `POST /api/admin/applications/[id]/link` | 마이페이지 링크 발급·재발송 |
| `POST /api/admin/payments` | 입금 기록 → 확정 |
| `POST /api/admin/payments/[id]/refund` | 환불 기록 |
| `GET /api/admin/notifications` | 발송 큐 조회 |
| `POST /api/admin/notifications/[id]/retry` | 재발송 |
| `GET /api/admin/exports/pairing` | 내보내기 A(페어링 생성기용) |
| `GET /api/admin/exports/report` | 내보내기 B-1(이름·연락처 제외) |
| `GET /api/admin/metrics` | 지표 탭 |

### 3.4 시스템 (cron)

| 메서드·경로 | 주기 | 하는 일 |
|---|---|---|
| `POST /api/cron/tick` | 5분 | 알림 큐 발송 · 기한 만료 처리 · 리마인드 적재 |
| `POST /api/cron/purge` | 일 1회 | 보유기간 지난 정보 파기 + `purge_log` |

---

## 4. 주요 라우트 상세

### 4.1 `POST /api/apply` — 신청

```
요청  { name, phone, gender, birth, privacy_agreed, marketing_agreed?,
        source?, utm?, _gotcha? }
성공  201 { ok:true, data:{ seq, token_sent:true } }
```

| 검증 | 규칙 |
|---|---|
| `name` | trim 후 1~20자 |
| `phone` | 숫자만 남긴 뒤 `^010\d{8}$` |
| `gender` | `M` / `F` |
| `birth` | 실재하는 `YYYY-MM-DD`, 만 10~100세 |
| `privacy_agreed` | `=== true` (문자열 `"true"`는 거부) |

- 🔴 **나이가 참가 범위(20~32) 밖이어도 저장한다.** 거절하지 않고 `memo`에
  「자격 확인 필요 — 신청 시점 만 N세」를 남긴다. 사람이 판단할 일이지 폼이 자를 일이 아니다.
- 허니팟 `_gotcha`에 값이 있으면 **201에 `seq:0`**을 준다. 봇에게 실패를 알려주지 않는다.
- IP 레이트리밋 5회/60초. ⚠️ 인스턴스 메모리에만 있어 정확하지 않다 —
  막으려는 것은 분산 공격이 아니라 한 사람의 연타다. **진짜 방어선은 `phone` UNIQUE와 허니팟이다.**
- **한 트랜잭션 안에서** `applicant` upsert → `application` INSERT → `event_log` →
  `notification`(N1) 적재. 발송 자체는 스케줄러가 한다.
- 같은 전화번호가 이 회차에 이미 있으면 409 `duplicate`.

### 4.2 `GET /api/recruit` — 모집 현황

```
성공  200 { ok:true, data:{ phase, message, remaining? } }
```

`phase`: `hidden`(적게 찼을 때 숫자를 감춘다) · `counting`(`remaining:{M,F}` 포함) ·
`closed` · `unknown`(집계 실패 시에도 화면이 안 죽게).

- 워터마크(`recruit_display`)는 **내려가지 않는다.** 「3자리 남음」이 새로고침하면 「5자리」로
  늘어나는 것을 막는다.
- CDN 캐시 `s-maxage=60, stale-while-revalidate=300`.
- ⚠️ 문구가 지금은 라우트에 하드코딩돼 있다. `site.ts`로 옮긴다(이슈 #10).

### 4.3 `GET /api/me/[token]` — 마이페이지 ⭐ 새 구조의 중심

**링크 하나가 상태에 따라 다른 화면이 된다**(결정 3). 화면은 서버가 준 `stage`만 보고 그린다.

```
성공  200 { ok:true, data:{ stage, name, status, ...stage별 데이터, copy:{...}, biz? } }
```

| `stage` | 언제 | 무엇을 내려주나 |
|---|---|---|
| `hold` | `pre_registered` · 마감 전 | 1단계 폼 문항 + `prefill`(이름·전화·성별·생년) + `biz`(계좌·사업자) |
| `awaiting_payment` | 자리 확보 후 입금 전 | `due_at` · 계좌 · 금액 · 입금자명 |
| `questions` | `confirmed` · 답 안 함 | 🔴 사전 10문항 전문 + `pairedIndexes` |
| `done` | `confirmed` · 답 함 | 확정 안내 · 행사 정보 |
| `site` | 행사 당일 | 체크인 + 현장 폼 |
| `waitlist` | `waitlist` | 대기 안내 |
| `closed` | 전체 마감 경과 | 마감 안내 |
| `ended` | `expired` · `canceled` · `rejected` · `refunded` | 종료 안내 |

🔴 **문항은 `stage === 'questions'`일 때만 내려간다.** 토큰을 아는 것만으로는 못 본다 —
**입금까지 끝난 사람만** 본다. 지금도 실제 방어선은 토큰이 아니라 이 상태 검사다.

⚠️ `biz`(계좌번호·사업자 정보)는 `hold`·`awaiting_payment`에서만 내려준다.
지금은 토큰만 맞으면 언제나 내려가고 있다 — 좁힌다.

### 4.4 `POST /api/me/[token]/hold` — 1단계 제출, 자리 확보

```
요청  { profile:{ name, phone, birth, gender, marital, job, email?,
                  privacy_agreed, truth_agreed, email_agreed? },
        payment:{ depositor_name?, refund_policy_agreed } }
성공  201 { ok:true, data:{ due_at, depositor } }
실패  409 full { detail:{ gender } }  ·  409 already_submitted  ·  410 closed
```

**처리 순서 — 이 순서를 바꾸지 말 것:**

1. 토큰 조회 → 상태가 `rejected`·`expired`·`refunded`·`canceled`면 **403 `not_eligible`**
2. `submitted_at`이 이미 있으면 **409 `already_submitted`**
3. `isClosed()`면 **410 `closed`**
4. 트랜잭션 시작
   - 🔴 **이미 자리를 쥔 상태**(`awaiting_payment`·`confirmed`)면 `slot`을 **건드리지 않는다**
     — #9 핫픽스. 안 그러면 한 사람이 두 칸을 쥐어 정원이 실질 18명으로 준다
   - 아니면 `update slot set taken=taken+1 where taken<capacity` → 0행이면 롤백 후 `waitlist`
   - `applicant` 신원 갱신 + `application` 갱신(`status`·`held_at`·`submitted_at`·`due_at`)
   - `event_log` + `notification`(N2) 적재
5. 커밋

`due_at`은 `dueAtFrom(now)` — 개인 72h와 전체 마감(행사 7일 전 23:59:59 KST) 중 **먼저 오는 쪽**.

### 4.5 `POST /api/me/[token]/answers` — 사전 10문항

```
요청  { answers: (number | [1|2, 1|2])[], consent: boolean }
성공  201 { ok:true, data:{} }
실패  403 not_eligible (미확정)  ·  409 already_submitted  ·  400 bad_answers { detail:{ at } }
```

- 길이는 `QUESTIONS.length`와 정확히 같아야 한다.
- 페어드 문항(「나 / 상대」 2원 배열)은 서버가 `pairedIndexes`로 판정한다 — 클라이언트가 보낸 형태를 믿지 않는다.
- 저장할 때 `form_version`을 함께 박는다(문항이 바뀌면 과거 답의 뜻이 달라진다).
- 중복 제출은 사전 검사 + PK 충돌(23505) **두 곳에서** 막는다. 동시에 두 번 눌러도 안전하다.

### 4.6 `POST /api/me/resend` — 링크 재발송

```
요청  { phone, birth }
성공  200 { ok:true, data:{ sent:true } }
```

🔴 **찾았는지 못 찾았는지 알려주지 않는다.** 번호가 없어도 항상 같은 응답을 준다 —
아니면 이 API가 「이 번호가 신청했는지」를 알아내는 조회기가 된다.
실제 발송은 등록된 번호로만 나가므로 남의 링크를 받을 수 없다.

⚠️ 레이트리밋 필수(같은 번호 3회/시간). 없으면 알림톡 비용을 남이 태울 수 있다.

### 4.7 `POST /api/admin/payments` — 입금 기록 → 확정

```
요청  { application_id, amount, depositor, verified_by, deposited_at?, note? }
성공  201 { ok:true, data:{ payment_id, nick, warn? } }
실패  409 not_allowed { detail:{ from } }  ·  409 already_paid
```

**한 트랜잭션 안에서** (`erd.md` §3.4):
`for update` 잠금 → `awaiting_payment` 확인 → `payment` INSERT →
`status='confirmed'` → `nick` 배정(`결1`~`결20` 최소 빈 번호) → `event_log` →
`notification`(N3 확정 · N4 사전질문) 적재.

- 금액이 `EVENT.priceLabel`(39,000원)과 다르면 **저장은 하되** `warn`을 함께 준다.
  막지 않는 이유 — 실제로 990원 덜 넣는 사람이 있고, 그걸 시스템이 거절하면 운영자가 손으로 못 넣는다.
- 🔴 `awaiting_payment → confirmed`는 **둘 다 자리를 쥔 상태**라 `slot`을 건드리지 않는다.

### 4.8 `POST /api/admin/applications/[id]/transition` — 상태 전이

```
요청  { to, actor, reason? }
성공  200 { ok:true, data:{ from, to } }
실패  409 not_allowed { detail:{ from, to } }  ·  409 full { detail:{ gender } }
```

- `actor` **필수.** 운영자 셋이 비밀번호를 공유하므로 쿠키로는 누가 눌렀는지 모른다.
  화면에서 이름을 고르게 해 `event_log.actor`에 남긴다.
- 허용 전이표는 `src/lib/status.ts` **한 곳**에서 온다. 지금처럼 화면과 서버에 두 벌 복사하지 않는다.
- 자리 증감은 `erd.md` §3.3 규칙 그대로.

### 4.9 `DELETE /api/admin/applications/[id]` — 삭제

```
요청  { actor, reason }
성공  200 { ok:true, data:{ purged:[...] } }
```

- 자리를 쥔 상태였으면 `slot`을 **먼저 반납**하고 지운다.
- `purge_log`에 한 줄. 🔴 로그에 이름·전화를 적지 않는다 — 그러면 파기가 아니다.
- `payment`는 `on delete set null`로 살아남는다(법정 5년 보존).

### 4.10 `POST /api/cron/tick` — 5분마다

```
헤더  Authorization: Bearer $CRON_SECRET
성공  200 { ok:true, data:{ sent, expired, queued } }
```

세 가지를 한다:

1. **발송** — `notification`에서 `status='queued' and scheduled_at <= now()`를 꺼내 딜러사로.
   실패하면 `attempts+1`, `error` 기록, 다음 tick에 재시도.
2. **만료** — `status='awaiting_payment' and due_at < now()` → `expired` + `slot` 반납 + 만료 알림 적재.
   🔴 지금은 이게 없어서 **운영자가 손으로 눌러야 자리가 풀린다.**
3. **리마인드** — `due_at - 24h`가 지났고 아직 안 보낸 건을 큐에 적재.

⚠️ 겹쳐 도는 것을 막아야 한다(발송이 5분을 넘길 수 있다). `notification` 행을
`status='sending'`으로 먼저 잠그고 처리한다.

---

## 5. 계측 (이슈 #13)

🔴 **이벤트에 개인정보를 절대 싣지 않는다.** 이름·연락처·나이를 인자로 넘기지 말 것.

- 지금 `/pre`·`/q`·`/admin`은 `SiteChrome`이 `Analytics`를 통째로 빼서 **방문·이탈·제출이
  아무 데도 기록되지 않는다.** `/me`는 계측을 켠다(단, 문항 내용은 절대 안 보낸다).
- `applicant.source`·`utm`은 `/events/1?utm_source=instagram` 같은 링크를 신청 폼이 읽어
  함께 보낸다. 없으면 referrer 도메인으로 추정.
- ⚠️ Vercel 커스텀 이벤트는 Pro 요금제부터다. Hobby에서는 402로 막힌다(2026-08-21 실측).

---

## 6. 지금 API와의 대조표

| 옛 | 새 | 달라지는 것 |
|---|---|---|
| `POST /api/apply` | 같음 | `source`·`utm` 추가, 응답 규약, N1 큐 적재 |
| `GET /api/recruit` | 같음 | 응답 규약, 문구를 `site.ts`로 |
| `GET/POST /api/pre/[token]` | `GET /api/me/[token]` + `POST .../hold` | 토큰 통합, `biz` 노출 좁힘 |
| `GET/POST /api/q/[token]` | `GET /api/me/[token]` + `POST .../answers` | 토큰 통합, `form_version` 저장 |
| — | `POST .../site` · `.../cancel` · `/api/me/resend` | 신설 |
| `POST/DELETE /api/admin/login` | `/api/admin/session` | 이름만 |
| `GET /api/admin/applicants` | `GET /api/admin/applications` | 필터·검색·정렬 추가 |
| — | `POST` · `GET [id]` · `PATCH` · `DELETE` | 신설(CRUD) |
| `.../[id]/transition` | 같음 | `status.ts` 단일 전이표 |
| `.../[id]/token` | `.../[id]/link` | 토큰 하나 |
| `POST /api/admin/payments` | 같음 | `nick`이 `application`으로, 환불 API 추가 |
| — | `notifications` · `exports` · `metrics` | 신설 |
| — | `/api/cron/tick` · `/api/cron/purge` | 신설 |

---

## 7. 승인 후 할 일

| 이슈 | 무엇 |
|---|---|
| #12 | 이 문서대로 API 재편 + `src/lib/status.ts` |
| #13 | `source`·`utm` + `/me` 계측 |
| #14 | 운영자 페이지가 이 API를 쓴다 |
| #17 | `/api/admin/session` 레이트리밋 + 비밀번호와 HMAC 키 분리 |
| #18 | `POST /api/me/[token]/site` |
| #19 | `exports` |
| #22 | `metrics` |
