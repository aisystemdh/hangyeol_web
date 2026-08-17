"use client";

import { useEffect, useState } from "react";
import s from "./FunnelNav.module.css";

export type FunnelItem = { id: string; label: string };

/**
 * 홈 퍼널 전용 진행 표시.
 *
 * - 데스크톱: 우측 고정 점 레일 + 현재 구간 라벨. 실제 앵커 링크라 클릭·키보드로
 *   구간 점프가 되고, 이동 자체는 CSS(scroll-behavior + scroll-padding)가 처리한다.
 * - 모바일(767px 이하): 헤더 바로 아래 2px 진행 바. 별도 스크롤 리스너 없이
 *   레일과 **같은 IntersectionObserver의 활성 인덱스**로 계단식 진행을 그린다 —
 *   진행률의 진실이 두 개면 어긋난다.
 *
 * rootMargin -45%/-45%는 "뷰포트 중앙 10% 밴드에 걸린 화면"을 활성으로 판정한다.
 * (-50%/-50%의 0높이 밴드는 경계 순간 판정이 브라우저마다 흔들린다.)
 *
 * PageEffects와 합치지 않는다 — 그쪽은 layout 소속 전역 장치(경로마다 재스캔)고,
 * 이건 홈 전용 + 언마운트 시 자동 정리되는 페이지 장치다. rootMargin도 다르다.
 */
export default function FunnelNav({ items }: { items: readonly FunnelItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const index = Math.max(
    0,
    items.findIndex((i) => i.id === active),
  );

  return (
    <>
      <nav className={s.rail} aria-label="홈 구간 이동">
        <ol className={s.list}>
          {items.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={s.link}
                aria-current={active === id ? "true" : undefined}
              >
                {/* 라벨은 평소 투명하지만 DOM에는 항상 있다 — 스크린리더가 읽는다 */}
                <span className={s.label}>{label}</span>
                <span className={s.dot} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={s.progress} aria-hidden="true">
        <span
          className={s.progressFill}
          style={{ transform: `scaleX(${(index + 1) / items.length})` }}
        />
      </div>
    </>
  );
}
