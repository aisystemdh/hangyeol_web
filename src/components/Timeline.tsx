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
    time: "20:00–20:30",
    title: "2부 · 너랑 비슷하다고?",
    body: "사전 답변을 기준으로 배정된 상대와 20분 더 이야기하고, 두 사람이 어떻게 답했는지 비교표를 봅니다.",
  },
  {
    time: "20:30–21:00",
    title: "3부 · 리포트",
    body: "사전 답변으로 만든 성향 리포트를 PDF로 드립니다. 이후는 자유롭게.",
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
