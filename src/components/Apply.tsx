import ApplyForm from "./ApplyForm";
import sh from "./sectionHead.module.css";
import { AGE_RANGE, EVENT } from "@/lib/event";

/**
 * 신청. 밴드 교차상 검정 차례지만 **반드시 흰 밴드**다 —
 * 입력 필드(.input/.gender__btn)가 흰 배경 고정이라 검정 위에서는 대비가 무너진다.
 *
 * ⚠️ "남은 자리" 막대는 없앴다. 폼 백엔드에 잔여석 API가 없어 손으로 고쳐야 했는데,
 *    갱신을 놓치면 신청이 들어와도 계속 만석으로 보여 거짓 정보가 된다.
 *    되살리려면 서버에서 실제 신청 수를 읽어 올 수단부터 만들 것.
 */
export default function Apply() {
  return (
    <section className="band apply" id="apply" aria-label="신청">
      <div className="apply__grid" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="apply__left stagger">
          <div className={sh.head} data-reveal>
            <span className="eyebrow">신청</span>
            <h2 className="display">1차</h2>
          </div>

          <dl className="facts" data-reveal>
            <div className="facts__row">
              <dt>일시</dt>
              <dd>
                {EVENT.date} · {EVENT.time}{" "}
                <span className="facts__note">({EVENT.doorsOpen})</span>
              </dd>
            </div>
            <div className="facts__row">
              <dt>장소</dt>
              <dd>
                {EVENT.place}{" "}
                <span className="facts__note">({EVENT.placeNote})</span>
              </dd>
            </div>
            <div className="facts__row">
              <dt>정원</dt>
              <dd>
                {EVENT.capacity}명 — 남 {EVENT.capacityPerGender} · 여{" "}
                {EVENT.capacityPerGender}
              </dd>
            </div>
            <div className="facts__row">
              <dt>참가비</dt>
              <dd>
                {EVENT.priceLabel}{" "}
                <span className="facts__note">— {EVENT.priceNote}</span>
              </dd>
            </div>
            <div className="facts__row">
              <dt>참가 조건</dt>
              <dd>{AGE_RANGE}</dd>
            </div>
          </dl>
        </div>

        <div className="apply__right" data-reveal style={{ transitionDelay: ".12s" }}>
          <ApplyForm />

          <details className="rules">
            <summary>
              참가 조건 · 금지 사항 보기<span className="plus">+</span>
            </summary>
            <div data-answer>
              <p>
                {AGE_RANGE}, 미혼. 행사 중에는 실명·직업·연락처를 묻지 않으며,
                다른 참가자의 정보를 캐묻거나 촬영·녹음하는 행위, 상대가
                불편해하는 신체 접촉, 상업적 권유는 금지합니다. 어길 경우 즉시
                퇴장이며 환불되지 않습니다.
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
