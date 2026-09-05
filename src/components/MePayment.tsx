import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MePaymentData } from "@/lib/me-response";

/**
 * 우선순위 6 — 입금 안내 화면 (이슈 #33이 실제 값으로 채웠다).
 *
 * 🔴 **여기에 문항이 없다.** `data`의 타입(`MePaymentData`)에 애초에 문항 필드가
 *    없다(`docs/decisions/003…` §6 정보 노출 표 — 입금 화면은 계좌·예금주·기한·
 *    금액까지만).
 * 🔴 **여기까지 왔다는 것 자체가 정식등록을 마쳤다는 뜻이다** — `resolveMeScreen`이
 *    `registered_at`이 있어야만 이 화면을 고른다. 등록을 다시 내도(`MeRegister.tsx`)
 *    이 화면의 계좌·기한 계산에는 영향이 없다 — 재등록 API가 `due_at`을 건드리지
 *    않는다(`route.ts`의 POST 핸들러 주석).
 */
export default function MePayment({ data }: { data: MePaymentData }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>입금 안내</p>
      <h1 className={s.title}>{data.name}님, 입금하시면 자리가 확정됩니다</h1>
      <p className={s.body}>
        아래 계좌로 참가비를 보내주세요. 입금이 확인되면 자리가 확정되고, 사전
        질문 안내를 다시 보내드립니다.
      </p>

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
      <p className={s.body}>
        입금자명이 등록하신 것과 다르면 확인이 늦어질 수 있습니다. 문의는 신청
        시 안내받은 채널로 연락해주세요.
      </p>
    </MeShell>
  );
}
