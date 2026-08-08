import InstagramLink from "./InstagramLink";
import { EVENT } from "@/lib/event";
import { EVENT_CTA_LABEL } from "@/lib/site";

/**
 * 신청 전까지 스크롤 내내 따라오는 CTA.
 * 기본값은 /events/1 안에서 신청 폼(#apply)으로 바로 스크롤하는 용도지만,
 * href를 넘기면 그 대상으로 이동한다 — /·/mission·/why·/principles 같은
 * "판매 전 설명" 페이지에서는 EVENT_HREF(= /events/1)로 보낸다.
 *
 * 1:1 문의는 CTA **왼쪽**에 둔다. 오른쪽 끝은 엄지가 가장 닿기 쉬운 자리라
 * 주 행동(신청)이 차지해야 한다.
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
        <div className="sticky-bar__info">
          <div className="sticky-bar__price">
            {EVENT.priceLabel} · {EVENT.capacity}명
          </div>
          <div className="sticky-bar__meta">
            {EVENT.date} · {EVENT.place}
          </div>
        </div>

        <div className="sticky-bar__actions">
          <InstagramLink className="ig-link" />
          <a href={href} className="pill sticky-bar__cta">
            {label}
          </a>
        </div>
      </div>
    </div>
  );
}
