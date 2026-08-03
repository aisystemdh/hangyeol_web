"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 핸드오프 원본의 `DCLogic.componentDidMount`를 옮긴 것.
 * 렌더 결과가 없는 부수효과 전용 컴포넌트다.
 *
 * - 스크롤 리빌 옵저버 2개
 * - scrollY > 120 → <html data-scrolled> (헤더 축소·하단 바 등장은 CSS가 처리)
 * - 앵커 부드러운 이동 (헤더 높이 보정)
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
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute("data-in", "");
          reveal.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
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
      { rootMargin: "0px 0px -6% 0px", threshold: 0 },
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

    // scrollIntoView는 헤더 높이를 보정할 수 없어 쓰지 않는다
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      ev.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 56;
      window.scrollTo({ top, behavior: "smooth" });
    };
    document.addEventListener("click", onClick);

    return () => {
      reveal.disconnect();
      bars.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      root.removeAttribute("data-scrolled");
    };
  }, [pathname]);

  return null;
}
