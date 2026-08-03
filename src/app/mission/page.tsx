import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { EVENT_CTA_LABEL, EVENT_HREF, SITE } from "@/lib/site";
import s from "./mission.module.css";

export const metadata: Metadata = {
  title: "미션",
  description:
    "사람들이 서로를 더 깊이 이해하도록 대화를 설계한다. 한결의 미션과 비전, 그리고 '결'이라는 이름의 뜻.",
};

/* ─────────────────────────────────────────────────────────────
   이 페이지의 모든 카피는 브랜드 철학 문서의 원문이다.
   요약·의역하지 말 것. 문장을 고쳐야 하면 문서를 먼저 고친다.
   ───────────────────────────────────────────────────────────── */

/** §5.1 단어별 해설 — 미션 문장을 여섯 단어로 쪼갠다. */
const WORDS: { word: string; why: ReactNode; excludes: string }[] = [
  {
    word: "사람들이",
    why: (
      <>
        남녀가 아니다. 소개팅은 첫 시장일 뿐 — 팀·가족·교육으로 확장 가능한
        여지를 이름에 남긴다
      </>
    ),
    excludes: "“미혼 남녀가”",
  },
  {
    word: "서로를",
    why: (
      <>한 방향이 아니다. 평가받는 사람과 평가하는 사람을 나누지 않는다</>
    ),
    excludes: "“이성을”",
  },
  {
    word: "더 깊이",
    why: (
      <>
        더 많이가 아니다. 우리는 처리량을 늘리지 않고{" "}
        <strong>깊이를 늘린다</strong>
      </>
    ),
    excludes: "“더 많은 사람을”",
  },
  {
    word: "이해하도록",
    why: <>매칭이 아니다. 이해는 매칭보다 크고, 매칭이 실패해도 남는다</>,
    excludes: "“매칭되도록”",
  },
  {
    word: "대화를",
    why: (
      <>
        만남이 아니다. 우리의 제품은 사람이 아니라 <strong>대화</strong>
      </>
    ),
    excludes: "“만남을”",
  },
  {
    word: "설계한다",
    why: (
      <>
        주선이 아니다. 우리는 자리를 만드는 게 아니라{" "}
        <strong>구조를 만든다</strong>
      </>
    ),
    excludes: "“주선한다”",
  },
];

/** §5.2 미션이 아닌 것 — 이 페이지에서 가장 중요한 네 문장. */
const NOTS: { what: string; why: string }[] = [
  { what: "커플을 많이 만드는 것", why: "그건 결과 지표이지 목적이 아니다" },
  { what: "외로움을 없애는 것", why: "우리가 감당할 수 없는 약속이다" },
  { what: "좋은 사람을 찾아주는 것", why: "‘좋은’을 우리가 정의할 수 없다" },
  {
    what: "결혼시키는 것",
    why: "결혼정보업의 언어이며, 우리의 사업 범위가 아니다",
  },
];

/** §6 비전 3단계. 원문 표의 '실패의 신호' 열은 내부 판단 기준이라 싣지 않는다. */
const PHASES: {
  name: string;
  tag: string;
  when: string;
  goal: ReactNode;
  win: ReactNode;
}[] = [
  {
    name: "Phase 1",
    tag: "증명",
    when: "2026",
    goal: <>오프라인 실험으로 핵심 가설 검증</>,
    win: (
      <>
        {"“글로 맞춘 결이 실제로도 맞는다”는 "}
        <strong>데이터</strong> 확보
      </>
    ),
  },
  {
    name: "Phase 2",
    tag: "확장",
    when: "2027~2028",
    goal: <>검증된 것만 앱으로 구현 + 안전 만남 인프라</>,
    win: (
      <>
        매칭 → 안전한 첫 만남까지 <strong>하나의 흐름</strong>으로 작동
      </>
    ),
  },
  {
    name: "Phase 3",
    tag: "표준",
    when: "2029~",
    goal: (
      <>
        대화 설계 시스템의 <strong>B2B·비연애 영역 확장</strong>
      </>
    ),
    win: <>{"“한결식 질문”이 소개팅 밖에서 쓰임"}</>,
  },
];

/** §4.5 이름의 이중 의미. */
const LAYERS: {
  floor: string;
  split: ReactNode;
  meaning: string;
  role: string;
}[] = [
  {
    floor: "1층",
    split: (
      <>
        한(같은) + 결(성향·기질·무늬)
      </>
    ),
    meaning: "“같은 결의 사람”",
    role: "시작 — 매칭",
  },
  {
    floor: "2층",
    split: <>한결같다</>,
    meaning: "변함없는·꾸준한·진실한",
    role: "지속 — 관계",
  },
];

