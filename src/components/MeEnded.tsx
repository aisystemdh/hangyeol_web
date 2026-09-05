import MeShell from "./MeShell";
import s from "./Me.module.css";

/** 우선순위 2 — 행사가 끝났다. 후기·리포트 안내는 #40 등 다음 이슈가 채운다. */
export default function MeEnded({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>모임을 마쳤습니다</p>
      <h1 className={s.title}>{name}님, 함께해 주셔서 감사합니다</h1>
      <p className={s.body}>후기와 리포트 안내는 이 화면에서 곧 이어집니다.</p>
    </MeShell>
  );
}
