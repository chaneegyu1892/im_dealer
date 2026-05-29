/**
 * trim_list.xlsx → DB 임포트 스크립트
 * - DB에 있는 차량에 매핑되는 트림/옵션만 임포트
 * - 기존 트림 데이터를 모두 대체
 */

import ExcelJS from "exceljs";
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

// exceljs 셀 값(문자열/숫자/richText/hyperlink/formula)을 평문 문자열로 추출.
function cellText(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text ?? "").join("");
    }
    if ("text" in val && val.text != null) return String(val.text);
    if ("result" in val && val.result != null) return String(val.result);
    return "";
  }
  return String(val);
}

async function readXlsx(filePath: string): Promise<XlsxRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet("raw data");
  if (!ws) {
    throw new Error('"raw data" 시트를 찾을 수 없습니다');
  }

  const rows: XlsxRow[] = [];

  // exceljs row.values 는 1-based 희소 배열(index 0 = undefined).
  // 원본 xlsx(sheet_to_json header:1)은 빈 첫 컬럼 A를 제거해 row[0]=브랜드(B열)였다.
  // exceljs 는 A열을 포함하므로 values[1]=빈 A, values[2]=브랜드 … 즉 원본 row[i] === values[i+2].
  ws.eachRow({ includeEmpty: false }, (row) => {
    const v = row.values as ExcelJS.CellValue[];
    const brand = cellText(v[2]).trim();
    if (!brand || brand === "브랜드") return;
    const model = cellText(v[3]).trim();
    const lineup = cellText(v[4]).trim();
    const trim = cellText(v[5]).trim();
    const trimPrice = Number(cellText(v[6]) || 0);
    const option = cellText(v[7]).trim();
    const optionPrice = Number(cellText(v[8]) || 0);
    const isAccessory = (cellText(v[9]) || "n").toLowerCase() === "y";
    const hasLinkedOption = (cellText(v[10]) || "n").toLowerCase() === "y";
    const linkedOptionCondition = cellText(v[11]).trim() || null;
    const optionDesc = cellText(v[12]).trim() || null;

    if (!model || !trim || !option) return;

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
  });

  return rows;
}

async function main() {
  const xlsxPath = path.join(__dirname, "../trim_list.xlsx");
  console.log("xlsx 읽는 중...");
  const rows = await readXlsx(xlsxPath);
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
