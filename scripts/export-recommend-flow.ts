/**
 * overlap-v2 PDF 카탈로그의 150개 배치를 정렬된 CSV로 내보낸다.
 * 실행: node --import tsx scripts/export-recommend-flow.ts [output.csv]
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogPlacementsCsv, compileOverlapCatalog } from "../src/lib/recommend/overlap-catalog";

async function main(): Promise<void> {
  const output = resolve(process.argv[2] ?? "recommend-overlap-v2.csv");
  const catalog = compileOverlapCatalog();
  const csv = catalogPlacementsCsv(catalog);
  const placements = csv.trimEnd().split("\n").length - 1;
  await writeFile(output, csv, "utf8");
  console.log(JSON.stringify({ output, profiles: catalog.length, placements }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "추천 카탈로그 내보내기 실패");
  process.exitCode = 1;
});
