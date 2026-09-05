import MeShell from "./MeShell";
import s from "./Me.module.css";
import { EVENT } from "@/lib/event";

/**
 * 우선순위 3 — 오늘이 행사날. 사전질문을 아직 안 낸 사람도(우선순위 7보다 위이므로)
 * 이 화면을 받는다(`docs/decisions/003…` §6, 이슈 #32 AC).
 *
 * 🔴 시간·장소는 API 응답이 아니라 여기서 **`EVENT` 상수를 직접** 읽는다(이슈 #40) —
 *    행사 시간·장소는 신청 상태와 무관하게 이미 공개된 사실이라(`docs/architecture.md`),
 *    이 화면만을 위해 `GET /api/me/[token]`에 새 필드를 하나 더 얹을 이유가 없다.
 *    `EVENT`는 계좌·문항과 달리 아무 조건 없이 내려가도 되는 값이다.
 *
 * 준비물 안내는 없다 — `docs/alimtalk-templates.md`의 실제 문구(⑥ 행사 전날 안내)에도
 * "이름표는 현장에서 드립니다"뿐이고 따로 챙길 물건 언급이 없다. 없는 준비물을
 * 지어내지 않는다(2026-09-06 확인).
 */
export default function MeEventDay({ name }: { name: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>오늘입니다</p>
      <h1 className={s.title}>{name}님, 오늘 뵙겠습니다</h1>
      <p className={s.body}>이름표는 현장에서 드립니다. 늦지 않게 도착해주세요.</p>

      <div className={s.facts}>
        <div className={s.fact}>
          <span className={s.factKey}>날짜</span>
          <span className={s.factVal}>{EVENT.date}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>입장</span>
          <span className={s.factVal}>{EVENT.doorsOpen}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>진행 시간</span>
          <span className={s.factVal}>{EVENT.time}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>장소</span>
          <span className={s.factVal}>{EVENT.place}</span>
        </div>
      </div>
    </MeShell>
  );
}
