import type { MetadataRoute } from "next";
import { EVENT_HREF, NAV, SITE_URL } from "@/lib/site";

/**
 * /sitemap.xml — Next 규약 파일이다(`src/app/sitemap.ts`).
 *
 * 경로 목록은 `NAV`와 `EVENT_HREF`에서 가져온다. 페이지를 추가하면 `site.ts`의
 * NAV만 고치면 헤더·푸터·사이트맵 세 곳에 동시에 반영된다.
 *
 * `lastModified`는 넣지 않는다 — 빌드할 때마다 값이 달라져(내용이 그대로여도)
 * 색인에 잘못된 갱신 신호를 준다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...NAV.map((item) => item.href), EVENT_HREF];

  return paths.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
}
