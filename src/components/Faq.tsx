import s from "./sectionHead.module.css";
import { AGE_RANGE, EVENT, REFUND } from "@/lib/event";

const QA = [
  {
    q: "누가 오나요?",
    a: `${AGE_RANGE} 남녀 각 ${EVENT.capacityPerGender}명. 전원이 직접 신청하고 참가비를 직접 낸 분들입니다. 섭외한 참가자나 무료 초대 게스트는 없습니다.`,
  },
  {
    q: "안전한가요? 어떻게 확인하나요?",
    // 공간을 통째로 빌린다는 것은 확정 사실이다(소유자 확인, 2026-08).
    // 확정이 아닌 조건은 이 답변에 쓰지 않는다 — 지킬 수 없는 약속은 하지 않는다.
    a: "신청 시 신분증으로 나이를 확인하고, 확인이 끝나면 사본은 보관하지 않습니다. 행사 시간 동안 공간을 통째로 빌리기 때문에 모르는 손님과 섞이거나 대화가 옆자리에 들릴 일이 없습니다. 운영자 두 명이 현장에 상주하며 진행하고, 대화는 정해진 순서대로만 이루어집니다. 행사 중 연락처 교환은 강요되지 않습니다.",
  },
  {
    q: "술을 마시나요?",
    a: "아니요. 술은 두지 않습니다. 차와 간단한 다과만 준비되어 있고, 세 시간 내내 대화에만 집중하는 자리입니다.",
  },
  {
    q: "혼자 가도 괜찮나요?",
    a: `${EVENT.capacity}명 전원이 혼자 옵니다. 자리와 순서가 미리 정해져 있어 먼저 말을 걸어야 하는 부담도 없습니다.`,
  },
];

/** 마지막 검정 밴드. 아래로 흰 푸터가 이어지며 페이지가 닫힌다. */
export default function Faq() {
  return (
    <section className="band band--dark" aria-label="자주 묻는 질문">
      <div className="shell" style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div className={s.head} data-reveal>
          <span className="eyebrow">마지막으로</span>
          <h2 className="display">
            자주 묻는 <span className={s.tail}>질문</span>
          </h2>
        </div>

        <div className="faq__list stagger">
          {QA.map((item) => (
            <details key={item.q} className="faq__item" data-reveal>
              <summary className="faq__q">
                {item.q}
                <span className="plus">+</span>
              </summary>
              <div data-answer>
                <p className="faq__a">{item.a}</p>
              </div>
            </details>
          ))}

          {/* 환불 규정 — 7차부터 다른 문답과 같은 접이식이다(소유자 결정).
              내용 자체는 REFUND 한 곳에서 온다 — 규정을 숨기는 게 아니라 형식만 통일. */}
          <details className="faq__item" data-reveal>
            <summary className="faq__q">
              환불이 되나요?
              <span className="plus">+</span>
            </summary>
            <div data-answer>
              <div className="refund__rows">
                {REFUND.map((r, i) => (
                  <div key={r.when} className="refund__row">
                    <span className="refund__when">{r.when}</span>
                    {/* 마지막 줄(환불 불가)만 톤을 낮춘다 — 강조하면 협박문이 된다 */}
                    <span
                      style={
                        i === REFUND.length - 1
                          ? { color: "var(--mute)" }
                          : undefined
                      }
                    >
                      {r.what}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
