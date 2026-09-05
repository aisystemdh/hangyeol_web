"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * 🔴 **등록(`MeRegister`, 이슈 #33)이 성공한 뒤에도 다음 화면은 여기서 다시 받아온다.**
 *    등록 라우트의 응답에는 계좌가 없다(`me-response.ts`의 `MeRegisterApiResponse`) —
 *    다음 화면이 "payment"인지 "questions"인지는 서버의 `resolveMeScreen`만 알고,
 *    그건 `GET`을 다시 불러야 새로 계산된다. 그래서 화면을 여기서 직접 조립하지
 *    않고 `reloadKey`를 올려 **같은 조회를 한 번 더** 태운다 — 진실이 두 곳(이
 *    조립 로직과 서버의 판정)으로 나뉘지 않게 한다. `RecruitStatus.tsx`와 같은
 *    "effect 안에서 직접 fetch" 모양을 유지하는 이유는, `useCallback`으로 뺀
 *    조회 함수를 effect 안에서 그대로 부르면 React Compiler 린트
 *    (`react-hooks/set-state-in-effect`)가 "effect 안에서 setState를 직접
 *    부른다"고 보고 막기 때문이다.
 *
 * 🔴 **등록 직후의 재조회가 실패하면 "링크를 확인해주세요"라고 하지 않는다.**
 *    그 문구는 토큰이 틀렸다는 뜻인데, 이 경우는 등록은 **이미 저장된 뒤**라
 *    사실이 아니다(`afterRegisterRef`). 등록이 성공했다는 사실과 "다음 화면을
 *    못 받아왔다"는 사실을 구분해서 말해야, 손님이 이미 된 등록을 다시 시도하거나
 *    "링크가 잘못됐나" 하고 걱정하지 않는다. `ref`로 두는 이유는 이 플래그가
 *    바뀐다고 새로 조회를 다시 태울 필요는 없기 때문이다(`state`로 두면 성공
 *    직후 이 값을 되돌리는 것 자체가 effect를 한 번 더 돌려 조회가 중복된다).
 */
export default function MeClient({ token }: { token: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; data: MeData }
  >({ phase: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const afterRegisterRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const afterRegister = afterRegisterRef.current;

    fetch(`/api/me/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body: MeApiResponse | null = await res.json().catch(() => null);
        if (!alive) return;
        if (!body || body.ok !== true) {
          setState({
            phase: "error",
            message: afterRegister
              ? "등록은 완료됐지만 다음 화면을 불러오지 못했습니다. 잠시 후 이 페이지를 새로고침해주세요."
              : body && "message" in body
                ? body.message
                : "잠시 문제가 있었습니다.",
          });
          return;
        }
        afterRegisterRef.current = false;
        setState({ phase: "ready", data: body.data });
      })
      .catch(() => {
        if (!alive) return;
        setState({
          phase: "error",
          message: afterRegister
            ? "등록은 완료됐지만 다음 화면을 불러오지 못했습니다. 잠시 후 이 페이지를 새로고침해주세요."
            : "잠시 문제가 있었습니다. 다시 시도해주세요.",
        });
      });

    return () => {
      alive = false;
    };
  }, [token, reloadKey]);

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
      return <MeEnded name={data.name} report={data.report} />;
    case "eventDay":
      return <MeEventDay name={data.name} />;
    case "waitlisted":
      return <MeWaitlisted name={data.name} />;
    case "register":
      return (
        <MeRegister
          token={token}
          data={data}
          onRegistered={() => {
            afterRegisterRef.current = true;
            setReloadKey((k) => k + 1);
          }}
        />
      );
    case "payment":
      return <MePayment data={data} />;
    case "questions":
      return <MeQuestions data={data} />;
    case "confirmed":
      return <MeConfirmed name={data.name} />;
  }
}
