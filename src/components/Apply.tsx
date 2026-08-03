import ApplyForm from "./ApplyForm";
// SeatRow의 map 콜백이 `s`를 쓰므로 여기서는 `sh`로 받는다(섀도잉 방지)
import sh from "./sectionHead.module.css";
import { EVENT, SEATS } from "@/lib/event";

/** 남은 수만큼 왼쪽부터 잉크색으로 채운다. */
function seats(total: number, left: number) {
  const n = Math.max(0, Math.min(total, left));
  return Array.from({ length: total }, (_, i) => ({
    fill: i < n ? "var(--ink)" : "transparent",
    delay: `${(0.05 * i).toFixed(2)}s`,
  }));
}

function SeatRow({ label, left }: { label: string; left: number }) {
  return (
    <div className="seats__row">
      <div className="seats__label">{label}</div>
      <div className="seats__track">
        {seats(EVENT.capacityPerGender, left).map((s, i) => (
          <div key={i} className="seats__cell">
            <div
              className="seats__fill"
              data-bar
              style={{ transitionDelay: s.delay, background: s.fill }}
            />
          </div>
        ))}
      </div>
      <div className="seats__count">{left}자리</div>
    </div>
  );
}

/**
 * 신청. 밴드 교차상 검정 차례지만 **반드시 흰 밴드**다 —
 * 입력 필드(.input/.gender__btn)가 흰 배경 고정이라 검정 위에서는 대비가 무너진다.
 */
export default function Apply() {
  return (
    <section className="band apply" id="apply" aria-label="신청">
      <div className="apply__grid" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="apply__left stagger">
          <div className={sh.head} data-reveal>
            <span className="eyebrow">신청</span>
            <h2 className="display">1차 모임</h2>
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
              <dd>
                만 {EVENT.ageMin} – {EVENT.ageMax}세
              </dd>
            </div>
          </dl>

          {/* ⚠️ .seats__cell이 [data-bar]의 부모다 — PageEffects가 그 부모를 관찰한다 */}
          <div className="seats" data-reveal>
            <div className="seats__title">남은 자리</div>
            <div className="seats__rows">
              <SeatRow label="남" left={SEATS.menLeft} />
              <SeatRow label="여" left={SEATS.womenLeft} />
            </div>
          </div>
        </div>

        <div className="apply__right" data-reveal style={{ transitionDelay: ".12s" }}>
          <ApplyForm />

          <details className="rules">
            <summary>
              참가 조건 · 금지 사항 보기<span className="plus">+</span>
            </summary>
            <div data-answer>
              <p>
                만 {EVENT.ageMin}–{EVENT.ageMax}세, 미혼. 행사 중에는
                실명·직업·연락처를 묻지 않으며, 다른 참가자의 정보를 캐묻거나
                촬영·녹음하는 행위, 상대가 불편해하는 신체 접촉, 상업적 권유는
                금지합니다. 어길 경우 즉시 퇴장이며 환불되지 않습니다.
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
