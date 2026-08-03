import Link from "next/link";
import HomeHero from "@/components/HomeHero";
import { EVENT } from "@/lib/event";
import { EVENT_HREF, EVENT_CTA_LABEL } from "@/lib/site";
import styles from "./home.module.css";

/**
 * 회사 메인. 5섹션으로 짧게 끊고 제품 설명은 하위 페이지(/mission, /why, /principles,
 * /events/1)로 위임한다.
 *
 * 카피는 전부 01_brand_philosophy.md 원문이다. 옆에 인용한 절 번호를 적어 뒀으니
 * 문장을 고칠 일이 생기면 문서를 먼저 고치고 여기로 가져올 것 — 반대 방향은 금지.
 * 숫자(날짜·장소·정원·참가비)는 예외 없이 `@/lib/event`의 EVENT에서 온다.
 *
 * SiteHeader / Footer / PageEffects / <main>은 app/layout.tsx가 렌더한다.
 */
export default function Home() {
  return (
    <div style={{ overflowX: "hidden" }}>
      <HomeHero />

      {/* ── 2. 우리가 하는 일 (§1.2) ────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            우리가 하는 일
          </span>
          <h2 className="display" data-reveal>
            한결의 제품은
            <br />
            만남이 아니라 대화다.
          </h2>
          <p className="lede" data-reveal>
            만남을 주선하는 회사는 많다. 대화가 어떻게 흘러갈지를 설계하는 회사는 거의 없다.
            대부분은 사람을 한자리에 모아놓고 대화는 참가자에게 맡긴다. 한결은 그 반대다. 사람을
            모으는 건 수단이고, 어떤 질문이 어떤 순서로 오가는가가 제품이다.
          </p>
          <p className={styles.quote} data-reveal>
            우리가 만드는 것은 소개팅 프로그램이 아니라 대화 설계 시스템(Conversation Design
            System)이다.
          </p>
          <Link className={`link-arrow ${styles.arrow}`} href="/mission" data-reveal>
            미션 전문 보기
          </Link>
        </div>
      </section>

      {/* ── 3. 왜 가치관인가 (§3.2 Joel et al. 2020 · §3.3) ─── */}
      <section className="band band--dark">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            우리가 아는 것
          </span>
          <h2 className="display" data-reveal>
            누구를 만나느냐
            <span className={styles.lt} aria-hidden="true">
              &lt;
            </span>
            <br />
            둘이 어떤 관계를 만드느냐
          </h2>
          <p className="lede" data-reveal>
            Joel et al. 2020, PNAS — 11,000쌍, 43개 데이터셋, 머신러닝 기반 대규모 통합 분석.
          </p>

          <div className={styles.stats} data-reveal>
            <p className={styles.statCaption}>관계 만족도 설명력</p>
            <div className={styles.stat}>
              <span className={styles.statNum}>45%</span>
              <p className={styles.statLabel}>
                관계-특정 요인
                <br />
                (상대의 헌신 체감·감사·성적 만족·갈등 양상)
              </p>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>21%</span>
              <p className={styles.statLabel}>
                개인 특성
                <br />
                (성격·외모·소득 등)
              </p>
            </div>
          </div>

          <p className={styles.quote} data-reveal>
            매칭은 좋은 시작과 마찰의 감소다. 그 이상을 약속하면 거짓말이 된다.
          </p>
          <Link className={`link-arrow ${styles.arrow}`} href="/why" data-reveal>
            왜 가치관인가 자세히 보기
          </Link>
        </div>
      </section>

      {/* ── 4. 우리의 원칙 (§8, 8개 중 3개 발췌) ─────────────── */}
      <section className="band">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            우리의 원칙
          </span>
          <h2 className="display" data-reveal>
            원칙은
            <br />
            매일의 판단 기준이다.
          </h2>
          <p className="lede" data-reveal>
            각 원칙에는 그 원칙이 금지하는 것이 함께 적혀 있다. 금지 항목이 없는 원칙은 지켜지지
            않는다.
          </p>

          <div className={styles.principles} data-reveal>
            <div className="card">
              <span className="card__num">원칙 1</span>
              <h3 className="card__title">답보다 이유를 묻는다</h3>
              <p className={styles.principleBody}>
                우리가 수집하는 최소 단위는 선택지가 아니라 선택 + 이유다.
              </p>
            </div>
            <div className="card">
              <span className="card__num">원칙 3</span>
              <h3 className="card__title">사람을 상품으로 전시하지 않는다</h3>
              <p className={styles.principleBody}>
                신청서에 &ldquo;매력 3가지&rdquo;를 묻지 않는다. 참가자 명단을 공개하지 않는다.
              </p>
            </div>
            <div className="card">
              <span className="card__num">원칙 5</span>
              <h3 className="card__title">약속은 지킬 수 있는 만큼만 한다</h3>
              <p className={styles.principleBody}>
                &ldquo;완벽한 인연&rdquo;을 약속하지 않는다. 우리가 파는 것은 좋은 시작이다.
              </p>
            </div>
          </div>

          <Link className={`link-arrow ${styles.arrow}`} href="/principles" data-reveal>
            8개 원칙 전부 보기
          </Link>
        </div>
      </section>

      {/* ── 5. 지금 하는 실험 (§6 Phase 1 · 숫자는 EVENT) ───── */}
      <section className="band band--dark">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            지금 하는 실험
          </span>
          <h2 className="display" data-reveal>
            한결은 확신에서 출발한 회사가 아니라
            <br />
            가설에서 출발한 회사다.
          </h2>
          <p className="lede" data-reveal>
            Phase 1 · 증명 — 2026. 오프라인 실험으로 핵심 가설을 검증한다.
          </p>
          <p className={styles.quote} data-reveal>
            글(텍스트)로 맞춘 결이, 실제로 만나도 맞을까?
          </p>

          <dl className={styles.facts} data-reveal>
            <div className={styles.fact}>
              <dt className={styles.factTerm}>날짜</dt>
              <dd className={styles.factValue}>{EVENT.date}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factTerm}>장소</dt>
              <dd className={styles.factValue}>{EVENT.place}</dd>
              <dd className={styles.factNote}>{EVENT.placeNote}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factTerm}>정원</dt>
              <dd className={styles.factValue}>{EVENT.capacity}명</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factTerm}>참가비</dt>
              <dd className={styles.factValue}>{EVENT.priceLabel}</dd>
              <dd className={styles.factNote}>{EVENT.priceNote}</dd>
            </div>
          </dl>

          <Link className={`pill ${styles.ctaPill}`} href={EVENT_HREF} data-reveal>
            {EVENT_CTA_LABEL}
          </Link>
        </div>
      </section>
    </div>
  );
}
