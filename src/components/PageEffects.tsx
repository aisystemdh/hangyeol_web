"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 핸드오프 원본의 `DCLogic.componentDidMount`를 옮긴 것.
 * 렌더 결과가 없는 부수효과 전용 컴포넌트다.
 *
 * - 스크롤 리빌 옵저버 2개
 * - scrollY > 120 → <html data-scrolled> (헤더 축소·하단 바 등장은 CSS가 처리)
 *
 * 앵커 이동은 이제 JS가 하지 않는다 — globals.css의
 * `scroll-behavior: smooth` + `scroll-padding-top: calc(var(--header-h) + 8px)`이
 * fragment 이동에도 적용되므로 수동 보정(-56px 하드코딩)이 필요 없어졌다.
 * 예전엔 56/60/72px 세 값이 흩어져 앵커마다 대상이 헤더에 몇 px씩 가려졌다.
 *
 * ⚠️ 의존성 배열에 pathname이 들어 있는 이유:
 *   이 컴포넌트는 layout에 있어 클라이언트 라우팅 중에 언마운트되지 않는다.
 *   []로 두면 마운트 시점의 DOM만 querySelectorAll하므로 이동한 페이지의
 *   [data-reveal]은 영원히 발화하지 않는다. 경로가 바뀔 때마다 옵저버를
 *   버리고 다시 스캔한다.
 */
export default function PageEffects() {
  const pathname = usePathname();

  useEffect(() => {
    // rootMargin 하단을 양수로 두면 뷰포트 아래쪽 밖에서부터 미리 교차 판정이
    // 나서, 평소 스크롤 속도로는 요소가 화면에 보이기 전에 리빌이 끝나 있다.
    // 이전 값(-8%)은 요소가 화면에 상당히 들어온 뒤에야 발화해, 빠르게 스크롤하면
    // 옅은 회색 중간 상태로 텍스트를 읽는 경우가 많았다.
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute("data-in", "");
          reveal.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px 20% 0px", threshold: 0.01 },
    );

    // 막대·선은 시작 상태가 scaleX(0)/scaleY(0)이라 면적이 0 → 자기 자신을
    // 관찰하면 절대 교차하지 않는다. 그래서 부모를 관찰한다.
    const bars = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target
            .querySelectorAll("[data-bar],[data-line]")
            .forEach((el) => el.setAttribute("data-in", ""));
          if (e.target.matches("[data-bar],[data-line]")) {
            e.target.setAttribute("data-in", "");
          }
          bars.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px 10% 0px", threshold: 0 },
    );

    document
      .querySelectorAll("[data-reveal]:not([data-in])")
      .forEach((el) => reveal.observe(el));
    document
      .querySelectorAll("[data-bar]:not([data-in]),[data-line]:not([data-in])")
      .forEach((el) => bars.observe(el.parentElement ?? el));

    const root = document.documentElement;
    const onScroll = () => {
      const y = window.scrollY || root.scrollTop || 0;
      if (y > 120) root.setAttribute("data-scrolled", "");
      else root.removeAttribute("data-scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      reveal.disconnect();
      bars.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-scrolled");
    };
  }, [pathname]);

  return null;
}
