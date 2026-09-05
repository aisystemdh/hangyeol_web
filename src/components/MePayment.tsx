import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MePaymentData } from "@/lib/me-response";

/**
 * 우선순위 6 — 입금 안내 화면.
 *
 * 🔴 **여기에 문항이 없다.** `data`의 타입(`MePaymentData`)에 애초에 문항 필드가
 *    없다(`docs/decisions/003…` §6 정보 노출 표 — 입금 화면은 계좌·예금주·기한·
 *    금액까지만).
 */
export default function MePayment({ data }: { data: MePaymentData }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>입금 안내</p>
      <h1 className={s.title}>{data.name}님, 입금하시면 자리가 확정됩니다</h1>

      <div className={s.facts}>
        <div className={s.fact}>
          <span className={s.factKey}>은행</span>
          <span className={s.factVal}>{data.bizAccount.bank}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>계좌번호</span>
          <span className={s.factVal}>{data.bizAccount.account || "안내 준비 중"}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>예금주</span>
          <span className={s.factVal}>{data.bizAccount.holder}</span>
        </div>
        <div className={s.fact}>
          <span className={s.factKey}>참가비</span>
          <span className={s.factVal}>{data.price}</span>
        </div>
        {data.dueAtLabel && (
          <div className={s.fact}>
            <span className={s.factKey}>입금 기한</span>
            <span className={s.factVal}>{data.dueAtLabel}</span>
          </div>
        )}
      </div>

      {data.bizAccount.missing.length > 0 && (
        <p className={s.warn}>안내 정보가 비어 있습니다: {data.bizAccount.missing.join(", ")}</p>
      )}
      <p className={s.body}>입금자명 확인·등록 정보 수정 화면은 다음 업데이트에서 이어집니다.</p>
    </MeShell>
  );
}
