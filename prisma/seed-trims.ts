/**
 * trim_list.xlsx → DB 임포트 스크립트
 * - DB에 있는 차량에 매핑되는 트림/옵션만 임포트
 * - 기존 트림 데이터를 모두 대체
 */

import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// 스크립트 실행 시에는 pgBouncer를 거치지 않는 DIRECT_URL 사용
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL },
  },
});

// ─── DB 차량명 → xlsx 모델명 매핑 ─────────────────────────
const VEHICLE_MODEL_MAP: Record<string, string[]> = {
  그랜저: ["디 올 뉴 그랜저", "디 올 뉴 그랜저 HEV"],
  "아이오닉 6": ["아이오닉 6", "더 뉴 아이오닉 6"],
  투싼: ["더 뉴 투싼", "더 뉴 투싼 HEV"],
  싼타페: ["디 올 뉴 싼타페", "디 올 뉴 싼타페 HEV"],
  팰리세이드: ["더 뉴 팰리세이드", "디 올 뉴 팰리세이드", "디 올 뉴 팰리세이드 HEV"],
  "아이오닉 5": ["더 뉴 아이오닉 5"],
  쏘렌토: ["더 뉴 쏘렌토", "더 뉴 쏘렌토 HEV"],
  "봉고 III EV": ["봉고3 EV"],
  스타리아: ["스타리아", "스타리아 HEV"],
  K8: ["The New K8", "The New K8 HEV"],
  GV70: ["GV70", "Electrified GV70", "Electrified GV70 F/L"],
  GV80: ["GV80 F/L", "GV80 Coupe"],
  스포티지: ["더 뉴 스포티지", "더 뉴 스포티지 HEV"],
  카니발: ["더 뉴 카니발", "더 뉴 카니발 HEV"],
  EV6: ["더 뉴 EV6", "더 뉴 EV6 GT"],
  EV9: ["EV9", "EV9 GT"],
  "포터 II EV": ["포터2 Electric"],
  쏘나타: ["쏘나타 디 엣지", "쏘나타 디 엣지 HEV"],
  G80: ["디 올 뉴 G80 F/L", "Electrified G80 F/L"],
  K5: ["더 뉴 K5", "더 뉴 K5 HEV"],
};

interface XlsxRow {
  brand: string;
  model: string;
  lineup: string; // 라인업
  trim: string;   // 트림명
  trimPrice: number;
  option: string;
  optionPrice: number;
  isAccessory: boolean;
  hasLinkedOption: boolean;
  linkedOptionCondition: string | null;
  optionDesc: string | null;
}

function extractEngineType(lineup: string): string {
  const l = lineup.toUpperCase();
  // PHEV/플러그인은 하이브리드로 분류
  if (l.includes("PHEV") || l.includes("플러그인")) return "하이브리드";
  if (l.includes("HEV") || l.includes("하이브리드")) return "하이브리드";
  if (l.includes("EV") || l.includes("일렉트릭") || l.includes("전기")) return "EV";
  if (l.includes("디젤")) return "디젤";
  // LPG도 가솔린 계열로 분류
  if (l.includes("LPG") || l.includes("LPI")) return "가솔린";
  if (l.includes("가솔린") || l.includes("터보")) return "가솔린";
  return "가솔린";
}

function readXlsx(filePath: string): XlsxRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["raw data"];
  const raw = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
  });

  const rows: XlsxRow[] = [];

  for (const row of raw) {
    // XLSX.js는 빈 첫 컬럼(A)을 제거하므로: row[0]=브랜드, row[1]=모델, row[2]=라인업, ...
    if (!row[0] || row[0] === "브랜드") continue;
    const brand = String(row[0] ?? "").trim();
    const model = String(row[1] ?? "").trim();
    const lineup = String(row[2] ?? "").trim();
    const trim = String(row[3] ?? "").trim();
    const trimPrice = Number(row[4] ?? 0);
    const option = String(row[5] ?? "").trim();
    const optionPrice = Number(row[6] ?? 0);
    const isAccessory = String(row[7] ?? "n").toLowerCase() === "y";
    const hasLinkedOption = String(row[8] ?? "n").toLowerCase() === "y";
    const linkedOptionCondition = row[9] ? String(row[9]).trim() : null;
    const optionDesc = row[10] ? String(row[10]).trim() : null;

    if (!brand || !model || !trim || !option) continue;

    rows.push({
      brand,
      model,
      lineup,
      trim,
      trimPrice,
      option,
      optionPrice,
      isAccessory,
      hasLinkedOption,
      linkedOptionCondition,
      optionDesc,
    });
  }

  return rows;
}

