# Issue tracker: GitHub

이 저장소의 이슈와 스펙은 **GitHub Issues**(`aisystemdh/hangyeol_web`)에 있다.
모든 조작은 `gh` CLI로 한다 — 클론 안에서 실행하면 `gh`가 `git remote`를 보고 저장소를 스스로 알아낸다.

작업 단위는 이슈 하나, 브랜치는 `동현-<이슈번호>-<제목>` → PR → `main`이다(`CLAUDE.md` 참고).

## Conventions

- **이슈 만들기**: `gh issue create --title "..." --body "..."`. 본문이 여러 줄이면 heredoc을 쓴다.
- **이슈 읽기**: `gh issue view <number> --comments`. 댓글은 `jq`로 걸러 읽고 라벨도 함께 가져온다.
- **이슈 목록**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
  — 필요하면 `--label`·`--state`로 좁힌다.
- **댓글**: `gh issue comment <number> --body "..."`
- **라벨 붙이기 / 떼기**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **닫기**: `gh issue close <number> --comment "..."`

라벨 문자열은 이 파일에 적지 않는다 — `docs/agents/triage-labels.md` 한 곳에서 온다.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(외부 PR을 기능 요청으로 취급하는 저장소라면 `yes`로 바꾼다.
`/triage`가 이 플래그를 읽는다. 지금은 기여자가 소유자 한 명뿐이라 off다.)_

`yes`일 때는 PR도 이슈와 같은 라벨·상태를 타고, `gh pr` 쪽 명령을 쓴다:

- **PR 읽기**: `gh pr view <number> --comments`, 변경 내용은 `gh pr diff <number>`.
- **triage 대상 외부 PR 목록**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`
  뒤에 `authorAssociation`이 `CONTRIBUTOR`·`FIRST_TIME_CONTRIBUTOR`·`NONE`인 것만 남긴다
  (`OWNER`·`MEMBER`·`COLLABORATOR`는 버린다).
- **댓글 / 라벨 / 닫기**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub는 이슈와 PR이 **번호 공간을 공유**한다. 그래서 맨 `#42`는 둘 중 어느 것일 수도 있다 —
`gh pr view 42`로 먼저 시도하고 실패하면 `gh issue view 42`로 넘어간다.

## 스킬이 "publish to the issue tracker"라고 할 때

GitHub 이슈를 만든다.

## 스킬이 "fetch the relevant ticket"이라고 할 때

`gh issue view <number> --comments`를 돌린다.

## Wayfinding operations

`/wayfinder`가 쓴다. **지도(map)**는 이슈 하나이고, **자식(child)** 이슈들이 티켓이다.

- **Map**: `wayfinder:map` 라벨이 붙은 이슈 하나. 본문에 Notes / Decisions-so-far / Fog를 담는다.
  `gh issue create --label wayfinder:map`.
- **Child ticket**: 지도에 GitHub sub-issue로 연결된 이슈(sub-issues 엔드포인트에 `gh api`).
  sub-issues가 꺼져 있으면 지도 본문의 체크리스트에 자식을 넣고 자식 본문 맨 위에 `Part of #<map>`을 적는다.
  라벨은 `wayfinder:<type>`(`research`/`prototype`/`grilling`/`task`). 착수하면 담당자를 지정한다.
- **Blocking**: GitHub **native issue dependencies**를 쓴다 — UI에 보이는 정본이다.
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
  🔴 `<blocker-db-id>`는 막는 쪽 이슈의 **숫자 database id**다(`gh api repos/<owner>/<repo>/issues/<n> --jq .id`).
  `#number`도 `node_id`도 아니다. GitHub는 `issue_dependencies_summary.blocked_by`로 **열려 있는 블로커 수만** 알려준다.
  dependencies를 못 쓰면 자식 본문 맨 위 `Blocked by: #<n>, #<n>` 줄로 대체한다.
  블로커가 전부 닫히면 그 티켓은 풀린 것이다.
- **Frontier query**: 지도의 열린 자식들을 나열하고(`gh issue list --state open`, 지도의 sub-issue/체크리스트로 한정),
  열린 블로커가 있거나(`issue_dependencies_summary.blocked_by > 0`) 담당자가 이미 있는 것을 버린다.
  남은 것 중 지도에 적힌 순서가 앞인 것이 이긴다.
- **Claim**: `gh issue edit <n> --add-assignee @me` — 세션의 첫 쓰기 작업.
- **Resolve**: `gh issue comment <n> --body "<answer>"` → `gh issue close <n>` →
  지도의 Decisions-so-far에 컨텍스트 포인터(gist + 링크)를 덧붙인다.
