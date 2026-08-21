import type { Metadata } from "next";
import Link from "next/link";
import FunnelNav from "@/components/FunnelNav";
import HomeStage from "@/components/HomeStage";
import InstagramLink from "@/components/InstagramLink";
import { EVENT } from "@/lib/event";
import { EVENT_HREF, EVENT_CTA_LABEL, SITE } from "@/lib/site";
import styles from "./home.module.css";

/** 제목·설명은 layout.tsx의 기본값을 그대로 쓴다. 여기서는 정규 주소만 밝힌다. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * 회사 메인 = **온보딩 무대 + 마무리 2화면** (2026-08 10차 개편).
 *
 * 첫 화면은 **게이트**다 — 로고만 재생하고 멈춘 뒤 「시작 / 건너뛰기」를 준다.
 *   시작    → 질문 셋(무엇을 했나 → 그 이유 → 자리를 바꾸면) → 겹침 → 착지 → 허브
 *   건너뛰기 → 히어로 애니메이션 → 이 페이지 본문으로 스크롤
 * 상태 머신과 함정은 HomeStage.tsx 주석 참조. 진행 중이던 세션의 재방문은 보던 화면부터다.
 *
 * s-event(1차 모임 정보)와 s-cta(어딘가 있다니까)는 소유자 확정으로 유지 —
 * 무대에서 스크롤로 내려오는 마무리 화면이다.
 *
 * ⚠️ 이 페이지에는 StickyBar를 두지 않는다 — 무대·화면 리듬을 깨고 s-cta가 CTA다.
 * 카피 규칙: 존댓말 · "저희" · 업종/상품명 금지 · 숫자는 EVENT · 슬로건은 SITE.slogan 전문.
 */
const FUNNEL = [
  { id: "s-hero", label: "시작" },
  { id: "s-event", label: "1차 모임" },
  { id: "s-cta", label: "신청" },
];

export default function Home() {
  return (
    <div data-funnel style={{ overflowX: "hidden" }}>
      <FunnelNav items={FUNNEL} />

      {/* ── 무대: 인트로 + 대화 시퀀스 + 허브 (한 화면) ──────── */}
      <div id="s-hero" className={`${styles.screen} ${styles.heroScreen}`}>
        <HomeStage />
      </div>

      {/* ── 1차 모임 정보 (숫자는 EVENT) ───────────────────── */}
      <section
        id="s-event"
        className={styles.screen}
        aria-labelledby="s-event-t"
      >
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            1차 모임
          </span>
          <h2 className={styles.q} id="s-event-t" data-reveal>
            {EVENT.date}, {EVENT.place}에서
            <br />
            처음 엽니다.
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
        </div>
      </section>

      {/* ── 신청 CTA — 퍼널의 종착지 ───────────────────────── */}
      <section
        id="s-cta"
        className={`${styles.screen} band--dark`}
        aria-labelledby="s-cta-t"
      >
        <div className={`shell stagger ${styles.stack}`}>
          {/* 바이럴 보조 카피(브랜딩 문서 확정 표기) — 슬로건이 아니라 별개 문장이다 */}
          <h2 className={styles.q} id="s-cta-t" data-reveal>
            어딘가 있다니까
            <br />너 같은 사람
          </h2>
          {/* 슬로건은 반드시 전문 — SITE.slogan 한 곳에서만 온다 */}
          <p className={styles.answer} data-reveal>
            {SITE.slogan}
          </p>
          <div className={styles.ctaRow} data-reveal>
            <Link className={`pill ${styles.ctaPill}`} href={EVENT_HREF}>
              {EVENT_CTA_LABEL}
            </Link>
            <InstagramLink className="ig-link" />
          </div>
        </div>
      </section>
    </div>
  );
}
