"use client";

import { useEffect, useState } from "react";

type Status = {
  phase: "hidden" | "counting" | "closed" | "unknown";
  message: string;
};

/**
 * 정보표의 「모집 현황」 한 줄.
 *
 * ⚠️ 이 페이지는 정적으로 만들어져 CDN에서 그대로 나간다. 숫자를 서버 렌더에 섞으면
 *    페이지 전체가 매번 서버를 타야 해서 느려진다. 그래서 이 한 줄만 클라이언트에서
 *    따로 가져온다.
 *
 * 🔴 값을 못 가져오면 **줄 자체를 그리지 않는다.** 예전 「남은 자리」 막대는 손으로
 *    갱신해야 해서, 갱신을 놓치면 신청이 들어와도 계속 만석으로 보였다 —
 *    거짓 정보가 되느니 아무 말도 하지 않는 편이 낫다.
 */
export default function RecruitStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/recruit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => {
        if (alive && d && d.message) setStatus(d);
      })
      .catch(() => {
        /* 조용히 넘어간다 — 위 주석 참조 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!status) return null;

  return (
    <div className="facts__row">
      <dt>모집 현황</dt>
      <dd>
        {status.message}
        {status.phase === "closed" && (
          <span className="facts__note"> — 자리가 나면 순서대로 안내드립니다</span>
        )}
      </dd>
    </div>
  );
}
