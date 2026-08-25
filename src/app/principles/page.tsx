import type { Metadata } from "next";
import Link from "next/link";
import BackToDialog from "@/components/BackToDialog";
import StickyBar from "@/components/StickyBar";
import { EVENT_CTA_LABEL, EVENT_HREF } from "@/lib/site";
import styles from "./principles.module.css";

export const metadata: Metadata = {
  title: "원칙",
  description:
    "한결이 매일의 판단에 쓰는 5개 원칙과, 각 원칙이 금지하는 것. 현장 그라운드룰과 행사 중 비공개 정보까지.",
  alternates: { canonical: "/principles" },
};

/**
 * 5개 원칙 — 브랜드 철학 §8을 손님 언어(존댓말)로 옮긴 것.
 *
 * ⚠️ 원문 §8은 8개지만 웹에는 5개만 싣는다. 뺀 셋은
 *    "약속은 지킬 수 있는 만큼만 한다" · "안전은 기능이 아니라 전제다" ·
 *    "모르는 것은 모른다고 적는다"이고, 번호는 남은 다섯을 **1~5로 다시 매겼다**.
 *    그래서 여기 `n`은 브랜드 문서의 번호와 일치하지 않는다 —
 *    문서를 근거로 인용할 때 번호로 부르지 말고 제목으로 부를 것.
 *
 * ⚠️ 존댓말로 바꾸지 않는 것 — 셋 다 의도적이다.
 *    1) `title` — 강령이다. 표어는 선언문체라야 표어로 읽힌다.
 *       홈(`app/page.tsx`)이 원칙 1·3·5의 제목을 그대로 인용하므로 고치면 두 곳이 어긋난다.
 *    2) `deny` — 금지 항목 목록이라 명사구로 끝난다.
 *    3) GROUND_RULES · HIDDEN · ALLOWED — 전부 명사구 목록이다.
 *
 * ⚠️ 설명문("적용" 블록과 원칙별 리드)은 전부 없앴다.
 *    다섯 원칙이 예외 없이 **제목 + 금지하는 것** 두 조각으로만 이루어진다 —
 *    일부만 설명이 붙으면 목록의 리듬이 어긋나기 때문이다. 하나만 되살리지 말 것.
 */
type Principle = {
  n: number;
  title: string;
  deny: string[];
};

const PRINCIPLES: Principle[] = [
  {
    n: 1,
    title: "답보다 이유를 묻는다",
    // ⚠️ 원문의 금지 항목에는 내부 용어가 들어간 예시가 붙어 있다.
    //    그 용어는 노출 금지라 예시만 잘라내고 뒷부분을 그대로 남겼다.
    deny: [
      "객관식만으로 매칭 점수를 산출하는 것",
      "숫자를 단독으로 노출하는 것",
    ],
  },
  {
    n: 2,
    title: "깊이를 위해 처리량을 포기한다",
    deny: [
      "매출을 이유로 회차 인원을 늘리는 것",
      "라운드 시간을 9분 아래로 줄이는 것",
    ],
  },
  {
    n: 3,
    title: "사람을 상품으로 전시하지 않는다",
    deny: [
      "참가자 프로필의 공개 게시",
      "외모 관련 기재란",
      "신청 단계의 자기 PR 요구",
    ],
  },
  {
    n: 4,
    title: "선택은 사적으로 이루어진다",
    deny: ["공개 지목", "“선택받지 못한 분들” 언급", "매칭 결과의 현장 발표"],
  },
  {
    n: 5,
    title: "시작만 팔지 않는다",
    deny: [
      "매칭 성사 후 관계를 참가자에게만 맡기는 것",
      "재참여를 유일한 리텐션 수단으로 삼는 것",
    ],
  },
];

/**
 * 현장 그라운드룰 — 시장조사(운영자 관점) §9 원문.
 * ⚠️ 원문 4·5조는 음주를 전제로 쓰여 있으나 현행 방침은 무알콜이다.
 *    "음주 강요 금지"의 취지만 남기고 만취·퇴장 조항은 싣지 않는다.
 */
const GROUND_RULES = [
  "명시적 동의 없는 신체 접촉 금지",
  "성적 언동·외모 평가·나이/직업 캐묻기 금지",
  // 🔴 "연락처는 상호 동의 시에만 교환"으로 되돌리지 말 것. 세 곳과 충돌한다 —
  //    ① Locked 결정(06 §7.4): 번호는 한쪽이 불편해도 회수가 어렵다
  //    ② 같은 페이지 아래 HIDDEN에 「전화번호·카카오톡」이 금지로 들어 있다
  //    ③ 폼 14(T+3 좋아요)는 "번호를 직접 주고받지 않는다"를 전제로 돈다
  "서로 마음이 닿으면 오픈채팅이나 인스타그램으로 연결해드립니다 — 전화번호를 직접 주고받지는 않습니다",
  "음주 강요 금지",
  "위반 신고 시 주최자가 즉시 분리·중재하고 필요 시 경찰 신고",
  "동일 참가자의 향후 행사 참여 영구 제한",
];

/** 행사 중 밝히지 않는 것 — `_1차 오프라인 소개팅.md` "금지할 정보" */
const HIDDEN = [
  "실명",
  "정확한 나이 또는 출생연도",
  "학교명",
  "회사명",
  "구체적인 직업",
  "동 단위 거주지",
  "SNS 계정",
  "전화번호·카카오톡",
  "소득·자산",
];

