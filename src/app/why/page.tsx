import type { Metadata } from "next";
import Link from "next/link";
import BackToDialog from "@/components/BackToDialog";
import StickyBar from "@/components/StickyBar";
import { EVENT_CTA_LABEL, EVENT_HREF } from "@/lib/site";
import s from "./why.module.css";

export const metadata: Metadata = {
  title: "왜 가치관인가",
  description:
    "기존의 만남 서비스와 방향이 다른 이유. 네 가지 구조적 결함과, 그 대안을 뒷받침하는 세 편의 연구.",
  alternates: { canonical: "/why" },
};

/* ─────────────────────────────────────────────────────────────
   카피는 브랜드 철학 문서를 손님 언어(존댓말)로 옮긴 것이다.
   사실·숫자·출처·인용은 원문 그대로 간다.

   ⚠️ 선언문체로 남겨둔 것들 — 존댓말로 바꾸지 말 것.
      · 결함 제목 4개("~한다") — 기존 포맷을 서술하는 말이라 존댓말로 바꾸면
        한결이 그렇게 한다는 뜻이 된다.
      · <dl className={s.facts}>의 factDesc — 표의 칸이라 명사구로 짧게 유지한다.
      · 큰따옴표 안의 인용문 — 남의 말이거나 원문 인용이다.

   ⚠️ h1에 특정 업종·서비스 이름을 넣지 말 것. CLAUDE.md의 금지어("소개팅앱")이자
      §2.1의 경쟁사 폄하 금지에 걸린다. 잠재 고객 상당수가 그 서비스 이용자라
      전략적으로도 자해다. "기존의 만남 서비스"처럼 범주로만 가리킨다.
   ───────────────────────────────────────────────────────────── */

