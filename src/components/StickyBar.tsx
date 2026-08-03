import { EVENT } from "@/lib/event";
import { EVENT_CTA_LABEL } from "@/lib/site";

/**
 * 신청 전까지 스크롤 내내 따라오는 CTA.
 * 기본값은 /events/1 안에서 신청 폼(#apply)으로 바로 스크롤하는 용도지만,
 * href를 넘기면 그 대상으로 이동한다 — /·/mission·/why·/principles 같은
 * "판매 전 설명" 페이지에서는 EVENT_HREF(= /events/1)로 보낸다.
 * 지금까지는 이 바가 /events/1에만 있어서, 다른 페이지를 읽는 동안은
 * 전환 지점을 찾으려면 끝까지 스크롤하거나 헤더 메뉴를 열어야 했다.
 */
export default function StickyBar({
  href = "#apply",
  label = EVENT_CTA_LABEL,
}: {
  href?: string;
  label?: string;
}) {
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
        <a href={href} className="pill sticky-bar__cta">
          {label}
        </a>
      </div>
    </div>
  );
}
