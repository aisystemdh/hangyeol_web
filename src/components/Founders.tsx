import s from "./sectionHead.module.css";
import { SITE } from "@/lib/site";

/**
 * 두 번째 검정 밴드.
 *
 * ⚠️ 사진 자리는 없앴다. 확보되지 않은 사진을 점선 상자로 비워두는 것보다
 *    이름과 직함만 두는 편이 낫다. 사진이 생기면 옛 마크업을 되살리지 말고
 *    `next/image`로 새로 짤 것.
 *    사진이 빠지면서 2열 레이아웃이 필요 없어져 `.shell`로 갈아탔다 —
 *    `.band > .shell`이 세로 패딩을 0으로 눌러주므로 인라인 style이 필요 없다.
 */
export default function Founders() {
  return (
    <section className="band band--dark" aria-label="운영자">
      <div className="shell">
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

        <ul className="founders__people stagger">
          {SITE.operators.map(({ name, role }) => (
            <li key={name} className="founders__person" data-reveal>
              <span className="founders__name">{name}</span>
              <span className="founders__role">{role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
