import s from "./sectionHead.module.css";

/**
 * ⚠️ 2부 문구를 "답변이 가장 비슷한 상대와"로 되돌리지 말 것.
 *    실제 페어링은 최대유사 5쌍 + **최소유사 5쌍**이라 절반에게 사실이 아니다.
 *    참가비를 받는 페이지의 사실 주장은 표시광고법상 사업자가 실증해야 한다.
 *    (사회자 금지 발언에도 같은 이유로 못 박혀 있다.)
 */
const ROWS = [
  {
    time: "하루 전",
    title: "사전 질문",
    body: "10개 주제에 답하고, 당일 공개할 답변 하나를 고릅니다.",
  },
  {
    time: "18:10–20:00",
    title: "1부 · 너의 생각은?",
    body: "1:1 대화 10회. 답이 같으면 이유를 묻고, 다르면 어디까지 받아들일 수 있는지 이야기합니다.",
  },
  {
    // ⚠️ 20:00–20:30으로 되돌리지 말 것. 실제 2부 대화는 20:10~20:30이고
    //    20:00~20:10은 자기 서술 3분 + 자리 배정 7분이다(기획완성본 진행표).
    //    30분으로 적으면 20:30~20:32 2부 평가가 들어갈 자리도 사라진다.
    time: "20:10–20:30",
    title: "2부 · 너랑 비슷하다고?",
    body: "짧은 자기 서술을 남기고 자리를 옮깁니다. 사전 답변을 기준으로 배정된 상대와 20분 더 이야기하고, 두 사람이 어떻게 답했는지 비교표를 봅니다.",
  },
  {
    // 🔴 "3부 · 리포트 … PDF로 드립니다"로 되돌리지 말 것. 두 가지가 걸린다 —
    //    ① 당일 발급은 자기 서술 → 마스킹 → 2인 독립 코딩 → 집필을 거쳐야 하므로
    //       물리적으로 불가능하다. 참가비를 받는 페이지의 이행 불가 약속은
    //       표시광고법 노출이다(Gottman 90% 삭제와 같은 계열).
    //    ② "성향 리포트"는 리포트 본문("성향이 아니라 왜 그렇게 골랐는지")을 부정한다.
    //       표지 이름이 이미 「○○○님의 기록」이다.
    time: "20:30–21:00",
    title: "3부 · 마무리",
    body: "그날 스무 명의 답을 모은 집계를 함께 봅니다. 개인 기록은 닷새 뒤 PDF로 보내드립니다.",
  },
];

export default function Timeline() {
  return (
    <section className="band" aria-label="진행 순서">
      <div className="shell" style={{ display: "flex", flexDirection: "column", gap: 44 }}>
        <div className={s.head} data-reveal>
          <span className="eyebrow">진행 순서</span>
          <h2 className="display">
            당일은 이렇게 <span className={s.tail}>흘러갑니다</span>
          </h2>
        </div>
        {/* ⚠️ .timeline은 [data-line]의 부모다. PageEffects가 이 요소를 관찰해
            세로선을 발화시키므로 구조를 바꾸지 말 것. */}
        <div className="timeline stagger">
          <div className="timeline__line" data-line />
          {ROWS.map((r) => (
            <div key={r.time} className="timeline__row" data-reveal>
              <div className="timeline__time">{r.time}</div>
              <div className="timeline__body">
                <h3 className="timeline__title">{r.title}</h3>
                <p className="body-text">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
