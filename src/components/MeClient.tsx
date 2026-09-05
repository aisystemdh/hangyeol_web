"use client";

import { useEffect, useState } from "react";
import type { MeApiResponse, MeData } from "@/lib/me-response";
import s from "./Me.module.css";
import MeCancelled from "./MeCancelled";
import MeConfirmed from "./MeConfirmed";
import MeEnded from "./MeEnded";
import MeEventDay from "./MeEventDay";
import MeNotFound from "./MeNotFound";
import MePayment from "./MePayment";
import MeQuestions from "./MeQuestions";
import MeRegister from "./MeRegister";
import MeWaitlisted from "./MeWaitlisted";

/**
 * `/me/[token]` 화면 전체를 구동한다.
 *
 * 🔴 **여기가 서버 컴포넌트가 아니라 클라이언트 컴포넌트인 이유가 이 파일의 이유다**
 *    (이슈 #32). 화면 판정과 문항 조회를 서버 컴포넌트(`page.tsx`)가 하고 그 결과를
 *    props로 이 컴포넌트에 넘기면, 문항 없는 사람에게 갈 RSC 페이로드에도 문항이
 *    함께 실려 브라우저까지 내려간다 — `server-only`는 번들 포함만 막지 그 경로는
 *    못 막는다. 그래서 이 컴포넌트가 마운트된 **뒤에** `GET /api/me/[token]`을
 *    따로 불러 가져온다.
 */
export default function MeClient({ token }: { token: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; data: MeData }
  >({ phase: "loading" });

  useEffect(() => {
    let alive = true;

    fetch(`/api/me/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body: MeApiResponse | null = await res.json().catch(() => null);
        if (!alive) return;
        if (!body || body.ok !== true) {
          setState({
            phase: "error",
            message: body && "message" in body ? body.message : "잠시 문제가 있었습니다.",
          });
          return;
        }
        setState({ phase: "ready", data: body.data });
      })
      .catch(() => {
        if (alive) {
          setState({ phase: "error", message: "잠시 문제가 있었습니다. 다시 시도해주세요." });
        }
      });

    return () => {
      alive = false;
    };
  }, [token]);

  if (state.phase === "loading") {
    return (
      <main className={s.shell}>
        <p className={s.loading}>불러오는 중…</p>
      </main>
    );
  }

  if (state.phase === "error") {
    return <MeNotFound message={state.message} />;
  }

  const { data } = state;
  switch (data.screen) {
    case "cancelled":
      return <MeCancelled name={data.name} />;
    case "ended":
      return <MeEnded name={data.name} />;
    case "eventDay":
      return <MeEventDay name={data.name} />;
    case "waitlisted":
      return <MeWaitlisted name={data.name} />;
    case "register":
      return <MeRegister data={data} />;
    case "payment":
      return <MePayment data={data} />;
    case "questions":
      return <MeQuestions data={data} />;
    case "confirmed":
      return <MeConfirmed name={data.name} />;
  }
}