/** §4.6 슬로건 해부 — 한 문장에 '결'이 세 번, 뜻은 세 번 다 다르다. */
const ANATOMY: {
  idx: string;
  before: string;
  after: string;
  meaning: string;
  fn: string;
}[] = [
  {
    idx: "①",
    before: "",
    after: "국에는",
    meaning: "結局 — 마침내, 시간이 지나 보니",
    fn: "시간의 검증",
  },
  {
    idx: "②",
    before: "",
    after: "이더라",
    meaning: "성향·기질·무늬",
    fn: "핵심 주장",
  },
  {
    idx: "③",
    before: "한",
    after: "같이",
    meaning: "브랜드명 + 변함없이",
    fn: "지속 + 서명",
  },
];

/** §7 브랜드 선언문. 첫 연은 아래 섹션의 제목으로 올라간다 — 문장은 하나도 빠지지 않는다. */
const MANIFESTO: string[][] = [
  ["우리는 당신이 무엇을 골랐는지 묻지 않는다.", "왜 그것을 골랐는지 묻는다."],
  ["같은 답은 대화의 시작일 뿐이다.", "같은 이유는 관계의 이유가 된다."],
  [
    "우리는 당신을 메뉴판에 올리지 않는다.",
    "매력 세 가지를 적어내라고 하지 않는다.",
    "당신은 상품이 아니라 사람이고,",
    "사람은 세 줄로 요약되지 않는다.",
  ],
  [
    "우리는 더 많은 사람을 만나게 하지 않는다.",
    "더 깊이 만나게 한다.",
    "열 명을 스쳐 지나가는 것보다",
    "한 사람을 제대로 아는 것이 어렵고, 또 귀하다.",
  ],
  [
    "우리는 완벽한 상대를 약속하지 않는다.",
    "그런 약속은 과학이 지지하지 않고,",
    "지키지 못할 약속은 하지 않는 것이 우리의 방식이다.",
  ],
  [
    "우리가 약속하는 것은 좋은 시작이다.",
    "마찰이 적은 시작.",
    "서로를 오해하지 않아도 되는 시작.",
    "그 다음은 두 사람이 만든다.",
  ],
  ["나무의 결은 바꿀 수 없다.", "결을 거스르면 찢어지고,", "결을 따르면 매끄럽다."],
  ["사람도 그렇다."],
  [
    "맞추려 애쓰지 않아도 되는 사람이 있다.",
    "우리는 그 사람을 찾는 방법을 설계한다.",
  ],
];

