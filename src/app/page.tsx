import type { Metadata } from "next";
import Link from "next/link";
import HomeHero from "@/components/HomeHero";
import StickyBar from "@/components/StickyBar";
import { EVENT } from "@/lib/event";
import { EVENT_HREF, EVENT_CTA_LABEL } from "@/lib/site";
import styles from "./home.module.css";

/** 제목·설명은 layout.tsx의 기본값을 그대로 쓴다. 여기서는 정규 주소만 밝힌다. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * 회사 메인. 5섹션으로 짧게 끊고 제품 설명은 하위 페이지(/mission, /why, /principles,
 * /events/1)로 위임한다.
 *
 * 카피는 01_brand_philosophy.md를 **손님 언어(존댓말)로 옮긴 것**이다. 문서가 원본이고
 * 여기는 번역본이다 — 옮길 때 바꿔도 되는 것은 말투뿐이고, 사실·숫자·출처는 그대로 간다.
 * 숫자(날짜·장소·정원·참가비)는 예외 없이 `@/lib/event`의 EVENT에서 온다.
 *
 * SiteHeader / Footer / PageEffects / <main>은 app/layout.tsx가 렌더한다.
 */
export default function Home() {
  return (
    <div style={{ overflowX: "hidden", paddingBottom: 88 }}>
      <HomeHero />

      {/* ── 2. 한결이 하는 일 (§1.2) ────────────────────────── */}
      <section className="band">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            한결이 하는 일
          </span>
          <h2 className="display" data-reveal>
            만나게 해주고
            <br />
            끝이 아닙니다.
          </h2>
          <p className="lede" data-reveal>
            만남을 주선하는 회사는 많습니다. 반면에 서로를 잘 알게 해주는 대화를 설계하는
            회사는 없습니다. 저희는 만남보다 만남 이후를 설계합니다.
          </p>
          <Link className={`link-arrow ${styles.arrow}`} href="/mission" data-reveal>
            목표 전문 보기
          </Link>
        </div>
      </section>

      {/* ── 3. 가치관이 중요한 이유 (§3.2 Joel et al. 2020 · §3.3) ─── */}
      <section className="band band--dark">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            가치관이 중요한 이유
          </span>
          <h2 className="display" data-reveal>
            건강한 관계의 시작은
            <br />
            대화입니다.
          </h2>

          {/*
            ⚠️ 라벨을 "내면적 / 외면적"으로 부르는 것은 손님이 알아듣기 쉬운 말로 옮긴 것이지
               논문의 구분과 일대일로 대응하지 않는다. Joel et al. 2020의 구분은
               relationship-specific(둘이 함께 만든 것) vs individual differences(각자 원래
               가진 것)이고, 성격은 내면적이지만 21% 쪽에 속한다.
               원문의 괄호 설명("성격·외모·소득 등")을 지운 이유가 이것이다 — 남겨두면
               "성격 = 외면적"이라는 틀린 말이 된다. 되살리지 말 것.
               대신 출처는 반드시 남긴다. 원칙 1이 "숫자를 단독으로 노출하는 것"을 금지한다.
          */}
          <div className={styles.stats} data-reveal>
            <p className={styles.statCaption}>관계 만족도 요인</p>
            <div className={styles.stat}>
              <span className={styles.statNum}>45%</span>
              <p className={styles.statLabel}>내면적 요인</p>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>21%</span>
              <p className={styles.statLabel}>외면적 요인</p>
            </div>
          </div>
          <p className={styles.statSource} data-reveal>
            Joel et al. 2020, PNAS
          </p>

          <p className={styles.quote} data-reveal>
            한결은 대화를 통한 관계를 설계합니다.
          </p>
          <Link className={`link-arrow ${styles.arrow}`} href="/why" data-reveal>
            왜 가치관인가 자세히 보기
          </Link>
        </div>
      </section>

      {/* ── 4. 한결의 약속 (/principles의 5개 원칙 중 1·3·5 발췌) ───
          ⚠️ 카드에 "원칙 N" 라벨을 달지 않는다. 발췌라 번호가 이어지지 않아
             오히려 어수선하다. 전체 목록과 번호는 /principles에 있다. */}
      <section className="band">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            한결의 약속
          </span>
          <h2 className="display" data-reveal>
            한결의 약속은
            <br />
            무겁고 진중합니다.
          </h2>

          <div className={styles.principles} data-reveal>
            <div className="card">
              <h3 className="card__title">답보다 이유를 묻는다</h3>
              <p className={styles.principleBody}>
                답이 같다고 가치관이 같은 게 아닙니다.
              </p>
            </div>
            <div className="card">
              {/* 부등호는 소리 내어 읽으면 뜻이 사라진다 — 눈으로 볼 것과 읽어줄 것을 나눈다 */}
              <h3 className="card__title">
                <span aria-hidden="true">가치관 &gt; 외모</span>
                <span className="sr-only">가치관이 외모보다 우선합니다</span>
              </h3>
              <p className={styles.principleBody}>
                가치관이 매력이 됩니다. 가치관이 관계를 형성합니다.
              </p>
            </div>
            <div className="card">
              <h3 className="card__title">시작만 팔지 않는다</h3>
              <p className={styles.principleBody}>
                고객님의 시작은 한결에게도 시작입니다.
              </p>
            </div>
          </div>

          <Link className={`link-arrow ${styles.arrow}`} href="/principles" data-reveal>
            8개 원칙 전부 보기
          </Link>
        </div>
      </section>

      {/* ── 5. 1차 모임 — 전환 섹션 (숫자는 EVENT) ───────────── */}
      <section className="band band--dark">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            1차 모임
          </span>
          <h2 className="display" data-reveal>
            한결과 함께
            <br />
            당신의 결을 찾으러 가시겠어요?
          </h2>

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

      <StickyBar href={EVENT_HREF} />
    </div>
  );
}
