"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { SITE } from "@/lib/site";
import st from "./admin.module.css";

/**
 * 「조작하는 사람 / 보내는 사람」 선택 — 운영자 화면 여러 곳(`Dashboard.tsx`,
 * `NotifyBoard.tsx`)이 공유한다.
 *
 * 🔴 **자유 입력이 아니라 명단(`SITE.operators`, `site.ts`)에서 고른다** — 공유
 *    비밀번호라 서버는 누가 눌렀는지 모르므로, 이 선택값이 조작 API로 실려 가
 *    기록에 이름을 남긴다(`CONTEXT.md` "운영자가 하는 일"). 서버(`.../screen`·
 *    `.../notify/send`)도 이 명단에 없는 이름은 거절한다.
 *
 * ⚠️ **localStorage 값을 상태 초깃값으로 쓰지 않는다.** 서버 렌더에는 없는 값이라
 *    하이드레이션이 어긋난다 — 마운트 후에 DOM을 직접 읽고 쓰는 것이 그 회피다
 *    (옛 `Board.tsx`와 같은 방식). `forwardRef`로 `<select>`를 그대로 노출해서
 *    부르는 쪽이 `ref.current?.value`로 지금 고른 이름을 즉시 읽을 수 있게 한다 —
 *    상태(`useState`)로 들면 값이 바뀔 때마다 리렌더가 한 번 더 생긴다.
 *
 * 코드리뷰(2026-09-06, 이슈 #37) — 이 마크업과 "마운트 시 저장된 값 복원" 로직이
 * `Dashboard.tsx`·`NotifyBoard.tsx`에 토씨 하나 안 틀리고 복붙돼 있었다. 나중에
 * 복원 방식이 바뀌면(예: 서버가 마지막으로 쓴 이름을 함께 내려주기) 한쪽만 고치고
 * 잊기 쉽다.
 */
export const ActorSelect = forwardRef<HTMLSelectElement, { id: string; label: string }>(
  function ActorSelect({ id, label }, forwardedRef) {
    const innerRef = useRef<HTMLSelectElement>(null);
    // 바깥에서 받은 ref가 이 안의 실제 DOM 노드를 그대로 가리키게 한다 — 마운트 뒤로
    // 노드가 바뀌지 않으므로 빈 의존성 배열로 한 번만 연결해도 된다.
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLSelectElement, []);

    useEffect(() => {
      if (innerRef.current) innerRef.current.value = localStorage.getItem("hg-actor") ?? "";
    }, []);

    return (
      <div className={st.actor}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          ref={innerRef}
          className={st.inputSm}
          defaultValue=""
          onChange={(e) => localStorage.setItem("hg-actor", e.target.value)}
        >
          <option value="" disabled>
            선택
          </option>
          {SITE.operators.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
