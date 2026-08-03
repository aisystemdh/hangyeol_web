"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
   * inert가 핵심이다. 오버레이는 불투명한 흰 판이라, 뒤에 남은 링크가 포커스를 받으면
   * 포커스 링이 화면에 전혀 보이지 않는다(검정 밴드 안 링크가 특히 그렇다).
   * `<main>`·`<footer>`뿐 아니라 **헤더 상단 줄(barRef)** 도 꺼야 한다 —
   * 오버레이가 헤더 안에 있어서 햄버거 버튼이 그대로 탭 순회에 남기 때문이다.
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
      for (const el of outside) el.removeAttribute("inert");
      // 열기 전 위치로 포커스를 되돌린다. 데스크톱 폭에서는 햄버거가 숨어 있어
      // focus()가 아무 일도 하지 않는데, 그게 맞는 동작이다.
      burger?.focus();
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className={s.inner} ref={barRef}>
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

        <Link href="/" className={s.brand} aria-label={`${SITE.name} 홈`}>
          <Image
            src="/hangyeol-logo.png"
            alt=""
            width={351}
            height={489}
            className="site-header__logo"
            priority
            loading="eager"
          />
          <span className="site-header__wordmark">{SITE.name}</span>
        </Link>

        <div className={s.right}>
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

      <div
        id={menuId}
        ref={overlayRef}
        className={s.overlay}
        hidden={!open}
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
                {active ? <span className={s.overlayDot} aria-hidden="true" /> : null}
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
      </div>
    </header>
  );
}
