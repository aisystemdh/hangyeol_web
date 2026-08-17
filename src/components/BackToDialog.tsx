"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "./BackToDialog.module.css";

/** 홈 무대의 질문·반응 phase — 이 값들일 때만 "하던 대화"가 있다(hub는 완주 상태) */
const IN_DIALOG = ["q1", "r1", "q2", "r2", "q3", "r3"];

/**
 * "← 하던 대화로 돌아가기" — 홈 대화 도중 카드 링크로 서브페이지에 온 방문자에게
 * 되돌아갈 길을 보여준다. 홈으로 가면 HomeStage의 복원 로직(sessionStorage
 * `dialog-phase`)이 보던 화면을 그대로 띄운다 — 여기는 링크만 놓으면 된다.
 *
 * ⚠️ 마운트 전에는 null을 렌더한다 — sessionStorage는 서버가 모르는 값이라
 *    첫 렌더에서 읽으면 하이드레이션이 어긋난다(HomeStage와 같은 규칙).
 */
export default function BackToDialog() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const phase = sessionStorage.getItem("dialog-phase");
      if (phase && IN_DIALOG.includes(phase)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 시스템(sessionStorage)과의 마운트 후 1회 동기화.
        setShow(true);
      }
    } catch {
      /* 접근 불가 시 표시 생략 */
    }
  }, []);

  if (!show) return null;

  return (
    <Link href="/" className={s.chip}>
      ← 하던 대화로 돌아가기
    </Link>
  );
}
