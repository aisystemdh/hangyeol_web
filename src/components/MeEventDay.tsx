import MeShell from "./MeShell";
import s from "./Me.module.css";
import { EVENT } from "@/lib/event";

/**
 * 우선순위 3 — 오늘이 행사날. 사전질문을 아직 안 낸 사람도(우선순위 7보다 위이므로)
 * 이 화면을 받는다(`docs/decisions/003…` §6, 이슈 #32 AC).
 */
export default function MeEventDay({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>오늘입니다</p>
      <h1 className={s.title}>{name}님, 오늘 뵙겠습니다</h1>
      <p className={s.body}>
        {EVENT.date} · {EVENT.doorsOpen} · {EVENT.place}
      </p>
    </MeShell>
  );
}
