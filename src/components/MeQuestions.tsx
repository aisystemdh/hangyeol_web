import MeShell from "./MeShell";
import s from "./Me.module.css";
import type { MeQuestionsData } from "@/lib/me-response";

/**
 * 우선순위 7 — 사전 질문 화면.
 *
 * 🔴 **여기 말고는 문항이 응답에 실리지 않는다.** `data`의 타입(`MeQuestionsData`)에만
 *    문항 필드가 있고, 서버는 입금완료 상태에서만 이 화면을 고른다(`src/lib/me-screen.ts`
 *    `guardExposure`). 실제 답변 입력 UI는 이슈 #36이 여기에 얹는다 — 지금은
 *    "문항이 실제로 내려왔다"만 확인할 수 있게 문항 수만 보여준다.
 */
export default function MeQuestions({ data }: { data: MeQuestionsData }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>사전 질문</p>
      {/* 🔴 문항 수를 문구에 박지 않는다 — `PRE_QUESTION_FORM_VERSION`이 오르면
          문항 개수도 바뀔 수 있고, 그때 제목만 옛 숫자로 남으면 바로 아래 줄의
          실제 개수와 어긋나 보인다. */}
      <h1 className={s.title}>{data.name}님, {data.questions.length}가지만 답해주세요</h1>
      <p className={s.body}>
        총 {data.questions.length}문항 · 문항 버전 {data.formVersion}
      </p>
      <p className={s.body}>실제 답변 화면은 다음 업데이트에서 이어집니다.</p>
    </MeShell>
  );
}