async function main() {
  const xlsxPath = path.join(__dirname, "../trim_list.xlsx");
  console.log("xlsx 읽는 중...");
  const rows = readXlsx(xlsxPath);
  console.log(`총 ${rows.length}개 행 로드됨`);

  // DB 차량 목록 조회
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, name: true, brand: true },
  });
  console.log(`DB 차량 ${vehicles.length}개 조회됨\n`);

  let totalTrims = 0;
  let totalOptions = 0;

  for (const vehicle of vehicles) {
    const xlsxModels = VEHICLE_MODEL_MAP[vehicle.name];
    if (!xlsxModels) {
      console.log(`[SKIP] ${vehicle.brand} ${vehicle.name} - 매핑 없음`);
      continue;
    }

    // 해당 차량의 xlsx 행 필터
    const vehicleRows = rows.filter(
      (r) => r.brand === vehicle.brand && xlsxModels.includes(r.model)
    );

    if (vehicleRows.length === 0) {
      console.log(`[SKIP] ${vehicle.brand} ${vehicle.name} - xlsx 데이터 없음`);
      continue;
    }

    // (lineup, trim, trimPrice) 기준으로 트림 그룹화
    type TrimKey = string;
    const trimMap = new Map<TrimKey, {
      model: string;
      lineup: string;
      trimName: string;
      trimPrice: number;
      options: XlsxRow[];
    }>();

    for (const row of vehicleRows) {
      const key = `${row.model}|${row.lineup}|${row.trim}|${row.trimPrice}`;
      if (!trimMap.has(key)) {
        trimMap.set(key, {
          model: row.model,
          lineup: row.lineup,
          trimName: row.trim,
          trimPrice: row.trimPrice,
          options: [],
        });
      }
      trimMap.get(key)!.options.push(row);
    }

    // 기존 트림 삭제
    await prisma.trim.deleteMany({ where: { vehicleId: vehicle.id } });

    // 트림 생성 (첫 번째가 기본 트림)
    let isFirst = true;
    for (const trimData of trimMap.values()) {
      const trimName =
        trimData.lineup
          ? `${trimData.lineup} ${trimData.trimName}`
          : trimData.trimName;

      const created = await prisma.trim.create({
        data: {
          vehicleId: vehicle.id,
          name: trimName,
          price: trimData.trimPrice,
          engineType: extractEngineType(trimData.lineup),
          fuelEfficiency: null,
          isDefault: isFirst,
          isVisible: true,
          specs: {
            model: trimData.model,
            lineup: trimData.lineup,
            trimName: trimData.trimName,
          },
          options: {
            create: trimData.options.map((opt) => ({
              name: opt.option,
              price: opt.optionPrice,
              description: opt.optionDesc,
              isAccessory: opt.isAccessory,
              isDefault: false,
            })),
          },
        },
      });

      totalTrims++;
      totalOptions += trimData.options.length;
      isFirst = false;

      console.log(
        `  [CREATE] ${vehicle.brand} ${vehicle.name} / ${trimName} (${trimData.trimPrice.toLocaleString()}원) / 옵션 ${trimData.options.length}개`
      );
      void created;
    }

    console.log(
      `✓ ${vehicle.brand} ${vehicle.name}: ${trimMap.size}개 트림\n`
    );
  }

  console.log(`\n완료: 트림 ${totalTrims}개, 옵션 ${totalOptions}개 생성`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
