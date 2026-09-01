import type { Metadata } from "next";
import Hero from "@/components/Hero";
import Identity from "@/components/Identity";
import Timeline from "@/components/Timeline";
import Founders from "@/components/Founders";
import Apply from "@/components/Apply";
import Faq from "@/components/Faq";
import StickyBar from "@/components/StickyBar";
import { EVENT_HREF, SITE, SITE_URL } from "@/lib/site";
import { EVENT, EVENT_SCHEMA } from "@/lib/event";

/** layout의 template가 " — 한결"을 붙인다. 브랜드명을 또 쓰지 말 것. */
export const metadata: Metadata = {
  title: "1차 오프라인 모임",
  alternates: { canonical: EVENT_HREF },
};

/**
 * 행사 구조화 데이터. 루트 레이아웃에는 `Organization`만 있고 `Event`는 여기에만 둔다 —
 * 모든 페이지가 같은 행사를 주장하면 안 되기 때문이다.
 *
 * 🔴 **날짜·시각·정원·금액을 여기에 직접 쓰지 말 것.** 전부 `@/lib/event`에서 온다.
 *    구글은 이 값으로 검색 카드를 그리므로, 화면과 어긋나면 그때는 "광고와 실제가 다르다"가
 *    사이트 문구가 아니라 **우리가 직접 신고한 데이터** 문제가 된다.
 *
 * ⚠️ `location`에 정확한 주소를 쓰지 않는다 — 장소는 신청자에게만 개별 안내하기로 한
 *    운영 원칙이라(`EVENT.placeNote`) 공개 데이터에 상세 주소를 넣으면 그 원칙이 깨진다.
 *    행정구역(서울 마포구 합정)까지만 적는다. 지어낸 주소를 채우는 것보다 낫다.
 */
const EVENT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: `${SITE.name} 1차 오프라인 모임`,
  description: `답이 아니라 이유를 묻는 오프라인 대화 모임. ${EVENT.place}, ${EVENT.capacity}명, ${EVENT.priceLabel}.`,
  url: new URL(EVENT_HREF, SITE_URL).toString(),
  image: new URL("/og-v2.png", SITE_URL).toString(),
  startDate: EVENT_SCHEMA.startISO,
  endDate: EVENT_SCHEMA.endISO,
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: EVENT.place,
    address: {
      "@type": "PostalAddress",
      addressLocality: "마포구 합정동",
      addressRegion: "서울",
      addressCountry: "KR",
    },
  },
  organizer: {
    "@type": "Organization",
    name: SITE.name,
    url: SITE_URL,
  },
  maximumAttendeeCapacity: EVENT.capacity,
  typicalAgeRange: `${EVENT.ageMin}-${EVENT.ageMax}`,
  offers: {
    "@type": "Offer",
    price: EVENT_SCHEMA.priceKRW,
    priceCurrency: "KRW",
    availability: "https://schema.org/InStock",
    url: new URL(EVENT_HREF, SITE_URL).toString(),
  },
};

/**
 * 1차 모임 랜딩. SiteHeader / Footer / PageEffects는 app/layout.tsx에 있다.
 * StickyBar는 행사 전용이라 이 페이지에만 있고,
 * paddingBottom 88px은 그 고정 바에 마지막 섹션이 가리지 않게 하는 여백이다.
 *
 * 밴드 교차: 히어로(흰) → 정체성(검정) → 진행(흰) → 운영자(검정) → 신청(흰) → FAQ(검정).
 * 신청은 입력 필드 대비 때문에 반드시 흰 밴드다.
 */
export default function EventOnePage() {
  return (
    <div style={{ overflowX: "hidden", paddingBottom: 88 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(EVENT_JSONLD) }}
      />
      <Hero />
      <Identity />
      <Timeline />
      <Founders />
      <Apply />
      <Faq />
      <StickyBar />
    </div>
  );
}
