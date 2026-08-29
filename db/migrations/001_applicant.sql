-- ═══════════════════════════════════════════════════════════════
-- 001 · 사전등록과 상태 관리
--
-- 근거: 지식베이스 `오프라인 프로그램/8_참가자모집/한결_신청결제_DB인계.md` §1·§2
-- 실행: db/README.md 참조 (Neon 콘솔 SQL Editor 또는 psql)
--
-- 이 마이그레이션이 도는 순간부터 신청이 실제로 저장된다. 그전까지 랜딩 폼은
-- 메일만 보내고 있었고, 그래서 "사전 등록을 받고 있다고 생각하지만 실제로는
-- 아무것도 안 쌓이고 있는" 상태였다.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── applicant · 신청한 전원 ─────────────────────────────────────
-- 🔴 `participant`(확정된 20명)와 섞지 않는다. 여기는 신청한 전원이다.
create table if not exists applicant (
  id                  uuid primary key default gen_random_uuid(),

  -- 랜딩 폼에서 받는 것 (최소한만)
  name                text        not null,
  phone               text        not null,
  gender              text        not null check (gender in ('M','F')),
  -- 🔴 `age` 컬럼을 만들지 않는다. birth에서 계산한다.
  --    두 벌로 저장하면 해가 바뀔 때 서로 어긋난다.
  birth               date        not null,

  status              text        not null default 'pre_registered'
    check (status in ('pre_registered','approved','awaiting_payment','confirmed',
                      'waitlist','rejected','expired','refund_requested','refunded')),

  -- 🔴 선착순의 근거는 `created_at`이 아니라 이 정수다.
  --    created_at은 동시 제출 시 같은 값이 나올 수 있어 순서를 못 가린다.
  -- ⚠️ **중간에 번호가 빈다.** 시퀀스는 저장에 실패한 시도(중복 번호 등)에서도
  --    번호를 소모한다. 순서를 가리는 데는 아무 문제가 없지만, 참가자에게
  --    「N번째로 신청하셨습니다」로 보여주면 안 된다 — 실제 등수보다 큰 수가 나온다.
  --    등수가 필요하면 그때 `row_number() over (order by seq)`로 센다.
  seq                 bigserial   not null,

  notified_at         timestamptz,               -- 알림톡을 보낸 시각
  due_at              timestamptz,               -- notified_at + 72h. 입금 기한
  reminded_at         timestamptz,               -- 기한 하루 전 리마인드 중복 방지
  kakao_linked        boolean     not null default false,

  -- 동의는 「했다」가 아니라 「언제 했다」를 남긴다. boolean만으로는 입증이 안 된다.
  -- 개인정보보호법 §22가 각각의 동의를 구분해 받으라고 정하므로 컬럼을 따로 둔다.
  privacy_agreed_at   timestamptz not null,
  marketing_agreed_at timestamptz,               -- 다음 회차 안내 (선택)

  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 🔴 중복 신청을 DB가 막는다. 화면 검증만 믿지 않는다.
create unique index if not exists applicant_phone_uq on applicant (phone);
create index if not exists applicant_status_seq on applicant (status, seq);
create index if not exists applicant_due_at on applicant (due_at)
  where status = 'awaiting_payment';

-- ── applicant_event · 상태 전이 로그 ────────────────────────────
-- 🔴 분쟁이 생기면 이것만이 근거다. 누가·언제·왜 바꿨는지 전부 남긴다.
create table if not exists applicant_event (
  id           bigserial   primary key,
  applicant_id uuid        not null references applicant(id) on delete cascade,
  from_status  text,
  to_status    text        not null,
  reason       text,
  actor        text        not null,            -- 'system' 또는 운영자 이름
  at           timestamptz not null default now()
);
create index if not exists applicant_event_applicant on applicant_event (applicant_id, at);

-- ── gender_slot · 남10 · 여10 선착순 카운터 ─────────────────────
-- 🔴 왜 테이블인가 — 자리를 셀 때 `select count(*)` 후 `update`를 하면,
--    읽고 쓰는 사이에 다른 사람이 끼어들어 **21번째 참가자**가 생긴다.
--    한 줄짜리 UPDATE(`taken < capacity` 조건 포함)는 행 잠금을 스스로 잡으므로
--    긴 트랜잭션 없이도 그 사고가 구조적으로 불가능해진다.
-- 🔴 전체 20이 아니라 성별로 따로 센다. 전체로 세면 남자만 20명이 온다.
create table if not exists gender_slot (
  gender   text primary key check (gender in ('M','F')),
  taken    integer not null default 0 check (taken >= 0),
  capacity integer not null
);
insert into gender_slot (gender, taken, capacity) values ('M', 0, 10), ('F', 0, 10)
  on conflict (gender) do nothing;

-- ── recruit_display · 공개용 모집 현황 워터마크 ─────────────────
-- 🔴 만료로 자리가 되살아나도 **공개 숫자는 되돌리지 않는다.**
--    늘었다 줄었다 하는 숫자는 신뢰를 깬다. 내부 현황판은 실제 값을 그대로 본다.
create table if not exists recruit_display (
  gender     text primary key check (gender in ('M','F')),
  high_water integer not null default 0
);
insert into recruit_display (gender, high_water) values ('M', 0), ('F', 0)
  on conflict (gender) do nothing;

-- ── updated_at 자동 갱신 ────────────────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists applicant_touch on applicant;
create trigger applicant_touch before update on applicant
  for each row execute function touch_updated_at();
