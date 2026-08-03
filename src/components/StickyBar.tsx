import { EVENT } from "@/lib/event";

export default function StickyBar() {
  return (
    <div className="sticky-bar">
      <div className="sticky-bar__inner">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="sticky-bar__price">
            {EVENT.priceLabel} · {EVENT.capacity}명
          </div>
          <div className="sticky-bar__meta">
            {EVENT.date} · {EVENT.place}
          </div>
        </div>
        <a href="#apply" className="pill sticky-bar__cta">
          신청하기
        </a>
      </div>
    </div>
  );
}
