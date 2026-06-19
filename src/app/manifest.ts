import type { MetadataRoute } from "next";

/**
 * PWA 웹 매니페스트. 홈 화면에 추가 시 사용되는 앱 아이콘·이름·테마 색을 정의한다.
 * 아이콘은 흰 배경으로 합성된 PNG(public/icon-192.png, public/icon-512.png)를 사용한다.
 * (브라우저 탭 파비콘은 src/app/icon.svg, iOS 터치 아이콘은 src/app/apple-icon.png 가 담당.)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "아임딜러 — AI 기반 진짜견적",
    short_name: "아임딜러",
    description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000666",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