export default function MissionPage() {
  return (
    <>
      {/* ── 1. 미션 ─────────────────────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            한결의 미션
          </span>
          <h1 className="display" data-reveal>
            사람들이 서로를 더 깊이 이해하도록
            <br />
            대화를 설계한다.
          </h1>

          {/* 컨테이너에는 data-reveal을 걸지 않는다 — 자식이 이미 각자 등장하므로
              겹치면 translateY가 두 번 쌓인다. */}
          <div className={`${s.stack} ${s.spaced}`}>
            <span className={s.miniLabel} data-reveal>
              단어별 해설
            </span>
            <ul className={`${s.words} stagger`}>
              {WORDS.map((w) => (
                <li key={w.word} className={`card ${s.wordCard}`} data-reveal>
                  {/* 표의 첫 칸이지 섹션 제목이 아니다 — h*를 쓰면 h1 아래
                      목차가 어긋난다. */}
                  <p className={s.wordTitle}>{w.word}</p>
                  <p className={s.wordWhy}>{w.why}</p>
                  <p className={s.wordExcl}>
                    <span className={s.miniLabel}>이 단어가 배제하는 것</span>
                    <span className={s.wordExclText}>{w.excludes}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 2. 미션이 아닌 것 ───────────────────────────────── */}
      <section className="band band--dark">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            미션이 아닌 것
          </span>
          <h2 className="display" data-reveal>
            철학을 이해했는지는
            <br />
            긍정문이 아니라 부정문에서 드러난다.
          </h2>

          <ul className={`${s.nots} stagger ${s.spaced}`}>
            {NOTS.map((n) => (
              <li key={n.what} className={s.not} data-reveal>
                <span className={s.notX} aria-hidden="true">
                  {"✕"}
                </span>
                <p className={s.notTitle}>{n.what}</p>
                <p className={s.notWhy}>{n.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 3. 비전 ─────────────────────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            한결의 비전
          </span>
          <h2 className="display" data-reveal>
            {"한국에서 ‘대화의 깊이’를"}
            <br />
            표준으로 만든 회사.
          </h2>
          <p className="lede" data-reveal>
            비전은 시간축 위에 놓일 때만 의미가 있다. 한결은 3단계로 간다.
          </p>

          <div className={`${s.phases} stagger ${s.spaced}`}>
            {PHASES.map((p) => (
              <div key={p.name} className={s.phase} data-reveal>
                <div className={s.phaseHead}>
                  <span className={s.phaseName}>{p.name}</span>
                  <span className={s.phaseTag}>{p.tag}</span>
                  <span className={s.phaseWhen}>{p.when}</span>
                </div>
                <div className={s.phaseBody}>
                  <p className={s.phaseGoal}>{p.goal}</p>
                  <p className={s.phaseWin}>
                    <span className={s.miniLabel}>성공의 정의</span>
                    <span className={s.phaseWinText}>{p.win}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className={s.echo} data-reveal>
            <span className={s.miniLabel}>10년 뒤 우리가 듣고 싶은 말</span>
            <p className={s.echoQuote}>
              {"“요즘은 어디서든 처음 만나면 한결식으로 물어보더라.”"}
            </p>
            <p className={s.echoNote}>
              브랜드가 <strong>동사나 형용사가 되는 것</strong> — 그것이 표준이
              되었다는 유일한 증거다.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. 왜 '결'인가 ──────────────────────────────────── */}
      <section className="band band--dark">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            {"왜 ‘결’인가"}
          </span>
          <h2 className="display" data-reveal>
            <span className={s.grainMark}>결</span>은 나무를 세로로 켰을 때
            <br />
            드러나는 무늬다.
          </h2>

          <div className={s.prose} data-reveal>
            <p>
              나무의 결은 바깥에서 붙인 장식이 아니다. 그 나무가 어떤 땅에서,
              어떤 바람을 맞으며, 몇 해를 자랐는지가 안쪽에 기록된 것이다. 결은{" "}
              <strong>살아온 시간의 흔적</strong>이고, 그래서{" "}
              <strong>바꿀 수 없다.</strong>
            </p>
            <p>
              목수는 결을 거스르지 않는다. 결을 거슬러 대패를 밀면 나무가
              찢어진다. 결을 따라 밀면 매끄럽게 깎인다. 같은 나무, 같은 대패,
              같은 힘인데 방향 하나로 결과가 갈린다.
            </p>
          </div>

          <p className={s.beat} data-reveal>
            사람도 그렇다.
          </p>

          <div className={s.stack} data-reveal>
            <p className="lede">
              {"한결에서 ‘결’은 다음과 같이 정의된다. 핵심은 답과 결의 분리다."}
            </p>
            <div className={s.def}>
              <span className={s.defTerm}>결(Grain)</span>
              <p className={s.defText}>
                어떤 선택을 할 때 그 사람이 무엇을 더 중요하게 여겼는가 — 선택의
                밑에 깔린 우선순위와 그 형성 과정.
              </p>
            </div>
          </div>

          <Link className={`link-arrow ${s.selfStart}`} href="/why" data-reveal>
            왜 가치관인가
          </Link>
        </div>
      </section>

      {/* ── 5. 이름과 슬로건 ────────────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            이름의 이중 의미
          </span>
          <h2 className="display" data-reveal>
            이름 하나가
            <br />
            시작과 지속을 모두 담는다.
          </h2>
          <p className="lede" data-reveal>
            {
              "‘한결’이라는 이름은 두 개의 뜻을 동시에 갖는다. 이것은 우연이 아니라 선택이다."
            }
          </p>

          <ul className={`${s.layers} stagger ${s.spaced}`}>
            {LAYERS.map((l) => (
              <li key={l.floor} className={`card ${s.layerCard}`} data-reveal>
                <span className={s.miniLabel}>{l.floor}</span>
                <p className={s.layerSplit}>{l.split}</p>
                <p className={s.layerMeaning}>{l.meaning}</p>
                <span className={s.roleChip}>{l.role}</span>
              </li>
            ))}
          </ul>

          <div className={`${s.stack} ${s.spaced}`} data-reveal>
            <span className={s.miniLabel}>슬로건</span>
            <p className={s.sloganBig}>
              {"“"}
              {SITE.slogan}
              {"”"}
            </p>
            <p className="lede">
              {
                "이 한 문장에 ‘결’이 세 번 나온다. 그리고 세 번 모두 다른 뜻이다."
              }
            </p>
            <ul className={s.anatomy}>
              {ANATOMY.map((a) => (
                <li key={a.idx} className={s.anaRow}>
                  <span className={s.anaIdx}>{a.idx}</span>
                  <span className={s.anaWord}>
                    {a.before}
                    <span className={s.grainMark}>결</span>
                    {a.after}
                  </span>
                  <span className={s.anaMeaning}>{a.meaning}</span>
                  <span className={s.anaFn}>{a.fn}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 6. 브랜드 선언문 ────────────────────────────────── */}
      <section className="band band--dark">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            한결 선언문
          </span>
          <h2 className="display" data-reveal>
            우리는 사람을 소개하지 않는다.
            <br />
            우리는 대화를 설계한다.
          </h2>

          <div className={`${s.manifesto} ${s.spaced}`} data-reveal>
            {MANIFESTO.map((stanza) => (
              <p key={stanza[0]} className={s.stanza}>
                {stanza.map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            ))}
            <p className={`${s.stanza} ${s.stanzaSign}`}>{SITE.slogan}.</p>
          </div>

          <Link
            className={`pill ${s.ctaPill} ${s.selfStart}`}
            href={EVENT_HREF}
            data-reveal
          >
            {EVENT_CTA_LABEL}
          </Link>
        </div>
      </section>
    </>
  );
}
