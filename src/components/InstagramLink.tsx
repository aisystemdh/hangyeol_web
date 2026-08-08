import { CONTACT } from "@/lib/site";

/**
 * "1:1 문의" + 인스타그램 마크. **헤더와 하단 고정 바가 같은 것을 쓴다** —
 * 아이콘 SVG를 두 곳에 복사해 두면 한쪽만 고쳐져 갈라진다.
 *
 * 문구와 아이콘이 한 링크다. 누를 면적이 넓어지고, 화면에 보이는 글자가 그대로
 * 링크 이름이 된다(WCAG 2.5.3 Label in Name) — 그래서 aria-label로 덮어쓰지 않고
 * sr-only로 목적지와 새 창 여는 사실만 덧붙인다.
 *
 * `CONTACT.instagram`이 비어 있으면 아무것도 그리지 않는다.
 */
export default function InstagramLink({ className }: { className?: string }) {
  if (!CONTACT.instagram) return null;

  return (
    <a
      href={CONTACT.instagram}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      1:1 문의
      {/* 인스타그램 마크: 둥근 사각형 + 렌즈 원 + 오른쪽 위 점 */}
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      <span className="sr-only">한결 인스타그램, 새 창에서 열림</span>
    </a>
  );
}
