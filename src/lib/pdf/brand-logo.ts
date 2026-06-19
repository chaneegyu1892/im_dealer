import fs from "fs";
import path from "path";

/**
 * 견적서 PDF 헤더에 들어가는 아임딜러 브랜드 로고(PNG)를 data URI 로 읽어온다.
 * 폰트와 동일하게 src/lib/pdf/brand/ 에 번들되며, 서버리스 함수에는
 * next.config 의 outputFileTracingIncludes 로 포함된다.
 * process.cwd() = 프로젝트 루트 기준 경로로 읽고, 결과는 모듈 캐시에 보관한다.
 *
 * 파일이 없거나 읽기에 실패하면 null 을 반환 → QuoteDocument 가 텍스트 워드마크로 폴백한다.
 */
let cached: string | null | undefined;

export function getBrandLogoDataUri(): string | null {
  if (cached !== undefined) return cached;

  try {
    const file = path.join(process.cwd(), "src/lib/pdf/brand", "main-logo.png");
    const buf = fs.readFileSync(file);
    cached = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cached = null;
  }

  return cached;
}
