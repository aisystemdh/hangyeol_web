import Image from "next/image";
import Link from "next/link";
import { NAV, EVENT_HREF, EVENT_CTA_LABEL, SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* 바로 아래 .site-footer__brand가 "한결"을 텍스트로 읽어준다 → 여기는 장식 */}
        <Image
          src="/hangyeol-logo.png"
          alt=""
          width={351}
          height={489}
          className="site-footer__logo"
          data-reveal
        />
        <div className="site-footer__brand">
          {SITE.name} — {SITE.slogan}
        </div>

        <nav className="site-footer__nav" aria-label="푸터 메뉴">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href={EVENT_HREF}>{EVENT_CTA_LABEL}</Link>
        </nav>

        <div className="site-footer__people">{SITE.operators.join(" · ")}</div>
      </div>
    </footer>
  );
}
