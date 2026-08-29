-- ═══════════════════════════════════════════════════════════════
-- 003 · 폼9를 applicant 위에 올린다 (002 구조 교정)
--
-- 002는 폼9 응답을 `participant`에 매달아 뒀는데, 순서가 맞지 않는다.
--
--   D-26 발송 → 폼9 제출(자리 확보) → 72h 입금 → 입금 확인 → 확정
--                     ↑ 여기서 답이 들어온다        ↑ participant는 여기서 생긴다
--
-- 폼9는 **입금 전에** 제출되므로 그 시점에 participant가 없다. 답을 담을 곳이 없었다.
-- 그래서 폼9가 받는 것(신원·결제정보·응답)은 전부 `applicant`에 둔다.
-- `participant`는 「확정된 20명」에게 닉네임과 현장 링크를 주는 얇은 표로 남긴다.
-- ═══════════════════════════════════════════════════════════════

-- ── applicant · 폼9가 채우는 칸들 ───────────────────────────────
alter table applicant add column if not exists pre_token        text;
alter table applicant add column if not exists marital          text;
alter table applicant add column if not exists job              text;
alter table applicant add column if not exists email            text;
alter table applicant add column if not exists depositor_name   text;
alter table applicant add column if not exists truth_agreed_at  timestamptz;
alter table applicant add column if not exists refund_agreed_at timestamptz;
alter table applicant add column if not exists email_agreed_at  timestamptz;
-- 폼9를 제출해 자리를 잡은 시각. 🔴 선착순의 기준점이다.
alter table applicant add column if not exists held_at          timestamptz;
alter table applicant add column if not exists submitted_at     timestamptz;

do $$ begin
  alter table applicant add constraint applicant_marital_ck
    check (marital is null or marital in ('미혼','기혼'));
exception when duplicate_object then null; end $$;

-- 🔴 추측 불가한 토큰이 곧 신원이다(로그인이 없다). 반드시 유일해야 한다.
create unique index if not exists applicant_pre_token_uq on applicant (pre_token)
  where pre_token is not null;

-- ── answer_pre · participant → applicant 로 옮긴다 ──────────────
-- 아직 아무 데이터도 없다(모집 전). 그래서 그냥 다시 만든다.
drop table if exists answer_pre;
create table answer_pre (
  applicant_id uuid        primary key references applicant(id) on delete cascade,
  -- [1,1,1,[1,2],1,[1,2],1,1,1,1] — 길이 10 고정.
  -- 🔴 4번·6번만 [나, 상대] 두 값의 배열이다(페어드). 10번만 3지선다.
  a            jsonb       not null,
  -- 🔴 2부 비교표 동의. 동의 없이 비교표를 보여주면 안 된다.
  consent      boolean     not null,
  at           timestamptz not null default now()
);

-- ── participant · 얇게 남긴다 ───────────────────────────────────
-- 신원·동의·입금자명은 전부 applicant에 있다. 두 벌로 두면 반드시 어긋난다.
drop table if exists participant;
create table participant (
  nick         text        primary key,            -- 결1 ~ 결20
  applicant_id uuid        unique not null references applicant(id),
  -- 체크인 때 문자로 보내는 현장 폼(10~14) 링크의 토큰. 폼9 토큰과 별개다.
  site_token   text        unique not null,
  created_at   timestamptz not null default now()
);

-- payment는 002 그대로 쓴다(applicant_id를 참조하고 있어 영향 없다).
