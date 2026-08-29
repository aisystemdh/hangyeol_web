import LoginForm from "./LoginForm";

/**
 * 🔴 이 페이지가 검색에 잡히면 운영 화면의 주소가 그대로 알려진다.
 *
 * ⚠️ robots.txt에 `Disallow: /admin` 을 적지 **않는다.** robots.txt는 누구나 열어보는
 *    공개 파일이라, 막으려던 주소를 오히려 광고하는 꼴이 된다.
 *    아무 데서도 링크하지 않고 + 여기서 noindex를 거는 편이 조용하고 강하다.
 */
export const metadata = {
  title: "한결 운영",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLoginPage() {
  return <LoginForm />;
}
