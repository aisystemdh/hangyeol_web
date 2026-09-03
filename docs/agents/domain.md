# Domain Docs

엔지니어링 스킬이 코드를 탐색하기 **전에** 이 저장소의 도메인 문서를 어떻게 읽어야 하는지 정한 규칙.

## 탐색 전에 읽을 것

- 저장소 루트의 **`CONTEXT.md`** — 도메인 용어집. (아직 없다.)
- **`docs/decisions/`** — 지금 손대려는 영역과 닿는 결정 문서를 읽는다. 한 결정 한 파일.
  ⚠️ 스킬 템플릿의 기본값은 `docs/adr/`지만 이 저장소는 **`docs/decisions/`**를 그 용도로 이미 쓰고 있다
  (`CLAUDE.md`에 선언돼 있음). `docs/adr/`를 새로 만들지 말 것 — 결정 폴더가 둘이 되면
  다음 세션이 어느 쪽에 써야 할지 알 수 없다.
- **`docs/architecture.md`** — 코드 전수 지도(테이블·API·화면·하드코딩·위험).
  구조를 알아야 할 때는 코드를 훑기 전에 여기부터 본다.

이 중 없는 파일이 있으면 **조용히 넘어간다.** 없다고 지적하지도, 미리 만들라고 권하지도 않는다.
`/domain-modeling`(→ `/grill-with-docs`·`/improve-codebase-architecture`에서 이어짐)이
용어나 결정이 **실제로 정해지는 순간에** 게으르게 만든다.

## 파일 구조

단일 컨텍스트 저장소다(모노레포가 아니다 — `workspaces`·`pnpm-workspace.yaml`·`packages/` 전부 없음).

```
/
├── CLAUDE.md              ← 규칙과 되돌리면 깨지는 것들
├── CONTEXT.md             ← 도메인 용어집 (아직 없음, 필요해질 때 생성)
├── docs/
│   ├── architecture.md    ← 코드 전수 지도
│   ├── decisions/         ← 설계 결정 (ADR 자리)
│   ├── handoff/           ← 세션 핸드오프
│   └── agents/            ← 이 파일들 (스킬 설정)
└── src/
```

기획 정본은 이 저장소가 아니라 지식베이스 레포(`econoai0119-tech/hangyeol-knowledge-base`,
로컬 `~/projects/hangyeol-knowledge-base`)에 있다. 필요한 문서만 그때 읽는다.

## 용어집의 어휘를 쓴다

산출물이 도메인 개념을 이름으로 부를 때(이슈 제목·리팩터 제안·가설·테스트 이름)
`CONTEXT.md`에 정의된 표현을 쓴다. 용어집이 일부러 피한 동의어로 흘러가지 않는다.
`CONTEXT.md`가 없는 동안은 `CLAUDE.md`와 `docs/architecture.md`의 표현을 정본으로 삼는다.

필요한 개념이 아직 용어집에 없으면 그건 신호다 — 프로젝트가 쓰지 않는 언어를 발명하는 중이거나
(다시 생각한다), 진짜 빈칸이거나(`/domain-modeling`이 채우도록 적어둔다).

## 결정과 어긋나면 드러낸다

산출물이 `docs/decisions/`의 기존 결정과 모순되면 조용히 덮어쓰지 말고 명시한다:

> _`docs/decisions/000-owner-brief-2026-09-02.txt`의 결정과 어긋나지만, 다시 열어볼 이유는…_

`CLAUDE.md`의 🔴 표시 항목은 실측으로 확인된 사고 이력이다. 어긋나는 제안을 할 때는
그 주석에 적힌 근거를 먼저 읽고, 무엇이 달라졌는지 함께 말한다.
