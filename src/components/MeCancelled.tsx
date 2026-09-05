import MeShell from "./MeShell";
import s from "./Me.module.css";

/** 우선순위 1 — 취소된 신청. `docs/decisions/003…` §6. */
export default function MeCancelled({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>취소된 신청</p>
      <h1 className={s.title}>{name}님, 신청이 취소되었습니다</h1>
      <p className={s.body}>
        더 궁금한 점이 있으면 문의 채널로 알려주세요. 다음 회차가 열리면 다시
        안내해 드리겠습니다.
      </p>
    </MeShell>
  );
}