export default function WhyPage() {
  return (
    <div style={{ overflowX: "hidden", paddingBottom: 88 }}>
      {/* ── 1. 문제를 정확히 겨누기 (흰) ───────────────────── */}
      <section className="band" aria-labelledby="why-aim">
        <div className={`shell stagger ${s.head}`}>
          {/* 홈 대화 도중 온 방문자에게만 보인다(마운트 후 sessionStorage 판정) */}
          <BackToDialog />
          <span className="eyebrow" data-reveal>
            왜 가치관인가
          </span>
          <h1 className={`display display--page ${s.title}`} id="why-aim" data-reveal>
            기존의 만남 서비스와는
            <br />
            방향이 다릅니다.
          </h1>
          <div className={s.prose} data-reveal>
            <p className="lede">
              기존 포맷은 나쁘게 만들어진 게 아니라 다른 목적에 맞게 잘
              만들어졌습니다. 그 목적은 “제한된 시간에 최대한 많은 이성을 만나게
              한다”입니다. 하지만 저희는 목적 자체가 다릅니다.
            </p>
            <p className={s.big}>
              {"“많이”가 아닌 “깊게”입니다."}
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. 네 가지 구조적 결함 (검정) ──────────────────── */}
      <section className="band band--dark" aria-labelledby="why-flaws">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            문제
          </span>
          <h2 className={`display ${s.title}`} id="why-flaws" data-reveal>
            기존의 시스템으로는
            <br />왜 아쉬움이 남았을까요?
          </h2>

          <ol className={`stagger ${s.list}`}>
            {/* 결함 1 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>01</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>사람을 스펙 카드로 환원한다</h3>
                <p className={s.text}>
                  MBTI·나이·직업 같은 명사형 정보는 사람을 분류하게 해줄 뿐,
                  이해하게 해주지는 않습니다.
                </p>
                <table className={s.contrast}>
                  <thead>
                    <tr>
                      <th scope="col">이 카드가 알려주는 것</th>
                      <th scope="col">이 카드가 절대 알려주지 않는 것</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>그가 INFP라는 것</td>
                      <td>
                        그가 갈등 상황에서 먼저 말을 거는지, 하루 두는지
                      </td>
                    </tr>
                    <tr>
                      <td>그가 등산을 좋아한다는 것</td>
                      <td>그가 약속을 어긴 친구를 어떻게 대하는지</td>
                    </tr>
                    <tr>
                      <td>그가 32세 마케터라는 것</td>
                      <td>그가 안정과 도전 중 무엇에 더 겁을 내는지</td>
                    </tr>
                  </tbody>
                </table>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    모든 문항에 &ldquo;왜 그렇게 생각했는지&rdquo; Follow-up을 붙입니다 — 선택이
                    아니라 선택 + 이유를 봅니다.
                  </p>
                </div>
              </div>
            </li>

            {/* 결함 2 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>02</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>대화를 스몰토크로 설계한다</h3>
                <p className={s.text}>
                  가벼운 질문은 첫 30초엔 훌륭하지만, 그 다음이 없으면 남는 건
                  정보 교환이지 이해가 아닙니다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    사전에 10개 주제로 답변을 받아, 당일 대화가 처음부터 그
                    답변에서 시작합니다.
                  </p>
                </div>
              </div>
            </li>

            {/* 결함 3 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>03</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>선택을 공개적으로 만든다</h3>
                <p className={s.text}>
                  누구를 선택했는지가 드러나는 순간, 참가자는 거절의 두려움을
                  안고 대화하게 됩니다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    결1~결20 익명 배정, 선택 결과는 원칙적으로 비공개입니다.
                  </p>
                </div>
              </div>
            </li>

            {/* 결함 4 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>04</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>만남 이후가 없다</h3>
                <p className={s.text}>
                  행사가 끝나면 관계는 참가자 개인의 몫으로 남고, 대부분의
                  포맷엔 그 다음이 없습니다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    {/* ⚠️ "성향 리포트"로 되돌리지 말 것 — 리포트 본문이
                        "성향을 나누는 게 아니라 왜 그렇게 골랐는지"라고 말한다.
                        상품명이 실물을 부정하면 표시광고 문제가 된다. */}
                    닷새 뒤 그날의 기록을 보내드리고, 관계를 잇는 것까지 설계에
                    포함합니다.
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 3. 세 개의 랜드마크 연구 (흰, 마지막 섹션) ─────────
          "정직한 고백" 섹션을 걷어내면서 CTA를 이 아래로 옮겨 왔다 —
          없으면 이 페이지의 전환 경로가 하단 고정 바 하나뿐이 된다. */}
      <section className="band" aria-labelledby="why-research">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            근거
          </span>
          <h2 className={`display ${s.title}`} id="why-research" data-reveal>
            한결의 시스템은
            <br />
            근거에 기반합니다.
          </h2>
          <p className="lede" data-reveal>
            한결의 매칭 철학은 세 편의 종단·대규모 연구 위에 서 있습니다.
          </p>

          <ol className={`stagger ${s.list}`}>
            {/* 연구 1 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>01</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>Gottman — 40년 종단연구</h3>
                {/* ⚠️ "이혼 여부를 90% 이상 정확도로 예측" 문장을 되살리지 말 것.
                    재검증에 실패한 수치이고 사내 기준이 인용을 금지했다.
                    이 항목이 실제로 뒷받침하는 것은 예측 정확도가 아니라
                    "관계가 무너질 때 반복되는 패턴"이므로 그것만 남긴다. */}
                <p className={s.text}>
                  수십 년간 부부의 대화를 관찰해, 관계가 무너질 때 반복되는
                  패턴을 정리했습니다.
                </p>
                <dl className={s.facts}>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>네 기수</dt>
                    <dd className={s.factDesc}>
                      비판 · 경멸 · 방어 · 담쌓기 — 관계 붕괴의 4대 요인
                    </dd>
                  </div>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>최강 예측인자</dt>
                    <dd className={s.factDesc}>경멸(contempt)</dd>
                  </div>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>긍정:부정 비율</dt>
                    <dd className={s.factDesc}>
                      안정 커플 <strong className={s.stat}>5:1</strong> / 이혼행
                      커플 0.8:1
                    </dd>
                  </div>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>핵심 통찰</dt>
                    <dd className={s.factDesc}>
                      갈등의 유무가 아니라 회복(repair) 속도가 관계를 가른다
                    </dd>
                  </div>
                </dl>
                <p className={s.pull}>
                  저희가 물어야 할 것은 “싸우십니까”가 아니라{" "}
                  <span className="mark">
                    <span>“어떻게 화해하십니까”</span>
                  </span>{" "}
                  입니다.
                </p>
                <p className={s.source}>출처 — Gottman Institute</p>
              </div>
            </li>

            {/* 연구 2 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>02</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>Joel et al. 2020, PNAS</h3>
                {/* §3.2 (2) 원문 한 문장. 뒤에 연결구를 덧붙이지 않는다. */}
                <p className={s.text}>
                  11,000쌍, 43개 데이터셋, 머신러닝 기반 대규모 통합 분석.
                </p>
                <dl className={s.facts}>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>관계-특정 요인</dt>
                    <dd className={s.factDesc}>
                      상대의 헌신 체감·감사·성적 만족·갈등 양상 —{" "}
                      <strong className={s.stat}>45%</strong>
                    </dd>
                  </div>
                  <div className={s.factRow}>
                    <dt className={s.factTerm}>개인 특성</dt>
                    <dd className={s.factDesc}>
                      성격·외모·소득 등 —{" "}
                      <strong className={s.stat}>21%</strong>
                    </dd>
                  </div>
                </dl>
                <p className={s.pull}>
                  <span aria-hidden="true">
                    누구를 만나느냐 {"<"} 둘이 어떤 관계를 만드느냐
                  </span>
                  <span className="sr-only">
                    누구를 만나느냐보다, 둘이 어떤 관계를 만드느냐가 더 중요합니다
                  </span>
                </p>
                <p className={s.source}>출처 — Joel et al. 2020, PNAS</p>
              </div>
            </li>

            {/* 연구 3 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>03</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>
                  Harvard 성인발달연구 — 1938년부터 80년, 724명
                </h3>
                <p className={s.text}>
                  관계의 질(따뜻함·신뢰·지지)이 장기 행복과 건강의 최강
                  예측인자입니다. 50세의 관계 만족도가 80세의 건강을
                  예측했습니다. 외로움은 흡연·음주에 준하는 건강 위험
                  요인이었습니다.
                </p>
                <p className={s.source}>출처 — Harvard Gazette</p>
              </div>
            </li>
          </ol>

          <div className={s.cta} data-reveal>
            <Link className={`pill ${s.ctaPill}`} href={EVENT_HREF}>
              {EVENT_CTA_LABEL}
            </Link>
            <Link className="link-arrow" href="/principles">
              원칙 보기
            </Link>
          </div>
        </div>
      </section>

      <StickyBar href={EVENT_HREF} />
    </div>
  );
}