/** 오히려 적극적으로 말하게 하는 것 — §3.5 */
const ALLOWED = [
  "과거 경험의 익명화 서술",
  "왜 그런 가치관을 갖게 됐는지",
  "갈등 처리 방식 · 관계에서 중요한 것",
];

/**
 * ⚠️ 밴드 교차는 흰 → 검정 → 흰이다. "충돌 우선순위" 섹션(검정)을 걷어내면서
 *    남은 셋이 흰·흰·검정이 되어 앞의 두 섹션이 한 덩어리로 붙어 보였다.
 *    그래서 그라운드룰을 검정으로, 비공개 정보를 흰으로 뒤집었다.
 *    스타일은 전부 토큰(--ink/--tint/--rule…)이라 색을 따로 손댈 필요가 없다.
 */
export default function PrinciplesPage() {
  return (
    <div style={{ overflowX: "hidden", paddingBottom: 88 }}>
      {/* ── 1. 5개 원칙 (흰) ─────────────────────────────────── */}
      <section className="band" aria-labelledby="principles-intro">
        <div className={`shell stagger ${styles.stack}`}>
          {/* 홈 대화 도중 온 방문자에게만 보인다(마운트 후 sessionStorage 판정) */}
          <BackToDialog />
          <span className="eyebrow" data-reveal>
            원칙
          </span>
          <h1
            className={`display display--page ${styles.title}`}
            id="principles-intro"
            data-reveal
          >
            한결이 지키기로 한 것들.
          </h1>
          <p className="lede" data-reveal>
            각 원칙에는 그 원칙이 금지하는 것이 함께 적혀 있습니다.{" "}
            <span className="mark">
              <span>금지 항목이 없는 원칙은 지켜지지 않습니다.</span>
            </span>
          </p>

          <div className="tldr" data-reveal>
            <span className="tldr__label">핵심 요약</span>
            <ul className="tldr__list">
              <li>원칙이 5개 있고, 각 원칙에는 금지 항목이 함께 적혀 있습니다.</li>
              <li>
                현장에서는 실명·나이·직업·SNS 등 식별 정보를 전부 비공개로 다룹니다.
              </li>
            </ul>
          </div>

          {/* 원칙 제목은 h3다. 섹션 제목(h1)과 크기가 두 배 가까이 다른데
              같은 레벨이면 마크업 위계와 시각 위계가 어긋난다. 이 h2가 그 사이를 잇는다. */}
          <h2 className={`eyebrow ${styles.listCaption}`} data-reveal>
            5개 원칙
          </h2>
          <ol className={styles.principles}>
            {PRINCIPLES.map((p) => (
              <li key={p.n} className={styles.principle} data-reveal>
                <span className={styles.principleNum}>원칙 {p.n}</span>
                <h3 className={styles.principleTitle}>{p.title}</h3>

                <div className={`${styles.block} ${styles.blockDeny}`}>
                  <span className={styles.blockLabel}>금지하는 것</span>
                  <ul className={styles.denyList}>
                    {p.deny.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 2. 현장 그라운드룰 (검정) ────────────────────────── */}
      <section className="band band--dark" aria-labelledby="principles-rules">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            현장 그라운드룰
          </span>
          <h2
            className={`display ${styles.title}`}
            id="principles-rules"
            data-reveal
          >
            안전은 기능이 아니라 전제입니다.
          </h2>

          <ol className={`${styles.rules} ${styles.blockGap}`}>
            {GROUND_RULES.map((r) => (
              <li key={r} className={styles.rule} data-reveal>
                <span>{r}</span>
              </li>
            ))}
          </ol>

          <p className={styles.note} data-reveal>
            행사에는 술을 두지 않습니다. 차와 간단한 다과만 준비됩니다.
          </p>
        </div>
      </section>

      {/* ── 3. 행사 중 비공개 정보 (흰) ──────────────────────── */}
      <section className="band" aria-labelledby="principles-hidden">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            행사 중 비공개 정보
          </span>
          <h2
            className={`display ${styles.displayTight}`}
            id="principles-hidden"
            data-reveal
          >
            “개인적 이야기”는 허용,
            <br />
            “개인을 식별할 수 있는 정보”만 금지.
          </h2>
          <p className="lede" data-reveal>
            경험을 못 말하게 하면 대화가 인위적 토론이 됩니다.
          </p>

          <div className={`${styles.infoGrid} ${styles.blockGap}`} data-reveal>
            <div className={`${styles.infoCol} ${styles.infoColDeny}`}>
              <span className={styles.infoLabel}>금지 — 식별 정보</span>
              <ul className={styles.infoList}>
                {HIDDEN.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <div className={`${styles.infoCol} ${styles.infoColAllow}`}>
              <span className={styles.infoLabel}>허용 — 경험·가치</span>
              <ul className={styles.infoList}>
                {ALLOWED.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          <Link className={`pill ${styles.cta}`} href={EVENT_HREF} data-reveal>
            {EVENT_CTA_LABEL}
          </Link>
        </div>
      </section>

      <StickyBar href={EVENT_HREF} />
    </div>
  );
}
