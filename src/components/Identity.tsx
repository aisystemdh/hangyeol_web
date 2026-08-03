import type { ReactNode } from "react";
import s from "./sectionHead.module.css";
import { EVENT } from "@/lib/event";

const CARDS: { num: string; title: string; body: ReactNode }[] = [
  {
    num: "01",
    title: "외모가 아니라 생각을 먼저 봅니다",
    body: "신청하시면 10개 주제의 질문을 보내드립니다. 하루 전까지 답해주시면, 당일 대화는 그 답변에서 시작합니다.",
  },
  {
    num: "02",
    title: "실명도 직업도 묻지 않습니다",
    body: "이름, 나이, 학교, 회사, 사는 동네, SNS, 연락처. 행사 중에는 전부 비공개입니다. 남는 건 생각뿐입니다.",
  },
  {
    num: "03",
    title: `${EVENT.capacity}명 모두 같은 값을 냈습니다`,
    body: (
      <>
        남녀 구분 없이{" "}
        <span className="mark">
          <span>{EVENT.priceLabel} 단일가</span>
        </span>
        . 무료 초대 게스트 0명, 섭외된 참가자 0명. 자리에 있는 전원이 직접
        신청하고 직접 낸 사람입니다.
      </>
    ),
  },
];

/** 밴드 교차의 첫 검정. 카드 배경(--tint)과 형광펜(--hl-bar-body)은 자동 반전된다. */
export default function Identity() {
  return (
    <section className="band band--dark" aria-label="정체성 3가지">
      <div className="shell" style={{ display: "flex", flexDirection: "column", gap: 52 }}>
        <div className={s.head} data-reveal>
          {/* 아래 h2 꼬리와 글자가 겹치지 않도록 라벨은 다른 말을 쓴다 */}
          <span className="eyebrow">정체성</span>
          <h2 className="display" style={{ maxWidth: "16em" }}>
            여느 소개팅 자리와 <span className={s.tail}>무엇이 다른가</span>
          </h2>
        </div>
        <div className="identity__grid stagger">
          {CARDS.map((c) => (
            <div key={c.num} className="card" data-reveal>
              <div className="card__num">{c.num}</div>
              <h3 className="card__title">{c.title}</h3>
              <p className="body-text">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
