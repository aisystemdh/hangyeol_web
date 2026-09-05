-- ═══════════════════════════════════════════════════════════════
-- 005 · 전면 재건 — 자리는 「입금 확인」으로만 찬다
--
-- 근거: `docs/decisions/003-scenario-redesign-2026-09-05.md` §5 · 이슈 #28 · #30
-- 말의 뜻: `CONTEXT.md`
--
-- 001~004는 **선착순 시스템**이었다. 신청 순서대로 성별 슬롯을 조건부로 잠그고,
-- 상태가 아홉 개이며, 기한이 지나면 자리가 자동으로 되살아났다.
-- 소유자가 실제로 운영하려는 방식은 그게 아니다 — **운영자가 은행 앱을 보고
-- 「입금 확인」을 누르는 순간에만** 자리가 찬다. 확인이 사람 손이라 방어할 동시성이
-- 애초에 존재하지 않고, 그래서 슬롯 자물쇠가 통째로 필요 없어졌다.
--
-- 🔴 **drop과 create가 한 파일에 있다.** `db/migrate.mjs`는 파일 하나를 한 트랜잭션으로
--    돌린다. 쪼개면 중간에 실패했을 때 **표가 절반만 남고**, 그 상태가 가장 고치기 어렵다.
--
-- 🔴 **백필하지 않는다.** 2026-09-05 프로덕션 실측 `applicant` 0건 — 옮길 데이터가 없다.
--    모집이 시작되면 이 기회는 영영 사라진다.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ═══ 1. 옛 표를 지운다 ═════════════════════════════════════════
-- 순서를 신경 쓰지 않으려고 cascade를 붙였다. 참조가 얽혀 있어 손으로 순서를
-- 맞추면 나중에 표를 하나 더할 때마다 이 목록을 다시 정렬해야 한다.
drop table if exists answer_pre      cascade;
drop table if exists participant     cascade;
drop table if exists payment         cascade;
drop table if exists applicant_event cascade;
drop table if exists gender_slot     cascade;   -- 결정 1 — 잠글 자물쇠가 없어졌다
drop table if exists recruit_display cascade;   -- 공개 워터마크 폐기 (§5)
drop table if exists applicant       cascade;

-- ═══ 2. event · 회차 ═══════════════════════════════════════════
-- 🔴 `date`는 `src/lib/event.ts`의 `EVENT.dateISO`의 **사본**이다. 정본은 코드에 있다.
--    DB가 이 날짜를 들고 있는 이유는 돈 줄이 신원과 끊긴 뒤에도(§5 아래) 「어느 회차의
--    매출인가」를 답할 수 있어야 하기 때문이지, 앱이 여기서 날짜를 읽으려는 게 아니다.
-- 🔴 **정원 숫자를 여기 두지 않는다**(결정 5). 정원 정본은 `event.ts` 한 곳이다 —
--    DB에도 적으면 반드시 한쪽이 낡는다.
create table event (
  id         smallint    primary key,          -- 회차 번호. 1차 = 1
  title      text        not null,
  date       date        not null,
  created_at timestamptz not null default now()
);

insert into event (id, title, date)
values (1, '1차 오프라인 모임', '2026-10-24')
on conflict (id) do nothing;

