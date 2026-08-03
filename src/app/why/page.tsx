import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_CTA_LABEL, EVENT_HREF } from "@/lib/site";
import s from "./why.module.css";

export const metadata: Metadata = {
  title: "왜 가치관인가",
  description:
    "한결이 겨누는 것은 사람도 업체도 아닌 설계다. 기존 포맷의 다섯 가지 구조적 결함과, 그 대안을 뒷받침하는 세 편의 연구.",
};

export default function WhyPage() {
  return (
    <>
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
        </div>
      </section>

      {/* ── 2. 다섯 가지 구조적 결함 (검정) ────────────────── */}
      <section className="band band--dark" aria-labelledby="why-flaws">
        <div className={`shell stagger ${s.head}`}>
          <span className="eyebrow" data-reveal>
            문제 · 다섯 가지 구조적 결함
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
                  현장 프로필 카드의 표준 구성은 MBTI·나이·직업 + 최근 본
                  영화·이상형·좋아하는 음식·취미다.
                </p>
                <p className={s.pull}>
                  이 항목들의 공통점은 전부 명사라는 것이다. 명사는 사람을
                  분류할 수 있게 해주지만 이해하게 해주지는 않는다.
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
                <p className={s.note}>
                  오른쪽 열이 관계의 성패를 가른다. 왼쪽 열은 대화의 재료일
                  뿐이다.
                </p>
              </div>
            </li>

            {/* 결함 2 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>02</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>대화를 스몰토크로 설계한다</h3>
                <p className={s.text}>
                  “최근 본 영화”는 나쁜 질문이 아니다. 첫 30초에는 훌륭한
                  질문이다. 문제는 그 뒤에 아무것도 없다는 것이다. 10분 내내
                  스몰토크 목록을 소화하고 나면 남는 것은 정보의 교환이지
                  이해가 아니다.
                </p>
                <p className={s.pull}>
                  깊이는 저절로 생기지 않는다. 설계되어야 생긴다.
                </p>
              </div>
            </li>

            {/* 결함 3 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>03</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>10명은 기억되지 않는다</h3>
                <p className={s.text}>
                  10:10 포맷에서 참가자는 10명을 만난다. 실제로 기억에 남는
                  것은 4~5명이다.
                </p>
                <p className={s.text}>
                  그리고 여기서 더 심각한 문제가 생긴다. 2시간 뒤 일괄 순위를
                  매기면 그 순위는 최신 효과(가장 마지막 사람), 외모 기억,
                  유난히 강했던 발언에 오염된다. 즉 참가자는 자기가 누구를
                  좋아하는지 정확히 보고할 수 없는 상태에서 보고하게 된다.
                </p>
                <p className={s.text}>
                  선택지가 많을수록 이 문제는 악화된다. 그리고 선택지가
                  많을수록 사람은 판단 비용이 낮은 단서, 즉 외모에 의존하게
                  된다.
                </p>
                <p className={s.pull}>
                  더 많이 만나게 해줄수록 더 얕게 판단하게 된다.
                </p>
              </div>
            </li>

            {/* 결함 4 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>04</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>선택을 공개적으로 만든다</h3>
                <p className={s.text}>
                  호감 표현 방식은 두 가지로 갈린다: 즉시형(대화 직후 쪽지
                  교환)과 일괄형(종료 시 호스트에게 통보). 어느 쪽이든 선택받지
                  못한 사실이 본인에게, 때로는 타인에게 드러나는 순간이
                  존재한다.
                </p>
                <blockquote className={s.quote}>
                  “민망하지 않게 카페는 이 행사만을 위해 통대관되었다고 했다.
                  (…) 꼭 진행 장소가 통대관된 장소인지 확인해 보길 바란다.”
                </blockquote>
                <p className={s.text}>
                  참가자가 후속 참가자에게 명시적으로 권고할 만큼 중요했던 것이
                  프라이버시다. 즉 “남들이 보는 것”이 참가자의 최대 부담이다.
                  그런데 대부분의 포맷은 마지막 단계에서 선택 결과를 드러내는
                  구조를 갖는다.
                </p>
              </div>
            </li>

            {/* 결함 5 */}
            <li className={s.item} data-reveal>
              <div className={s.num}>05</div>
              <div className={s.itemBody}>
                <h3 className={s.itemTitle}>만남 이후가 없다</h3>
                <p className={s.text}>
                  행사가 끝나면 관계는 참가자 개인의 능력에 맡겨진다.
                  미매칭자에게 “One More Time 티켓”을 주는 정교한 운영도
                  있지만, 그것은 다음 행사로의 유입이지 관계의 지속이 아니다.
                </p>
                <p className={s.pull}>
                  한결이 이름에 ‘한결같다’를 담은 이유가 여기 있다. 시작만 파는
                  회사가 되지 않기 위해서다.
                </p>
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
    </>
  );
}
