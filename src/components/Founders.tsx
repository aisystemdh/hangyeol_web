import s from "./sectionHead.module.css";

const PEOPLE = ["이현우", "여동현"];

/** 두 번째 검정 밴드. `.two-col`은 `.shell`이 아니라서 세로 패딩을 직접 눌러야 한다. */
export default function Founders() {
  return (
    <section className="band band--dark" aria-label="운영자">
      <div className="two-col" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="founders__copy" data-reveal>
          <div className={s.head}>
            <span className="eyebrow">왜 만들었나</span>
            <h2 className="display">
              저희가
              <br />
              <span className={s.tail}>궁금했던 것</span>
            </h2>
          </div>
          {/* §2.1 — 우리가 겨누는 것은 사람도 업체도 아니라 오직 "설계"다.
              기존 포맷을 깎아내리는 문장은 틀렸을 뿐 아니라 전략적으로도 자해다. */}
          <p>
            기존 포맷은 나쁘게 만들어진 게 아니라 다른 목적에 맞게 잘
            만들어졌습니다. 그 목적은 “제한된 시간에 최대한 많은 이성을 만나게
            한다”입니다. 저희가 다르게 해보고 싶었던 것은 사람도 업체도 아니라
            오직 <b>설계</b>였습니다. 질문은 하나였습니다 —{" "}
            <b className="founders__q">생각이 같은 사람은 실제로도 잘 맞을까?</b>{" "}
            앱을 만들기 전에 그 질문을 오프라인에서 직접 확인해보기로 했고,
            이번이 그 첫 번째 자리입니다.
          </p>
        </div>
        <div className="founders__photos stagger">
          {PEOPLE.map((name) => (
            <div key={name} className="founders__person" data-reveal>
              {/* TODO: 사진 확보 후 next/image로 교체 */}
              <div className="founders__slot">{name} 사진</div>
              <div className="founders__name">
                {name} <span className="founders__role">기획 · 진행</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
