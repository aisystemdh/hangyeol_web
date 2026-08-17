import Image from "next/image";
import Link from "next/link";
import { CONTACT, EVENT_HREF, EVENT_CTA_LABEL, NAV, SITE } from "@/lib/site";

/**
 * 채워진 문의 채널만 골라 링크로 만든다.
 * 비어 있는 항목은 줄 자체를 그리지 않는다 — 깨진 링크를 내보내지 않기 위해서다.
 */
const CHANNELS = [
  { label: "인스타그램", href: CONTACT.instagram },
  { label: "카카오톡 문의", href: CONTACT.kakao },
  { label: CONTACT.email, href: CONTACT.email ? `mailto:${CONTACT.email}` : "" },
  {
    label: CONTACT.phone,
    // tel: 링크는 숫자와 +만 받는다. 화면에는 하이픈이 있는 원본을 그대로 보여준다.
    href: CONTACT.phone ? `tel:${CONTACT.phone.replace(/[^0-9+]/g, "")}` : "",
  },
].filter((c) => c.href);

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* 바로 아래 .site-footer__brand가 "한결"을 텍스트로 읽어준다 → 여기는 장식 */}
        <Image
          src="/hangyeol-logo-v2.png"
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

        <div className="site-footer__people">
          {SITE.operators.map((o) => o.name).join(" · ")}
        </div>

        {CHANNELS.length > 0 && (
          <nav className="site-footer__contact" aria-label="문의">
            {CHANNELS.map((c) => (
              <a key={c.label} href={c.href}>
                {c.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}
