"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FunnelStage, SourceCount } from "@/lib/admin-marketing";
import st from "../admin.module.css";

/**
 * 마케팅 탭 화면 (이슈 #41). `Dashboard`(#34)와 같은 패턴 — 서버가 첫 데이터를
 * 넘기고 30초마다 갱신한다(`docs/decisions/003…` §7). 이 화면은 조작이 없는
 * 읽기 전용이라(고르는 값도, 상태를 바꾸는 버튼도 없다) "조작하는 사람" 선택칸이
 * 필요 없다 — `Dashboard`의 actor 패턴을 그대로 옮기지 않은 이유가 그것이다.
 */
export default function MarketingBoard({
  initialSources,
  initialFunnel,
}: {
  initialSources: SourceCount[];
  initialFunnel: FunnelStage[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [funnel, setFunnel] = useState(initialFunnel);
  // 🔴 (이슈 #54) 취소된 신청을 퍼널·유입경로 집계에 포함할지 — 서버 기본은 뺀다.
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * 🔴 코드리뷰(2026-09-06) — 요청 순서를 지키지 않으면, 토글을 빠르게 두 번
   *    누를 때 **늦게 도착한 응답이 나중 것을 덮어쓸 수 있다**(취소 포함으로
   *    바꿨다가 바로 되돌렸는데, 포함 응답이 더 늦게 와서 화면이 체크박스와
   *    다른 숫자를 보여준다). 매 호출마다 번호를 매기고, 그사이 더 최신 호출이
   *    나갔으면 이 응답은 버린다.
   */
  const requestSeq = useRef(0);

  const load = useCallback(async (withCancelled: boolean) => {
    const seq = (requestSeq.current += 1);
    try {
      const r = await fetch(`/api/admin/marketing${withCancelled ? "?includeCancelled=1" : ""}`);
      if (r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const j = (await r.json()) as {
        data?: { sources: SourceCount[]; funnel: FunnelStage[] };
      };
      if (seq !== requestSeq.current) return; // 그사이 더 최신 요청이 나갔다 — 이 응답은 버린다.
      if (j.data) {
        setSources(j.data.sources);
        setFunnel(j.data.funnel);
        setLoadError(null);
      }
    } catch {
      if (seq === requestSeq.current) setLoadError("새로고침 실패. 다시 시도해주세요.");
    }
  }, []);

  useEffect(() => {
    // ⚠️ 첫 데이터는 서버가 이미 넘겼다(취소 제외 기본값). 여기서 또 부르지 않고
    //    30초 뒤부터, 지금 고른 토글 값 그대로 갱신한다.
    const t = setInterval(() => load(includeCancelled), 30_000);
    return () => clearInterval(t);
  }, [load, includeCancelled]);

  const toggleIncludeCancelled = () => {
    const next = !includeCancelled;
    setIncludeCancelled(next);
    load(next);
  };

  const totalSourced = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <>
      <header className={st.head}>
        <h1 className={st.h1}>마케팅 — 유입과 퍼널</h1>
        <label className={st.loginNote}>
          <input
            type="checkbox"
            checked={includeCancelled}
            onChange={toggleIncludeCancelled}
          />{" "}
          취소된 신청 포함
        </label>
        <button className={st.tab} onClick={() => load(includeCancelled)}>
          새로고침
        </button>
        {loadError && <span className={st.err}>{loadError}</span>}
      </header>

      <section>
        <h2 className={st.sectionTitle}>퍼널 — 신청 → 정식등록 → 입금 → 사전질문</h2>
        {/* 🔴 각 칸의 비율은 항상 1단계(신청) 대비다 — 단계마다 분모가 바뀌면
            "정식등록 대비 입금 몇 %"인지 사람마다 다르게 계산하게 된다. */}
        <div className={st.counters}>
          {funnel.map((stage, i) => (
            <div key={stage.key} className={i === 0 ? st.cardHi : st.card}>
              <div className={st.cardLabel}>{stage.key}</div>
              <div className={st.cardNum}>
                {stage.count}명
                {i > 0 && (
                  <>
                    <span className={st.sep}>·</span>
                    {stage.rate}%
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={st.sectionTitle}>유입 경로별 신청 수</h2>
        <div className={st.tableWrap}>
          <table className={st.table}>
            <thead>
              <tr>
                <th>유입 경로</th>
                <th>신청 수</th>
                <th>비율</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td className={st.mono}>{s.count}</td>
                  <td className={st.mono}>
                    {totalSourced === 0
                      ? "—"
                      : `${Math.round((s.count / totalSourced) * 1000) / 10}%`}
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={3} className={st.empty}>
                    아직 신청이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
