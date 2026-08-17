import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import BackToDialog from "@/components/BackToDialog";
import StickyBar from "@/components/StickyBar";
import { EVENT_CTA_LABEL, EVENT_HREF, SITE } from "@/lib/site";
import s from "./mission.module.css";

export const metadata: Metadata = {
  title: "목표",
  description:
    "사람들이 서로를 더 깊이 이해하도록 대화를 설계한다. 한결의 목표와 비전, 그리고 '결'이라는 이름의 뜻.",
  alternates: { canonical: "/mission" },
};

/* ─────────────────────────────────────────────────────────────
   카피는 브랜드 철학 문서를 손님 언어(존댓말)로 옮긴 것이다.
   사실·숫자·출처·인용은 원문 그대로 간다. 요약·의역은 금지다.

   ⚠️ 용어: 화면에 나가는 말은 "미션"이 아니라 **"목표"** 다.
      경로(/mission)와 파일 이름은 그대로 두었다 — 이미 공유된 링크가 깨진다.

   ⚠️ 선언문체로 남겨둔 두 곳 — 존댓말로 바꾸지 말 것.
      1) h1의 목표 문장 — 아래 WORDS가 이 문장을 여섯 단어로 쪼개 분석한다.
         "설계한다"를 "설계합니다"로 바꾸면 WORDS의 word 값과 어긋난다.
      2) echoQuote — 10년 뒤 제3자가 할 말을 옮긴 인용이다.
   ───────────────────────────────────────────────────────────── */

/** §5.1 단어별 해설 — 목표 문장을 여섯 단어로 쪼갠다. */
const WORDS: { word: string; why: ReactNode }[] = [
  {
    word: "사람들이",
    why: (
      <>
        남녀가 아닙니다. 소개팅은 첫 시장일 뿐, 팀·가족·교육으로 확장할 여지를
        이름에 남겼습니다
      </>
    ),
  },
  {
    word: "서로를",
    why: (
      <>한 방향이 아닙니다. 평가받는 사람과 평가하는 사람을 나누지 않습니다</>
    ),
  },
  {
    word: "더 깊이",
    why: (
      <>
        더 많이가 아닙니다. 처리량을 늘리지 않고 <strong>깊이를 늘립니다</strong>
      </>
    ),
  },
  {
    word: "이해하도록",
    why: (
      <>매칭이 아닙니다. 이해는 매칭보다 크고, 매칭이 실패해도 남습니다</>
    ),
  },
  {
    word: "대화를",
    why: (
      <>
        만남이 아닙니다. 저희의 제품은 사람이 아니라 <strong>대화</strong>입니다
      </>
    ),
  },
  {
    word: "설계한다",
    why: (
      <>
        주선이 아닙니다. 자리를 만드는 게 아니라 <strong>구조를 만듭니다</strong>
      </>
    ),
  },
];

/**
 * §5.2 목표가 아닌 것 — 이 페이지에서 가장 중요한 네 문장.
 *
 * 3번은 원칙 3("사람을 상품으로 전시하지 않는다")에서 가져왔다 —
 * "사람은 세 줄로 요약되지 않습니다"는 삭제된 선언문에 있던 문장을 살려 온 것이다.
 * 4번의 근거였던 "약속은 지킬 수 있는 만큼만 한다"는 웹의 원칙 목록에서 빠졌지만,
 * 브랜드 문서에는 그대로 있고 이 문장 자체는 유효하다.
 */
const NOTS: { what: string; why: string }[] = [
  { what: "아무나 만나게 하는 것", why: "수를 늘리면 대화가 얕아집니다" },
  {
    what: "주선에서 끝이 나는 것",
    why: "만남은 시작일 뿐, 그 다음까지가 저희 몫입니다",
  },
  {
    what: "조건으로 사람을 줄 세우는 것",
    why: "사람은 세 줄로 요약되지 않습니다",
  },
  {
    what: "완벽한 인연을 약속하는 것",
    why: "지킬 수 없는 약속입니다. 저희가 파는 것은 좋은 시작입니다",
  },
];

/**
 * §6 비전 3단계.
 * ⚠️ "실험"이라는 단어를 쓰지 않는다 — 읽는 사람이 자신을 실험 대상으로 느낀다.
 *    원문 표의 '실패의 신호'와 '성공의 정의' 열도 싣지 않는다(내부 판단 기준이다).
 *    goal은 표의 칸이라 명사구 그대로 둔다.
 */
const PHASES: { name: string; tag: string; when: string; goal: ReactNode }[] = [
  {
    name: "Phase 1",
    tag: "증명",
    when: "2026",
    goal: <>오프라인 모임을 통해 대화 설계 시스템 도입</>,
  },
  {
    name: "Phase 2",
    tag: "확장",
    when: "2027~2028",
    goal: <>검증된 것만 앱으로 구현 + 안전 만남 인프라</>,
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
  },
];

