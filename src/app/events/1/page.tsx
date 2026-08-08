import type { Metadata } from "next";
import Hero from "@/components/Hero";
import Identity from "@/components/Identity";
import Timeline from "@/components/Timeline";
import Founders from "@/components/Founders";
import Apply from "@/components/Apply";
import Faq from "@/components/Faq";
import StickyBar from "@/components/StickyBar";
import { EVENT_HREF } from "@/lib/site";

/** layout의 template가 " — 한결"을 붙인다. 브랜드명을 또 쓰지 말 것. */
export const metadata: Metadata = {
  title: "1차 오프라인 모임",
  alternates: { canonical: EVENT_HREF },
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
