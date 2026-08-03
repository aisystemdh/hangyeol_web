import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { EVENT_CTA_LABEL, EVENT_HREF } from "@/lib/site";
import styles from "./principles.module.css";

export const metadata: Metadata = {
  title: "원칙과 안전",
  description:
    "한결이 매일의 판단에 쓰는 8개 원칙과, 각 원칙이 금지하는 것. 현장 그라운드룰과 행사 중 비공개 정보까지.",
};

/**
 * 8개 원칙 — 브랜드 철학 §8 원문.
 * 문장은 손대지 않는다. 강조만 <strong>으로 옮겼다.
 * ⚠️ 원칙 2의 손익 관련 문장, §8.1 예시의 인원 증원 예시는 대외비/현행 정원과
 *    충돌해 의도적으로 제외했다.
 */
type Principle = {
  n: number;
  title: string;
  lead?: ReactNode;
  apply: ReactNode;
  deny: string[];
};

const PRINCIPLES: Principle[] = [
  {
    n: 1,
    title: "답보다 이유를 묻는다",
    lead: (
      <>
        우리가 수집하는 최소 단위는 선택지가 아니라{" "}
        <strong className={styles.em}>선택 + 이유</strong>다.
      </>
    ),
    apply: <>모든 문항에는 Follow-up이 붙는다. Follow-up 없는 문항은 미완성이다.</>,
    // ⚠️ 원문은 “일치율 87%” 같은 … 이지만 "일치율"은 노출 금지 내부 용어라
    //    예시만 잘라내고 뒷부분을 그대로 남겼다.
    deny: [
      "객관식만으로 매칭 점수를 산출하는 것",
      "숫자를 단독으로 노출하는 것",
    ],
  },
  {
    n: 2,
    title: "깊이를 위해 처리량을 포기한다",
    lead: (
      <>
        인원과 시간이 충돌하면{" "}
        <strong className={styles.em}>언제나 시간을 지킨다.</strong>
      </>
    ),
    apply: (
      <>
        <strong className={styles.em}>9분은 9분이다.</strong> 대화가 잘 풀려도
        라운드를 연장하지 않는다.
      </>
    ),
    deny: [
      "매출을 이유로 회차 인원을 늘리는 것",
      "라운드 시간을 9분 아래로 줄이는 것",
    ],
  },
  {
    n: 3,
    title: "사람을 상품으로 전시하지 않는다",
    apply: (
      <>
        신청서에 “매력 3가지”를 묻지 않는다. 참가자 명단을 공개하지 않는다. 호칭은{" "}
        <strong className={styles.em}>성별과 순서를 담지 않는다</strong> — “결1~결20”을
        무작위로 배정해, 번호로 성별도 신청 순서도 알 수 없게 한다.
      </>
    ),
    deny: [
      "참가자 프로필의 공개 게시",
      "외모 관련 기재란",
      "신청 단계의 자기 PR 요구",
    ],
  },
  {
    n: 4,
    title: "선택은 사적으로 이루어진다",
    apply: (
      <>
        순위·선택 결과는 <strong className={styles.em}>비공개가 원칙</strong>이다.
        미선택 사실이 본인에게조차 강조되지 않도록 리포트 문장을 설계한다.
      </>
    ),
    deny: ["공개 지목", "“선택받지 못한 분들” 언급", "매칭 결과의 현장 발표"],
  },
  {
    n: 5,
    title: "약속은 지킬 수 있는 만큼만 한다",
    apply: (
      <>
        “완벽한 인연”을 약속하지 않는다. 우리가 파는 것은{" "}
        <strong className={styles.em}>좋은 시작</strong>이다.
      </>
    ),
    deny: [
      "성혼률·커플 성사율의 마케팅 사용",
      "“운명” “인연” 류의 결정론적 언어",
      "익명 저장이니 안심하라는 표현(재식별 위험이 실재한다)",
    ],
  },
  {
    n: 6,
    title: "안전은 기능이 아니라 전제다",
    apply: (
      <>
        안전 절차는 옵션으로 제공하되, 절차 자체의 품질은 타협하지 않는다.
        프라이버시(통대관·칸막이)는 만족도의 1순위 조건이다.
      </>
    ),
    deny: [
      "비용 절감을 위한 통대관 포기",
      "신원 확인 절차의 간소화",
      "개인정보 선택 동의를 참가 조건으로 거는 것",
    ],
  },
  {
    n: 7,
    title: "모르는 것은 모른다고 적는다",
    lead: (
      <>
        한결은 자기 기획서에{" "}
        <strong className={styles.em}>자기 약점을 적어두는 회사</strong>다. 오프라인
        기획안의 공정성 항목이 외부 피드백에서 3.5/10을 받았다는 사실은 문서에 그대로
        남아 있다. 시장조사 문서에는 “검증 통과 13건 중 12건이 업체 자기기술”이라는
        한계가 명시돼 있다.
      </>
    ),
    apply: (
      <>모든 문서에 미해결 쟁점 섹션을 둔다. 가설과 사실을 표기로 구분한다.</>
    ),
    deny: [
      "미검증 수치의 단정적 인용",
      "불리한 피드백의 삭제",
      "“검증됐다”는 표현의 남용",
    ],
  },
  {
    n: 8,
    title: "시작만 팔지 않는다",
    apply: (
      <>
        행사는 리포트로 끝나고, 리포트는 다음 관계로 이어진다. 관계 유지 기능은 v2의
        선택지가 아니라 <strong className={styles.em}>정체성의 완성</strong>이다.
      </>
    ),
    deny: [
      "매칭 성사 후 관계를 참가자에게만 맡기는 것",
      "재참여를 유일한 리텐션 수단으로 삼는 것",
    ],
  },
];

