-- ═══════════════════════════════════════════════════════════════
-- 002 · 결제 · 참가자 · 사전 10문항
--
-- 근거: `8_참가자모집/한결_신청결제_DB인계.md` §2-3·§2-4
--       `7_폼/한결_폼9_개발명세.md` §4
-- ═══════════════════════════════════════════════════════════════

-- ── participant · 확정된 20명 ───────────────────────────────────
-- 🔴 `applicant`(신청한 전원)와 섞지 않는다. 여기는 입금이 확인된 사람만 들어온다.
create table if not exists participant (
  nick               text        primary key,      -- 결1 ~ 결20
  applicant_id       uuid        unique references applicant(id),
  name               text        not null,
  gender             text        not null check (gender in ('M','F')),
  phone              text        not null,
  -- 🔴 추측 불가한 12자 이상. 이 토큰이 곧 신원이다(로그인이 없다).
  token              text        unique not null,

  birth              date        not null,
  marital            text        not null check (marital in ('미혼','기혼')),
  job                text        not null,
  -- 🟡 선택 항목. 리포트를 메일로도 받고 싶은 분만. not null로 만들지 않는다.
  email              text,

  -- 신청자와 다를 때만 채운다. 같으면 NULL.
  -- 🔴 이 칸 하나가 「입금자명 불일치」 업무를 거의 없앤다 —
  --    20명 중 2~4명은 부모·배우자·회사 명의로 입금한다.
  depositor_name     text,

  -- 동의는 「했다」가 아니라 「언제 했다」를 남긴다.
  -- 🔴 truth_agreed_at을 privacy_agreed_at과 따로 두는 이유는 개인정보보호법 §22가
  --    각각의 동의를 구분해 받으라고 정하기 때문이다.
  privacy_agreed_at  timestamptz not null,
  truth_agreed_at    timestamptz not null,
  refund_agreed_at   timestamptz not null,
  email_agreed_at    timestamptz,

  created_at         timestamptz not null default now()
);
create index if not exists participant_gender on participant (gender);

-- ── answer_pre · 사전 10문항 ────────────────────────────────────
create table if not exists answer_pre (
  nick     text        primary key references participant(nick) on delete cascade,
  -- [1,1,1,[1,2],1,[1,2],1,1,1,1] — 길이 10 고정.
  -- 🔴 4번·6번만 [나, 상대] 두 값의 배열이다(페어드 문항). 10번만 3지선다.
  a        jsonb       not null,
  -- 🔴 2부 비교표 동의. 동의 없이 비교표를 보여주면 안 된다.
  consent  boolean     not null,
  at       timestamptz not null default now()
);

-- ── payment · 입금 대사 ─────────────────────────────────────────
create table if not exists payment (
  id              bigserial   primary key,
  applicant_id    uuid        not null references applicant(id),

  -- 🟡 원 단위 정수다. 실수형을 쓰면 39000.00000001 같은 게 나온다.
  amount          integer     not null,
  depositor       text        not null,          -- 통장에 찍힌 실제 입금자명
  deposited_at    timestamptz not null,          -- 통장 기준 입금 시각
  method          text        not null default 'bank_transfer',

  verified_by     text        not null,          -- 확인한 사람
  verified_at     timestamptz not null default now(),

  -- 🔴 부분 환불이 있다(50% 위약금). boolean이 아니라 금액으로 두는 이유다.
  refunded_amount integer     not null default 0,
  refunded_at     timestamptz,
  refund_reason   text,

  note            text
);

-- 🔴 한 사람이 두 번 결제로 잡히는 것을 막는다.
--    환불된 건은 제외해야 재결제가 가능하므로 부분 인덱스로 둔다.
create unique index if not exists payment_applicant_uq on payment (applicant_id)
  where refunded_at is null;
