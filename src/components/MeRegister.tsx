import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MeRegisterData } from "@/lib/me-response";

/**
 * 우선순위 5 — 정식등록 화면.
 *
 * 🔴 **여기에 계좌·문항이 없다.** `data`의 타입(`MeRegisterData`)에 애초에 그 필드가
 *    없어서, 실수로 넣으려 해도 타입 검사가 막는다(`docs/decisions/003…` §6 정보
 *    노출 표 — 등록 화면은 사업자 신원·환불 규정·금액까지만). 실제 등록 입력
 *    폼(혼인 여부·직업·이메일·입금자명·환불 동의)은 이슈 #33이 여기에 얹는다.
 */
export default function MeRegister({ data }: { data: MeRegisterData }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>참가 등록</p>
      <h1 className={s.title}>{data.name}님, 등록을 마쳐주세요</h1>
      <p className={s.body}>
        참가비 {data.price} · {data.ageRange} · 미혼 대상입니다. 등록을 마치면
        입금 계좌를 안내해 드립니다.
      </p>

      <div className={s.facts}>
        {data.refund.map((r) => (
          <div className={s.fact} key={r.when}>
            <span className={s.factKey}>{r.when}</span>
            <span className={s.factVal}>{r.what}</span>
          </div>
        ))}
      </div>

      <p className={s.body}>
        {data.bizIdentity.name} · 대표 {data.bizIdentity.ceo}
        {data.bizIdentity.regno ? ` · 사업자등록번호 ${data.bizIdentity.regno}` : ""}
      </p>
      {data.bizIdentity.missing.length > 0 && (
        <p className={s.warn}>
          표시 의무 정보가 비어 있습니다: {data.bizIdentity.missing.join(", ")}
        </p>
      )}

      <p className={s.body}>등록 입력 화면은 다음 업데이트에서 이어집니다.</p>
    </MeShell>
  );
}
