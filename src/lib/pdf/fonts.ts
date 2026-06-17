import path from "path";
import { Font } from "@react-pdf/renderer";

/**
 * react-pdf용 한글 폰트(Pretendard) 등록.
 * TTF는 src/lib/pdf/fonts/ 에 번들되며, 서버리스 함수에는
 * next.config 의 outputFileTracingIncludes 로 포함된다.
 * process.cwd() = 프로젝트 루트 기준 경로로 읽는다.
 */
let registered = false;

function fontPath(file: string): string {
  return path.join(process.cwd(), "src/lib/pdf/fonts", file);
}

export function ensureFontsRegistered(): void {
  if (registered) return;

  Font.register({
    family: "Pretendard",
    fonts: [
      { src: fontPath("Pretendard-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Pretendard-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Pretendard-SemiBold.ttf"), fontWeight: 600 },
      { src: fontPath("Pretendard-Bold.ttf"), fontWeight: 700 },
    ],
  });

  // 단어를 쪼개지 않고 공백 단위로만 줄바꿈 → 한글에 하이픈이 끼어드는 현상 방지.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
