import MeShell from "./MeShell";
import s from "./Me.module.css";

/**
 * 없는 토큰·틀린 토큰, 또는 API 호출 자체가 실패했을 때.
 *
 * 🔴 빈 화면이나 200으로 얼버무리지 않는다(이슈 #32 AC) — `GET /api/me/[token]`이
 *    404를 주고, 이 컴포넌트가 그 사실을 화면에서도 분명히 보여준다.
 */
export default function MeNotFound({ message }: { message: string }) {
  return (
    <MeShell>
      <p className={s.eyebrow}>링크를 확인해 주세요</p>
      <h1 className={s.title}>{message}</h1>
      <p className={s.body}>
        안내드린 링크가 맞는지 확인해 주시고, 계속 안 되면 문의 채널로
        알려주세요.
      </p>
    </MeShell>
  );
}
