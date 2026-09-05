import MeShell from "./MeShell";
import s from "./Me.module.css";
import InstagramLink from "./InstagramLink";
import type { MeReport } from "@/lib/me-response";

/**
 * 우선순위 2 — 행사가 끝났다(이슈 #40).
 *
 * 🔴 **리포트를 만드는 화면이 아니다.** 운영자가 링크를 등록해야만(`POST
 *    /api/admin/applications/[id]/report`) `report`가 값을 가진다 — 이 컴포넌트는
 *    받은 값을 그대로 보여줄 뿐이다.
 * 🔴 **`report`가 없다고 빈 화면·깨진 링크를 보여주지 않는다.** "아직 준비 중"이라는
 *    사실을 분명히 말한다(이슈 #40 AC) — `visibleReport()`가 "행이 없다"·"공개
 *    시각이 아직 안 됐다"를 이미 null 하나로 뭉갰으므로 여기서 다시 나눌 필요가 없다.
 *
 * 후기 안내는 별도 제출 화면이 없다(이 이슈 범위 밖) — 알림톡 문구 ⑦
 * (`docs/alimtalk-templates.md`)도 마이페이지 링크로 돌아올 뿐 전용 후기 폼을
 * 전제하지 않는다. 그래서 기존 "전송 실패 시 인스타그램 메시지" 패턴
 * (`ApplyForm`)과 같은 채널로 안내한다.
 */
export default function MeEnded({ name, report }: { name: string; report: MeReport | null }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>모임을 마쳤습니다</p>
      <h1 className={s.title}>{name}님, 함께해 주셔서 감사합니다</h1>
      <p className={s.body}>
        짧은 후기를 남겨 주시면 다음 모임을 준비하는 데 큰 도움이 됩니다. 아래
        채널로 편하게 남겨주세요.
      </p>
      <InstagramLink className="link-arrow" />

      {report ? (
        <>
          <p className={s.body}>당일 오간 이야기와 흐름을 담은 리포트가 나왔습니다.</p>
          <a className="link-arrow" href={report.url} target="_blank" rel="noopener noreferrer">
            모임 리포트 보기
          </a>
        </>
      ) : (
        <p className={s.body}>모임 리포트는 아직 준비 중입니다. 준비되는 대로 이 화면에서 볼 수 있습니다.</p>
      )}
    </MeShell>
  );
}
