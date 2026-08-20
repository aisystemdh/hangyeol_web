"use client";

import Script from "next/script";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

/**
 * 계측 스크립트 묶음. layout.tsx에 한 줄로 붙이기 위해 하나로 모았다.
 *
 * **Vercel Analytics** — 방문 수·유입경로·페이지별 조회. 자사 도메인에서 서빙되어
 * 광고 차단기를 거의 타지 않는다. Vercel 대시보드에서 프로젝트의 Web Analytics를
 * **켜야** 값이 쌓인다(코드만 넣으면 아무 일도 일어나지 않는다).
 *
 * **Meta 픽셀** — `NEXT_PUBLIC_META_PIXEL_ID`가 비어 있으면 아예 로드하지 않는다.
 * 신청 폼과 같은 원칙이다: 보낼 곳이 없는데 보내는 척하지 않는다.
 * 지금 심는 이유는 리타겟팅 모수가 **소급되지 않기** 때문이다 — 광고를 나중에
 * 켜더라도 모수는 오늘부터 쌓여야 한다.
 *
 * strategy="afterInteractive": 페이지가 상호작용 가능해진 뒤 로드한다.
 * beforeInteractive로 올리면 렌더를 막아 LCP를 직접 깎는데, 계측은
 * 그만한 우선순위가 아니다.
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function Analytics() {
  return (
    <>
      <VercelAnalytics />
      {PIXEL_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
          </Script>
          {/* JS가 꺼진 브라우저용 폴백. 광고 관리자가 이 픽셀을 "활성"으로 인식하는 데도 쓰인다. */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
