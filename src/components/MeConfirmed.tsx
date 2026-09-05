import MeShell from "./MeShell";
import s from "./Me.module.css";

/** 우선순위 8 — 다 마친 사람. */
export default function MeConfirmed({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>확정</p>
      <h1 className={s.title}>{name}님, 준비가 끝났습니다</h1>
      <p className={s.body}>
        행사 전날과 당일에 안내를 다시 보내드립니다. 따로 챙기지 않으셔도
        됩니다.
      </p>
    </MeShell>
  );
}
