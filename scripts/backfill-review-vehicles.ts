/**
 * vehicleId 가 비어 있는 공개 후기에 차량을 연결한다.
 * 실행: pnpm exec tsx scripts/backfill-review-vehicles.ts
 */
import { prisma } from "../src/lib/prisma";

/** 작성자 또는 본문 키워드 → 차량명 부분 매칭 */
const HINTS: { author?: string; keyword: string }[] = [
  { author: "김도현", keyword: "그랜저" },
  { author: "이수진", keyword: "쏘렌토" },
  { author: "박재민", keyword: "쏘렌토" },
  { author: "최유나", keyword: "아이오닉" },
  { author: "정민호", keyword: "카니발" },
  { author: "한지원", keyword: "GV70" },
  { author: "강서윤", keyword: "스포티지" },
  { author: "조성훈", keyword: "싼타페" },
  { author: "윤하늘", keyword: "아반떼" },
  { author: "임채영", keyword: "G80" },
  { author: "오준혁", keyword: "GV70" },
  { keyword: "EV6" },
  { keyword: "팰리세이드" },
  { keyword: "아이오닉" },
  { keyword: "그랜저" },
  { keyword: "쏘렌토" },
  { keyword: "카니발" },
  { keyword: "스포티지" },
  { keyword: "아반떼" },
  { keyword: "싼타페" },
  { keyword: "G80" },
  { keyword: "GV70" },
  { keyword: "GV80" },
  { keyword: "Model Y" },
  { keyword: "Model 3" },
  { keyword: "X5" },
  { keyword: "X3" },
  { keyword: "E-Class" },
  { keyword: "C-Class" },
  { keyword: "GLC" },
  { keyword: "G90" },
];

async function main() {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    select: { id: true, name: true, brand: true },
  });

  function resolve(keyword: string): string | null {
    const k = keyword.toLowerCase();
    const hit =
      vehicles.find((v) => v.name.toLowerCase().includes(k)) ??
      vehicles.find((v) => `${v.brand} ${v.name}`.toLowerCase().includes(k));
    return hit?.id ?? null;
  }

  const orphans = await prisma.review.findMany({
    where: { isPublic: true, vehicleId: null },
    select: { id: true, authorRealName: true, content: true },
  });

  let updated = 0;
  for (const r of orphans) {
    let vehicleId: string | null = null;
    for (const hint of HINTS) {
      if (hint.author && r.authorRealName !== hint.author) continue;
      if (!hint.author && !r.content.includes(hint.keyword) && !r.content.toLowerCase().includes(hint.keyword.toLowerCase())) {
        continue;
      }
      if (hint.author) {
        vehicleId = resolve(hint.keyword);
        if (vehicleId) break;
      } else {
        vehicleId = resolve(hint.keyword);
        if (vehicleId) break;
      }
    }
    if (!vehicleId) {
      // 본문 키워드 스캔
      for (const hint of HINTS) {
        if (hint.author) continue;
        if (r.content.includes(hint.keyword) || r.content.toLowerCase().includes(hint.keyword.toLowerCase())) {
          vehicleId = resolve(hint.keyword);
          if (vehicleId) break;
        }
      }
    }
    if (!vehicleId) continue;
    await prisma.review.update({
      where: { id: r.id },
      data: { vehicleId },
    });
    updated += 1;
    console.log(`linked ${r.authorRealName} → ${vehicleId}`);
  }

  const still = await prisma.review.count({
    where: { isPublic: true, vehicleId: null },
  });
  console.log(JSON.stringify({ scanned: orphans.length, updated, stillOrphan: still }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
