-- ═══════════════════════════════════════════════════════════════
-- 004 · 폼9를 2단계로 쪼갠다
--
-- 사전등록만 하면(무료 · 이름/번호만) 영업비밀인 문항 10개를 다 볼 수 있었다.
-- 소유자 결정(2026-08-30) — **결제가 확인된 사람에게만 문항을 준다.**
--
--   1단계 /pre/:token   신원 + 결제정보  → 🔴 여기서 자리를 잡는다
--   2단계 /q/:token     사전 10문항      → status='confirmed' 인 사람만
--
-- 🔴 자리는 **여전히 1단계 제출 시점**에 잡는다. 입금 시점으로 옮기지 말 것 —
--    25명이 동시에 입금하면 5명을 환불해야 하고 그게 그대로 분쟁이 된다.
-- ═══════════════════════════════════════════════════════════════

-- 🔴 1단계 토큰으로 2단계가 열리면 안 된다. 그러면 쪼갠 의미가 없다.
alter table applicant add column if not exists q_token text;

create unique index if not exists applicant_q_token_uq on applicant (q_token)
  where q_token is not null;

-- 링크를 언제 만들어 보냈는지. 운영자 화면이 「보냈나 안 보냈나」를 보여줘야 한다.
alter table applicant add column if not exists pre_link_at timestamptz;
alter table applicant add column if not exists q_link_at   timestamptz;
