-- ═══════════════════════════════════════════════════════════════
-- 007 · 개인정보 파기가 실제로 지울 수 있게 컬럼을 놓아준다
--
-- 근거: `docs/decisions/003-scenario-redesign-2026-09-05.md` §5(결정 15·16) · 이슈 #42
-- 말의 뜻: `CONTEXT.md` "파기"
--
-- 🔴 `005_rebuild.sql`은 `applicant.name`·`phone`·`birth`를 `not null`로 만들었다 —
--    신청이 살아 있는 동안은 셋 다 반드시 있어야 하는 값이라 맞는 제약이었다.
--    그런데 3년 파기(§5 결정 16)는 이 값들을 **지운다**(더미 값으로 덮지 않는다 —
--    더미 값은 "그때 그 사람이 실제로 이 이름이었다"는 거짓 기록을 새로 만든다).
--    지운다는 것은 NULL이 된다는 뜻이므로, 제약을 먼저 풀어야 파기 배치가 돌 수 있다.
-- ═══════════════════════════════════════════════════════════════

alter table applicant alter column name  drop not null;
alter table applicant alter column phone drop not null;
alter table applicant alter column birth drop not null;

-- 🔴 `phone`은 UNIQUE다. Postgres는 UNIQUE 안에서 NULL끼리는 서로 다른 값으로 본다
--    (`NULL <> NULL`)므로, 파기로 여러 사람의 phone이 동시에 NULL이 돼도 제약에
--    걸리지 않는다 — 이 마이그레이션에서 UNIQUE 자체를 손대지 않는 이유다.
