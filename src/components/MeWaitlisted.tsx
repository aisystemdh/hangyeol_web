import MeShell from "./MeShell";
import s from "./Me.module.css";

/** 우선순위 4 — 대기자. 🔴 기한이 없다(`CONTEXT.md` "기한") — 화면에서도 기한을 말하지 않는다. */
export default function MeWaitlisted({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>대기 명단</p>
      <h1 className={s.title}>{name}님, 대기 명단에 등록돼 있습니다</h1>
      <p className={s.body}>
        자리가 나면 순서대로 안내드립니다. 따로 기한은 없으니 편하게
        기다려 주세요.
      </p>
    </MeShell>
  );
}
