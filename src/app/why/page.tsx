import type { Metadata } from "next";
import Link from "next/link";
import StickyBar from "@/components/StickyBar";
import { EVENT_CTA_LABEL, EVENT_HREF } from "@/lib/site";
import s from "./why.module.css";

export const metadata: Metadata = {
  title: "왜 가치관인가",
  description:
    "한결이 겨누는 것은 사람도 업체도 아닌 설계다. 기존 포맷의 네 가지 구조적 결함과, 그 대안을 뒷받침하는 세 편의 연구.",
};

export default function WhyPage() {
  return (
    <div style={{ paddingBottom: 88 }}>
      {/* ── 1. 문제를 정확히 겨누기 (흰) ───────────────────── */}
      <section className="band" aria-labelledby="why-aim">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            왜 가치관인가
          </span>
          <h1 className={`display ${s.title}`} id="why-aim" data-reveal>
            우리가 겨누는 것은
            <br />
            오직 “설계”다.
          </h1>
          <div className={s.prose} data-reveal>
            <p className="lede">
              한결이 겨누는 것은 사람도, 업체도, 진정성도 아니다.
            </p>
            <p className="lede">
              기존 포맷은 나쁘게 만들어진 게 아니라 다른 목적에 맞게 잘
              만들어졌다. 그 목적은 “제한된 시간에 최대한 많은 이성을 만나게
              한다”이다. 그 목적에는 최적이다. 다만 그것은 깊이의 목적이 아니라
              처리량의 목적이다.
            </p>
          </div>

          {/* 핵심 요약 — 이 페이지 전체(구조적 결함 5개 + 연구 3편)를 끝까지
              읽지 않아도 결론과 다음 행동을 바로 알 수 있게 한다. */}
          <div className="tldr" data-reveal>
            <span className="tldr__label">핵심 요약</span>
            <ul className="tldr__list">
              <li>기존 포맷은 틀린 게 아니라 처리량이 목적이다. 우리는 깊이가 목적이다.</li>
              <li>
                <strong>Joel et al. 2020(PNAS)</strong> — 관계 만족도는 누구를 만났는지(21%)보다
                만난 뒤의 관계 역학(45%)이 두 배 더 크게 좌우한다.
              </li>
              <li>그래서 완벽한 매칭은 약속하지 않는다. 약속하는 건 좋은 시작뿐이다.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── 2. 다섯 가지 구조적 결함 (검정) ────────────────── */}
      <section className="band band--dark" aria-labelledby="why-flaws">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            문제 · 네 가지 구조적 결함
          </span>
          <h2 className={`display ${s.title}`} id="why-flaws" data-reveal>
            명사는 사람을 분류할 수 있게 해주지만
            <br />
            이해하게 해주지는 않는다.
          </h2>

          <ol className={`stagger ${s.list}`}>
            {/* 결함 1 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>01</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>사람을 스펙 카드로 환원한다</h3>
                <p className={s.text}>
                  MBTI·나이·직업 같은 명사형 정보는 사람을 분류하게 해줄 뿐,
                  이해하게 해주지는 않는다.
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
                    모든 문항에 &ldquo;왜 그렇게 생각했는지&rdquo; Follow-up을 붙인다 — 선택이
                    아니라 선택 + 이유를 본다.
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
                  정보 교환이지 이해가 아니다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    사전에 10개 주제로 답변을 받아, 당일 대화가 처음부터 그
                    답변에서 시작한다.
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
                  안고 대화하게 된다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    결1~결20 익명 배정, 선택 결과는 원칙적으로 비공개다.
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
                  포맷엔 그 다음이 없다.
                </p>
                <div className={s.solution}>
                  <span className={s.solutionLabel}>한결의 해결책</span>
                  <p className={s.solutionText}>
                    성향 리포트를 드리고, 관계를 잇는 것까지 설계에 포함한다.
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 3. 세 개의 랜드마크 연구 (흰) ──────────────────── */}
      <section className="band" aria-labelledby="why-research">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            근거 · 세 개의 랜드마크 연구
          </span>
          <h2 className={`display ${s.title}`} id="why-research" data-reveal>
            누구를 만나느냐 {"<"}
            <br />둘이 어떤 관계를 만드느냐
          </h2>
          <p className="lede" data-reveal>
            한결의 매칭 철학은 세 편의 종단·대규모 연구 위에 서 있다.
          </p>

          <ol className={`stagger ${s.list}`}>
            {/* 연구 1 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>01</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>Gottman — 40년 종단연구</h3>
                <p className={s.text}>
                  15분간의 부부 대화를 관찰해 이혼 여부를{" "}
                  <strong className={s.stat}>90%</strong> 이상 정확도로
                  예측했다.
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
                  우리가 물어야 할 것은 “싸우십니까”가 아니라{" "}
                  <span className="mark">
                    <span>“어떻게 화해하십니까”</span>
                  </span>{" "}
                  다.
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
                  누구를 만나느냐 {"<"} 둘이 어떤 관계를 만드느냐
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
                  예측인자. 50세의 관계 만족도가 80세의 건강을 예측했다.
                  외로움은 흡연·음주에 준하는 건강 위험 요인이었다.
                </p>
                <p className={s.source}>출처 — Harvard Gazette</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 4. 정직한 고백 (검정) ──────────────────────────── */}
      <section className="band band--dark" aria-labelledby="why-honest">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            정직한 고백 — 매칭은 만능이 아니다
          </span>
          <h2 className={`display ${s.title}`} id="why-honest" data-reveal>
            “완벽한 매칭 = 오래 가는 관계”는
            <br />
            과학이 지지하지 않는다.
          </h2>
          <div className={s.prose} data-reveal>
            <p className="lede">
              Joel et al.의 21% vs 45%를 다시 보자. 관계의 성패는 만난 뒤의
              역학이 더 크게 좌우한다. 아무리 정교하게 매칭해도, 그것은 21% 쪽
              항목에 대한 최적화다.
            </p>
            <p className="lede">그렇다면 왜 하는가?</p>
          </div>
          <p className={s.big} data-reveal>
            매칭은 좋은 시작과 마찰의 감소다.
            <br />그 이상을 약속하면 거짓말이 된다.
          </p>
          <div className={s.prose} data-reveal>
            <p className="lede">
              이 정직함은 브랜드의 약점이 아니라 가장 강한 자산이다. 시장의
              모든 경쟁자가 “운명의 상대를 찾아드립니다”라고 말할 때, “우리는
              시작을 잘 만들어드립니다. 나머지는 두 분이 만드는 겁니다”라고
              말하는 브랜드는 단 하나뿐이다. 그리고 그 말은{" "}
              <span className="mark">
                <span>참이다.</span>
              </span>
            </p>
            <p className="lede">
              그래서 한결의 사업 범위는 매칭에서 끝나지 않는다.
            </p>
          </div>
          <div className={s.cta} data-reveal>
            <Link className={`pill ${s.ctaPill}`} href={EVENT_HREF}>
              {EVENT_CTA_LABEL}
            </Link>
            <Link className="link-arrow" href="/principles">
              원칙과 안전 보기
            </Link>
          </div>
        </div>
      </section>

      <StickyBar href={EVENT_HREF} />
    </div>
  );
}