/** §8.1 — 안전(6) > 존엄(3·4) > 정직(5·7) > 깊이(1·2) > 지속(8) */
const PRIORITY = [
  { label: "안전", ref: "원칙 6" },
  { label: "존엄", ref: "원칙 3·4" },
  { label: "정직", ref: "원칙 5·7" },
  { label: "깊이", ref: "원칙 1·2" },
  { label: "지속", ref: "원칙 8" },
];

/**
 * 현장 그라운드룰 — 시장조사(운영자 관점) §9 원문.
 * ⚠️ 원문 4·5조는 음주를 전제로 쓰여 있으나 현행 방침은 무알콜이다.
 *    "음주 강요 금지"의 취지만 남기고 만취·퇴장 조항은 싣지 않는다.
 */
const GROUND_RULES = [
  "명시적 동의 없는 신체 접촉 금지",
  "성적 언동·외모 평가·나이/직업 캐묻기 금지",
  "연락처는 상호 동의 시에만 교환, 사후 일방적 연락 금지",
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

export default function PrinciplesPage() {
  return (
    <>
      {/* ── 1. 8개 원칙 (흰) ─────────────────────────────────── */}
      <section className="band" aria-labelledby="principles-intro">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            원칙과 안전
          </span>
          <h1
            className={`display ${styles.title}`}
            id="principles-intro"
            data-reveal
          >
            미션과 비전이 방향이라면,
            <br />
            원칙은 매일의 판단 기준이다.
          </h1>
          <p className="lede" data-reveal>
            각 원칙에는 그 원칙이 금지하는 것이 함께 적혀 있다.{" "}
            <span className="mark">
              <span>금지 항목이 없는 원칙은 지켜지지 않는다.</span>
            </span>
          </p>

          {/* 원칙 제목은 h3다. 섹션 제목(h2, 58px)과 크기가 두 배 가까이 다른데
              같은 레벨이면 마크업 위계와 시각 위계가 어긋난다. 이 h2가 그 사이를 잇는다. */}
          <h2 className={`eyebrow ${styles.listCaption}`} data-reveal>
            8개 원칙
          </h2>
          <ol className={styles.principles}>
            {PRINCIPLES.map((p) => (
              <li key={p.n} className={styles.principle} data-reveal>
                <span className={styles.principleNum}>원칙 {p.n}</span>
                <h3 className={styles.principleTitle}>{p.title}</h3>
                {p.lead ? <p className={styles.principleLead}>{p.lead}</p> : null}

                <div className={styles.pair}>
                  <div className={styles.block}>
                    <span className={styles.blockLabel}>적용</span>
                    <p className={styles.blockBody}>{p.apply}</p>
                  </div>
                  <div className={`${styles.block} ${styles.blockDeny}`}>
                    <span className={styles.blockLabel}>금지하는 것</span>
                    <ul className={styles.denyList}>
                      {p.deny.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 2. 충돌 우선순위 (검정) ──────────────────────────── */}
      <section className="band band--dark" aria-labelledby="principles-priority">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            원칙 충돌 시 우선순위
          </span>
          <h2
            className={`display ${styles.title}`}
            id="principles-priority"
            data-reveal
          >
            두 원칙이 부딪히면
            <br />
            아래 순서를 따른다.
          </h2>

          {/* [data-bar]는 면적이 0이라 자기 자신을 관찰하면 발화하지 않는다.
              이 래퍼가 부모로서 관찰된다. */}
          <div className={styles.chainWrap} data-reveal>
            <ol className={styles.chain}>
              {PRIORITY.map((p) => (
                <li key={p.label} className={styles.chainItem}>
                  {p.label}
                  <span className={styles.chainRef}>{p.ref}</span>
                </li>
              ))}
            </ol>
            <span className={styles.chainRule} data-bar />
          </div>

          {/* §8.1 예시 원문 그대로. 앞 예시(인원 증원)는 현행 정원과 충돌해 뺐지만
              문장 자체는 한 글자도 고치지 않는다. */}
          <p className="lede" data-reveal>
            반대로, 원칙 2를 지키려고 조명을 어둡게 해 친밀감을 높이자는 제안이
            나오면 원칙 6(안전)이 이긴다.
          </p>
        </div>
      </section>

      {/* ── 3. 현장 그라운드룰 (흰) ──────────────────────────── */}
      <section className="band" aria-labelledby="principles-rules">
        <div className={`shell stagger ${styles.stack}`}>
          <span className="eyebrow" data-reveal>
            현장 그라운드룰
          </span>
          <h2
            className={`display ${styles.title}`}
            id="principles-rules"
            data-reveal
          >
            안전은 기능이 아니라 전제다.
          </h2>
          <p className="lede" data-reveal>
            참고 구조는 트레바리 운영정책, 파이콘 한국, 위키미디어 안전 가이드다.
          </p>

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

      {/* ── 4. 행사 중 비공개 정보 (검정) ────────────────────── */}
      <section className="band band--dark" aria-labelledby="principles-hidden">
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
            경험을 못 말하게 하면 대화가 인위적 토론이 된다.
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
    </>
  );
}
