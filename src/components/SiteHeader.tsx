"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InstagramLink from "./InstagramLink";
import { NAV, EVENT_HREF, EVENT_CTA_LABEL, SITE } from "@/lib/site";
import s from "./SiteHeader.module.css";

/** `/mission`은 `/mission`과 `/mission/...` 모두에서 활성이다. */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 오버레이 안에서 Tab이 돌아야 할 요소들 */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const barRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 경로가 바뀌면 오버레이를 닫는다 (링크를 눌러 이동한 경우).
  // effect가 아니라 렌더 중 보정 — effect에서 setState하면 연쇄 렌더가 난다.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  /**
   * 열려 있는 동안: body 스크롤 잠금 · 오버레이 밖 전부 inert · 포커스 이동/복귀 · Tab 트랩.
   *
   * inert가 핵심이다. 오버레이는 불투명한 종이색 판이라, 뒤에 남은 링크가 포커스를 받으면
   * 포커스 링이 화면에 전혀 보이지 않는다(딥그린 밴드 안 링크가 특히 그렇다).
   * `<main>`·`<footer>`뿐 아니라 **헤더 상단 줄(barRef)** 도 꺼야 햄버거가 탭 순회에서 빠진다.
   * (오버레이 자신은 포털로 body에 있어 inert 대상 밖이다.)
   */
  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const burger = burgerRef.current;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const outside = [
      barRef.current,
      document.querySelector("main"),
      document.querySelector("footer"),
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);
    for (const el of outside) el.setAttribute("inert", "");

    closeRef.current?.focus();

    /* ⚠️ 회전 잠김 방지 — 메뉴를 연 채 화면을 돌려 768px를 넘으면 CSS가 오버레이를
       숨기는데(display:none) React는 그걸 모른다. 닫지 않으면 body 잠금과 inert가
       남아 페이지 전체가 죽는다. 실제 기기 가로 회전에서 재현됐던 결함이다. */
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onMq);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !overlay) return;
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && overlay.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      for (const el of outside) el.removeAttribute("inert");
      // 열기 전 위치로 포커스를 되돌린다. 데스크톱 폭에서는 햄버거가 숨어 있어
      // focus()가 아무 일도 하지 않는데, 그게 맞는 동작이다.
      burger?.focus();
    };
  }, [open]);

  return (
    <header className="site-header">
      {/* 배치는 왼쪽 로고 → 가운데 내비 → 오른쪽 CTA다. 각 칸이 grid-column을
          직접 들고 있어서, 모바일에서 .nav가 display:none이 돼도 나머지가 밀리지 않는다. */}
      <div className={s.inner} ref={barRef}>
        <div className={s.left}>
          {/* 글씨 없는 심볼 로고(scripts/make-mark.py가 원본에서 잘라낸 것).
              읽어줄 글자가 없으므로 alt는 비우고 링크에 aria-label로 이름을 준다 —
              둘 다 비우면 스크린리더에 "링크"로만 읽힌다. */}
          <Link href="/" className={s.brand} aria-label={`${SITE.name} 홈`}>
            <Image
              src="/hangyeol-mark-v2.png"
              alt=""
              width={297}
              height={266}
              className="site-header__logo"
              priority
              loading="eager"
            />
          </Link>
          {/* 로고와 별개의 명시적 홈 버튼 — 심볼만으로는 홈 링크임이 안 읽힌다는
              소유자 피드백(7차). 라벨은 "메인화면"(8차 확정 — "홈"에서 변경). */}
          <Link
            href="/"
            className={`${s.homeLink} ${pathname === "/" ? s.homeLinkActive : ""}`}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            메인화면
          </Link>
        </div>

        <nav className={s.nav} aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${s.navLink} ${active ? s.navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={s.right}>
          {/* CTA와 달리 모바일에서도 남긴다 — 하단 고정 바는 스크롤 120px 뒤에야
              올라오므로, 첫 화면에서 문의할 곳이 아예 없어지는 걸 막는다. */}
          <InstagramLink className="ig-link site-header__ig" />
          <Link
            href={EVENT_HREF}
            className={`pill site-header__cta ${s.ctaDesktop}`}
          >
            {EVENT_CTA_LABEL}
          </Link>
          <button
            type="button"
            ref={burgerRef}
            className={s.burger}
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen(true)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* ⚠️ 오버레이는 반드시 **포털로 body에** 렌더한다. 헤더 안에 두면
          헤더의 backdrop-filter가 fixed 자손의 컨테이닝 블록이 되어(Filter Effects 규격)
          inset:0이 뷰포트가 아니라 헤더 64px 박스가 된다 — 모바일 메뉴가 띠로 깨졌던
          실제 결함이다. 헤더가 만든 스태킹 컨텍스트(z:20)에 갇혀 하단 고정 바(z:30)가
          메뉴 위로 뚫고 나오는 문제도 함께 사라진다.
          open은 클라이언트 클릭에서만 true가 되므로 SSR 불일치가 없다. */}
      {open &&
        createPortal(
          <div
            id={menuId}
            ref={overlayRef}
            className={s.overlay}
            role="dialog"
            aria-modal="true"
            aria-label="주요 메뉴"
          >
            <div className={s.overlayTop}>
              <button
                type="button"
                ref={closeRef}
                className={s.close}
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <nav className={s.overlayNav} aria-label="주요 메뉴">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${s.overlayLink} ${active ? s.overlayLinkActive : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {active ? (
                      <span className={s.overlayDot} aria-hidden="true" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <Link
              href={EVENT_HREF}
              className={`pill ${s.overlayCta}`}
              onClick={() => setOpen(false)}
            >
              {EVENT_CTA_LABEL}
            </Link>
          </div>,
          document.body,
        )}
    </header>
  );
}
