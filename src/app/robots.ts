import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /robots.txt — Next 규약 파일이다(`src/app/robots.ts`).
 * 숨길 경로가 없는 5페이지 정적 사이트라 전부 허용하고 sitemap 위치만 알린다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