/** §4.5 이름의 이중 의미. 표의 칸이라 명사구 그대로 둔다. */
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

export default function MissionPage() {
  return (
    <div style={{ overflowX: "hidden", paddingBottom: 88 }}>
      {/* ── 1. 목표 ─────────────────────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${s.stack}`}>
          {/* 홈 대화 도중 온 방문자에게만 보인다(마운트 후 sessionStorage 판정) */}
          <BackToDialog />
          <span className="eyebrow" data-reveal>
            한결의 목표
          </span>
          {/* ⚠️ 아래 WORDS가 이 문장을 단어 단위로 분해한다. 말투를 바꾸지 말 것. */}
          <h1 className="display display--page" data-reveal>
            사람들이 서로를 더 깊이 이해하도록
            <br />
            대화를 설계한다.
          </h1>

          <div className="tldr" data-reveal>
            <p className={s.tldrLine}>
              저희 대화 시스템 안에 저절로 녹아들고 서로를 알게 됩니다.
            </p>
          </div>

          {/* 컨테이너에는 data-reveal을 걸지 않는다 — 자식이 이미 각자 등장하므로
              겹치면 translateY가 두 번 쌓인다. */}
          <details className={`rules ${s.spaced}`}>
            <summary>
              한결의 시선 보기<span className="plus">+</span>
            </summary>
            <div data-answer>
              <ul className={`${s.words} stagger ${s.spaced}`}>
                {WORDS.map((w) => (
                  <li key={w.word} className={`card ${s.wordCard}`} data-reveal>
                    {/* 표의 첫 칸이지 섹션 제목이 아니다 — h*를 쓰면 h1 아래
                        목차가 어긋난다. */}
                    <p className={s.wordTitle}>{w.word}</p>
                    <p className={s.wordWhy}>{w.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </section>

      {/* ── 2. 목표가 아닌 것 ───────────────────────────────── */}
      <section className="band band--dark">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            목표가 아닌 것
          </span>
          <h2 className="display" data-reveal>
            이런 건 한결의 목적이 아닙니다.
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
                </div>
              </div>
            ))}
          </div>

          <div className={s.echo} data-reveal>
            <span className={s.miniLabel}>10년 뒤 한결이 듣고 싶은 말</span>
            {/* ⚠️ 제3자의 발화를 옮긴 인용이다. 존댓말로 바꾸지 말 것. */}
            <p className={s.echoQuote}>
              {"“요즘은 어디서든 처음 만나면 한결식으로 물어보더라.”"}
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
            드러나는 무늬입니다.
          </h2>

          <div className={s.prose} data-reveal>
            <p>
              나무의 결은 바깥에서 붙인 장식이 아닙니다. 그 나무가 어떤 땅에서,
              어떤 바람을 맞으며, 몇 해를 자랐는지가 안쪽에 기록된 것입니다. 결은{" "}
              <strong>살아온 시간의 흔적</strong>이고, 그래서{" "}
              <strong>바꿀 수 없습니다.</strong>
            </p>
            <p>
              목수는 결을 거스르지 않습니다. 결을 거슬러 대패를 밀면 나무가
              찢어집니다. 결을 따라 밀면 매끄럽게 깎입니다. 같은 나무, 같은 대패,
              같은 힘인데 방향 하나로 결과가 갈립니다.
            </p>
          </div>

          <p className={s.beat} data-reveal>
            사람도 그렇습니다.
          </p>

          <div className={s.stack} data-reveal>
            <p className="lede">
              {"한결에서 ‘결’은 다음과 같이 정의됩니다. 핵심은 답과 결의 분리입니다."}
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

      {/* ── 5. 이름과 슬로건 (마지막 섹션) ──────────────────────
          선언문 섹션을 걷어내면서 CTA를 이 아래로 옮겨 왔다 —
          없으면 이 페이지의 전환 경로가 하단 고정 바 하나뿐이 된다. */}
      <section className="band">
        <div className={`shell stagger ${s.stack}`}>
          <span className="eyebrow" data-reveal>
            이름의 이중 의미
          </span>
          <h2 className="display" data-reveal>
            시작과 지속을 모두 담습니다.
          </h2>
          <p className="lede" data-reveal>
            {"‘한결’이라는 이름은 두 개의 뜻을 동시에 갖습니다."}
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

          <Link
            className={`pill ${s.ctaPill} ${s.selfStart} ${s.spaced}`}
            href={EVENT_HREF}
            data-reveal
          >
            {EVENT_CTA_LABEL}
          </Link>
        </div>
      </section>

      <StickyBar href={EVENT_HREF} />
    </div>
  );
}