-- ═══ 3. applicant · 사람 ═══════════════════════════════════════
-- 🔴 **신원만 둔다.** 상태·동의·기한은 전부 아래 `application`에 있다.
--    옛 구조는 사람과 신청이 한 표라 `phone`이 UNIQUE인 순간 **같은 사람이 2차 회차에
--    다시 들어올 수 없었다**(결정 4). 사람은 회차가 바뀌어도 같은 사람이다.
-- 🔴 **나이 컬럼을 만들지 않는다.** 항상 `birth`에서 계산한다(`src/lib/age.ts`).
--    두 벌로 저장하면 해가 바뀔 때 서로 어긋나고, 화면이 보낸 나이를 믿는 길이 생긴다.
create table applicant (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  phone      text        not null unique,       -- 사람을 구분하는 값 (CONTEXT.md 「사람」)
  gender     text        not null check (gender in ('M','F')),
  birth      date        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══ 4. application · 신청 ═════════════════════════════════════
-- 🔴 **신청은 자리가 아니다**(CONTEXT.md). 여기 한 줄이 생겼다고 아무 자리도 잡히지 않는다.
create table application (
  id              uuid        primary key default gen_random_uuid(),
  applicant_id    uuid        not null references applicant(id) on delete cascade,
  event_id        smallint    not null references event(id),

  -- 🔴 **상태는 셋뿐이다**(결정 2). DB 제약으로 못박는다 — 옛 아홉 개는 자동 처리가
  --    없어지면서 여섯 개가 뜻을 잃었다.
  -- 🔴 **대기자는 여기 없다.** 저장하는 값이 아니라 「자기 성별 입금완료 수가 정원에
  --    닿았는가」를 그때그때 세어서 판단한다(CONTEXT.md 「대기자」).
  status          text        not null default '신청함'
                    check (status in ('신청함','입금완료','취소됨')),

  -- 접수 순서. ⚠️ 중간에 번호가 빈다(실패한 insert도 시퀀스를 소모한다).
  --    순서를 가리는 데는 문제없지만 손님에게 「N번째」로 보여주면 안 된다.
  seq             bigserial   not null,

  -- 🔴 손님이 받는 링크는 이 토큰 하나뿐이다(`/me/<토큰>`, 결정 6).
  --    로그인이 없으므로 **이 토큰이 곧 신원이다.**
  token           text        not null unique,
  token_issued_at timestamptz not null default now(),

  -- 🔴 기한을 **계산해서 박아 둔다**(신청 시각 + 72시간). 규칙이 나중에 바뀌어도
  --    과거에 약속한 기한이 따라 움직이면 안 된다.
  -- 🔴 **대기자로 접수된 신청은 비어 있다** — 낼 자리가 없는 사람에게 시계를 돌리지 않는다.
  due_at          timestamptz,

  -- ── 정식등록 (마이페이지에서 손님이 낸다) ──
  registered_at   timestamptz,
  marital         text        check (marital is null or marital in ('미혼','기혼')),
  job             text,
  email           text,
  -- 신청자와 입금자가 다를 때 채운다. 20명 중 2~4명은 부모·배우자·회사 명의로 넣는다.
  depositor_name  text,

  -- ── 동의 ──
  -- 🔴 「했다」가 아니라 「언제 했다」를 남긴다. boolean만으로는 입증이 안 된다.
  --    개인정보보호법 §22가 각각의 동의를 구분해 받으라고 정하므로 칸을 따로 둔다.
  -- 🔴 동의가 **회차마다** 붙는다(사람이 아니라 신청에 있다). 2차에 다시 신청하면
  --    그때 다시 받아야 하는 것이 맞다.
  privacy_agreed_at   timestamptz not null,     -- 신청 폼에서 필수
  marketing_agreed_at timestamptz,              -- 선택
  truth_agreed_at     timestamptz,              -- 정식등록에서 받는다
  refund_agreed_at    timestamptz,
  email_agreed_at     timestamptz,

  -- ── 확정 ──
  -- 🔴 **자리가 차는 순간이 여기다.** 운영자가 입금을 확인한 시각.
  paid_at         timestamptz,
  -- 이름표 번호 1~20. 🔴 행사 며칠 전 스무 명에게 **한 번에** 붙인다(결정 14) —
  -- 입금 순서대로 즉시 붙이면 중간 취소로 번호가 비고 현장에서 곧바로 티가 난다.
  nick            smallint    check (nick is null or (nick between 1 and 20)),

  -- 🔴 값이 있으면 마이페이지 화면 선택 순서를 무시하고 이 화면을 보여준다(결정 13).
  --    운영자 목록에 「화면 고정됨」으로 뜬다 — 표시가 없으면 풀어주는 것을 잊는다.
  view_override   text,

  -- ── 유입 ──
  source          text,
  utm             jsonb,
  referrer        text,
  landing_path    text,

  memo            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 🔴 한 사람은 한 회차에 신청 하나(CONTEXT.md 「신청」). 회차가 다르면 또 낼 수 있다.
  unique (applicant_id, event_id)
);

-- 이름표 번호는 회차 안에서 유일하다. 아직 안 붙은 신청끼리는 겹칠 일이 없으므로 부분 인덱스다.
create unique index application_nick_uq on application (event_id, nick) where nick is not null;

-- 자리를 세는 질의(`status='입금완료'`를 성별로)와 목록 정렬이 타는 길이다.
create index application_event_status on application (event_id, status, seq);
-- 운영자 목록의 「기한」 칸 — 자동 만료가 없어진 지금 유일한 안전장치다.
create index application_due_at on application (due_at) where status = '신청함';

-- ═══ 5. answer · 답변 ══════════════════════════════════════════
create table answer (
  id             bigserial   primary key,
  application_id uuid        not null references application(id) on delete cascade,
  -- '사전질문' 같은 폼 이름. 현장에서 라운드마다 받는 답은 'round'로 쌓는다.
  form           text        not null,
  round          smallint,
  -- 🔴 문항이 바뀌면 **과거 답의 뜻이 통째로 달라진다.** 그때 무엇을 물었는지가
  --    남아 있지 않으면 다음 회차 짝 맞추기의 근거가 사라진다.
  form_version   text        not null,
  a              jsonb       not null,
  created_at     timestamptz not null default now(),

  -- 🔴 round가 엉뚱한 폼에 섞이는 것을 DB가 막는다.
  constraint answer_round_ck check ((form = 'round') = (round is not null))
);

-- 🔴 **부분 UNIQUE가 두 개인 것이 핵심이다.** `unique (application_id, form, round)`
--    하나로 합치면 Postgres가 NULL을 서로 다른 값으로 보기 때문에
--    round가 NULL인 폼(사전질문)은 **새로고침 두 번으로 중복 제출이 뚫린다.**
create unique index answer_form_uq  on answer (application_id, form)  where form <> 'round';
create unique index answer_round_uq on answer (application_id, round) where form =  'round';

-- ═══ 6. money · 돈 줄 ══════════════════════════════════════════
-- 🔴 덧붙이기만 한다(결정 15). 「입금액·환불액」 칸 두 개로 두면 재입금·부분환불·
--    금액 착오가 생겼을 때 덮어써져 **사실이 사라진다.** 그 사람이 낸 돈은 줄의 합이다.
create table money (
  id             bigserial   primary key,

  -- 🔴 **`on delete set null`이다. cascade로 되돌리지 말 것.**
  --    신원은 3년 뒤 파기한다고 화면에 고지했고(그래서 실제로 지워야 한다),
  --    결제 기록은 전자상거래법 §6이 **5년 보존**을 요구한다.
  --    cascade면 3년째에 법 위반이 된다.
  application_id uuid        references application(id) on delete set null,
  -- 🔴 그래서 회차를 **따로** 든다. 위 연결이 끊긴 뒤에도 「몇 차 매출인가」가 남는다.
  event_id       smallint    not null references event(id),

  kind           text        not null check (kind in ('입금','환불')),
  -- 🔴 방향은 `kind`가 정하고 금액은 **항상 양수**다. 음수를 섞으면 합계 질의마다
  --    부호 규칙을 기억해야 한다. 원 단위 정수 — 실수형은 39000.00000001을 만든다.
  amount         integer     not null check (amount > 0),
  occurred_at    timestamptz not null,          -- 통장에 찍힌 시각
  depositor_name text,
  note           text,
  -- 🔴 운영자 셋이 비밀번호를 공유하므로 쿠키로는 누가 눌렀는지 알 수 없다.
  recorded_by    text        not null,
  created_at     timestamptz not null default now()
);
create index money_application on money (application_id);
create index money_event       on money (event_id, occurred_at);

-- ═══ 7. notification_template · 알림톡 문구 ════════════════════
-- 🔴 문구를 DB에 두는 이유(결정 9) — 대표 검토와 카카오 심사로 문구는 **반드시** 바뀐다.
--    코드 상수로 두면 글자 하나 고칠 때마다 배포가 필요하다.
create table notification_template (
  id            text        primary key,        -- 운영자가 붙인 코드
  label         text        not null,           -- 목록에 보이는 이름
  body          text        not null,           -- `#{이름}` 같은 변수 자리를 포함한 문구
  channel       text        not null default 'alimtalk'
                  check (channel in ('alimtalk','sms','email')),
  when_hint     text,                           -- 「신청 직후」 — 화면 정렬·추천용
  -- 🔴 **참인 행은 하나뿐이다** — 신청 직후 입금 안내. 나머지 여덟은 운영자가 고른다.
  auto_send     boolean     not null default false,
  template_code text,                           -- 심사 통과 후 받는 뿌리오 templatecode
  approval      text        not null default 'REG'
                  check (approval in ('REG','REQ','APR','REJ')),
  -- 🔴 템플릿에 버튼이 있으면 **발송 요청에도 같은 버튼을 넣어야** 뿌리오가 받는다.
  buttons       jsonb,
  -- 🔴 대체문자 문구. 알림톡이 실패하면 이게 나가는데 **90바이트**뿐이라 본문을
  --    그대로 못 쓴다. 자동으로 자르면 문장 중간에서 끊긴다 — 사람이 짧게 따로 쓴다.
  sms_body      text,
  sort_order    smallint    not null default 0,
  active        boolean     not null default true,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ═══ 8. notification · 발송 기록 ═══════════════════════════════
create table notification (
  -- 🔴 **이 id가 곧 뿌리오에 보내는 `refkey`다.** 웹훅이 그대로 돌려주므로 짝이 맞는다.
  id             uuid        primary key default gen_random_uuid(),
  -- ⚠️ money와 달리 **cascade다.** 발송 기록에는 문구 전문(=이름이 박힌 본문)이 들어
  --    있어 그 자체가 개인정보다. 5년 보존 의무가 걸린 것은 돈이지 안내가 아니므로,
  --    3년 파기 때 사람과 함께 사라지는 쪽이 맞다.
  application_id uuid        not null references application(id) on delete cascade,
  template_id    text        references notification_template(id),
  channel        text        not null default 'alimtalk',

  -- 🔴 **그때 보낸 문구를 복사해 둔다.** 템플릿을 나중에 고쳐도 과거 기록이 따라
  --    바뀌면 안 된다 — 분쟁이 나면 「무엇을 보냈다고 주장하는지」가 통째로 사라진다.
  body           text        not null,

  -- 🔴 **접수와 도달을 한 칸에 뭉치지 않는다.** 동기 응답의 `code: 1000`은 「접수됨」이지
  --    「손님이 받았다」가 아니다. 실제 도달은 웹훅(`RESULT: 4100`)으로 따로 온다.
  --    접수는 됐는데 도달이 안 된 경우가 실제로 있고, 그때 운영자가 봐야 하는 것은
  --    「보냈다」가 아니라 **「안 닿았다」**다.
  accept_code    text,                          -- 동기 응답 code
  accepted_at    timestamptz,
  message_key    text,                          -- 뿌리오가 준 것. 웹훅 중복 방지용
  result_code    text,                          -- 웹훅 RESULT
  delivered_at   timestamptz,

  -- 🔴 문자로 대체 발송된 것도 **손님이 받았으므로 성공으로 센다.** 따로 구분해 두는
  --    이유는 버튼이 통째로 사라진 채 갔다는 뜻이라서다.
  status         text        not null default '대기'
                    check (status in ('대기','성공','실패','문자대체')),
  sent_by        text,                          -- 'system' 또는 운영자 이름
  created_at     timestamptz not null default now()
);
create index notification_application on notification (application_id, created_at);
-- 웹훅이 같은 결과를 두 번 줘도 한 번만 반영되게 한다.
create unique index notification_message_key_uq on notification (message_key)
  where message_key is not null;
-- 「보내다 실패한 것」 목록이 타는 길이다.
create index notification_failed on notification (created_at) where status = '실패';

-- ═══ 9. event_log · 조작 로그 ══════════════════════════════════
-- 🔴 분쟁이 생기면 이것만이 근거다. 상태를 바꾼 조작마다 누가·언제·무엇을 남긴다.
--    ⚠️ 표 이름이 `event`(회차)와 비슷하지만 전혀 다른 것이다 — 회차는 `event`.
create table event_log (
  id             bigserial   primary key,
  application_id uuid        references application(id) on delete cascade,
  kind           text        not null,          -- '입금확인' · '취소' · '화면고정' …
  -- 🔴 **필수다.** 운영자 셋이 비밀번호를 공유해 쿠키로는 알 수 없으므로,
  --    화면에서 고른 이름이 여기 남는 것 말고는 누가 눌렀는지 알 방법이 없다.
  actor          text        not null,
  meta           jsonb,
  at             timestamptz not null default now()
);
create index event_log_application on event_log (application_id, at);

-- ═══ 10. report · 리포트 ═══════════════════════════════════════
-- 만드는 기능은 범위 밖이다(스펙 Out of Scope). 만든 파일을 올리고 링크만 준다.
create table report (
  id             bigserial   primary key,
  application_id uuid        not null unique references application(id) on delete cascade,
  pdf_url        text        not null,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- ═══ 11. purge_log · 파기 기록 ═════════════════════════════════
-- 🔴 **여기에 개인정보를 적지 않는다.** 「누구를 지웠다」를 남기려고 이름이나 연락처를
--    적으면 파기 기록 자체가 새로운 보관이 된다. 규칙 이름과 대상 id만 남긴다.
create table purge_log (
  id         bigserial   primary key,
  rule       text        not null,              -- '신원3년' · '주관식3년' …
  subject_id uuid        not null,              -- 지운 대상의 id (이름·연락처 금지)
  purged_at  timestamptz not null default now()
);
create index purge_log_rule on purge_log (rule, purged_at);

-- ═══ 12. updated_at 자동 갱신 ══════════════════════════════════
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applicant_touch before update on applicant
  for each row execute function touch_updated_at();
create trigger application_touch before update on application
  for each row execute function touch_updated_at();
create trigger notification_template_touch before update on notification_template
  for each row execute function touch_updated_at();
