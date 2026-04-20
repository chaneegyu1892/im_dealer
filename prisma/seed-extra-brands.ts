import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const extraVehicles = [
  // ── KGM ──
  {
    slug: "torres",
    name: "토레스",
    brand: "KGM",
    category: "SUV",
    vehicleCode: "TORRES",
    basePrice: 28_380_000,
    thumbnailUrl: "https://www.kg-mobility.com/images/car/model/torres/visual_car.png",
    description: "KGM의 새로운 전성기를 이끈 정통 SUV 디자인.",
    trims: [
      { name: "T5", price: 28_380_000, engineType: "가솔린", fuelEfficiency: 11.2, isDefault: true },
      { name: "T7", price: 31_500_000, engineType: "가솔린", fuelEfficiency: 11.2, isDefault: false },
    ],
  },
  {
    slug: "torres-evx",
    name: "토레스 EVX",
    brand: "KGM",
    category: "SUV",
    vehicleCode: "TORRES_EVX",
    basePrice: 45_500_000,
    thumbnailUrl: "https://www.kg-mobility.com/images/car/model/torres_evx/visual_car.png",
    description: "도심과 오프로드를 넘나드는 혁신적인 전기 SUV.",
    trims: [
      { name: "E5", price: 45_500_000, engineType: "EV", fuelEfficiency: 5.0, isDefault: true },
      { name: "E7", price: 47_600_000, engineType: "EV", fuelEfficiency: 5.0, isDefault: false },
    ],
  },
  
  // ── 쉐보레 ──
  {
    slug: "trax-crossover",
    name: "트랙스 크로스오버",
    brand: "쉐보레",
    category: "SUV",
    vehicleCode: "TRAX",
    basePrice: 21_880_000,
    thumbnailUrl: "https://www.chevrolet.co.kr/contents/repn-car/side-w/trax-crossover-well-side.png",
    description: "합리적인 가격과 스포티한 디자인의 CUV.",
    trims: [
      { name: "LS", price: 21_880_000, engineType: "가솔린", fuelEfficiency: 12.7, isDefault: true },
      { name: "ACTIV", price: 27_350_000, engineType: "가솔린", fuelEfficiency: 12.7, isDefault: false },
      { name: "RS", price: 28_130_000, engineType: "가솔린", fuelEfficiency: 12.7, isDefault: false },
    ],
  },
  
  // ── 르노코리아 ──
  {
    slug: "qm6",
    name: "QM6",
    brand: "르노",
    category: "SUV",
    vehicleCode: "QM6",
    basePrice: 28_400_000,
    thumbnailUrl: "https://www.renaultkorea.com/static/images/model/qm6/highlights/visual_usp_01.jpg",
    description: "조용하고 편안한 패밀리 SUV의 대명사.",
    trims: [
      { name: "2.0 LPe LE", price: 28_400_000, engineType: "가솔린", fuelEfficiency: 8.9, isDefault: true },
      { name: "2.0 GDe RE", price: 32_200_000, engineType: "가솔린", fuelEfficiency: 12.0, isDefault: false },
    ],
  },
  
  // ── 수입 프리미엄 ──
  {
    slug: "bmw-5-series",
    name: "5시리즈",
    brand: "BMW",
    category: "세단",
    vehicleCode: "BMW_5",
    basePrice: 68_800_000,
    thumbnailUrl: "https://www.bmw.co.kr/content/dam/bmw/marketKR/bmw_co_kr/all-models/5-series/sedan/2023/highlights/bmw-5-series-sedan-highlights-sp-desktop.jpg",
    description: "비즈니스 세단의 기준. 혁신적인 기술과 드라이빙 즐거움.",
    trims: [
      { name: "520i Base", price: 68_800_000, engineType: "가솔린", fuelEfficiency: 12.1, isDefault: true },
      { name: "530i xDrive M Sport", price: 84_200_000, engineType: "가솔린", fuelEfficiency: 11.1, isDefault: false },
    ],
  },
  {
    slug: "benz-e-class",
    name: "E클래스",
    brand: "벤츠",
    category: "세단",
    vehicleCode: "BENZ_E",
    basePrice: 73_900_000,
    thumbnailUrl: "https://www.mercedes-benz.co.kr/passengercars/models/saloon/e-class/highlights/_jcr_content/root/responsivegrid/tabs/tabitem/hotspot_module/hotspot_item.component.damstatic/1695194544322.jpg",
    description: "가장 지능적인 비즈니스 세단. 럭셔리의 완성.",
    trims: [
      { name: "E200 Avantgarde", price: 73_900_000, engineType: "가솔린", fuelEfficiency: 12.0, isDefault: true },
      { name: "E300 4MATIC Exclusive", price: 89_900_000, engineType: "가솔린", fuelEfficiency: 11.6, isDefault: false },
    ],
  },
  {
    slug: "tesla-model-y",
    name: "모델 Y",
    brand: "테슬라",
    category: "SUV",
    vehicleCode: "TESLA_Y",
    basePrice: 52_990_000,
    thumbnailUrl: "https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Model-Y-Main-Hero-Desktop-Global.png",
    description: "압도적인 안전성과 적재 공간을 갖춘 전기 SUV.",
    trims: [
      { name: "RWD", price: 52_990_000, engineType: "EV", fuelEfficiency: 5.1, isDefault: true },
      { name: "Long Range", price: 63_990_000, engineType: "EV", fuelEfficiency: 4.8, isDefault: false },
    ],
  },
];

async function seed() {
  console.log("🌱 추가 브랜드 데이터 시딩 시작...");

  // 1. Get Finance Companies
  const fcs = await prisma.financeCompany.findMany();
  const fcIds = fcs.map(f => f.id);

  for (const v of extraVehicles) {
    console.log(`\nAdding ${v.brand} ${v.name}...`);

    const vehicle = await prisma.vehicle.upsert({
      where: { slug: v.slug },
      update: {
        name: v.name,
        brand: v.brand,
        category: v.category,
        vehicleCode: v.vehicleCode,
        basePrice: v.basePrice,
        thumbnailUrl: v.thumbnailUrl,
        description: v.description,
      },
      create: {
        slug: v.slug,
        name: v.name,
        brand: v.brand,
        category: v.category,
        vehicleCode: v.vehicleCode,
        basePrice: v.basePrice,
        thumbnailUrl: v.thumbnailUrl,
        description: v.description,
        imageUrls: [],
      },
    });

    // Trims
    for (const t of v.trims) {
      await prisma.trim.upsert({
        where: { id: `${vehicle.id}-${t.name}` }, // Artificial ID for seed idempotency if needed, but we'll use findFirst/Create
        update: { price: t.price, engineType: t.engineType, fuelEfficiency: t.fuelEfficiency },
        create: {
          id: `${vehicle.id}-${t.name.replace(/\s+/g, "-")}`,
          vehicleId: vehicle.id,
          name: t.name,
          price: t.price,
          engineType: t.engineType,
          fuelEfficiency: t.fuelEfficiency,
          isDefault: t.isDefault,
        },
      });
    }

    // RateConfigs for all finance companies
    const baseRate = v.category === "세단" ? 0.0215 : 0.0225;
    const matrix = generateRateMatrix(baseRate);

    for (const fcId of fcIds) {
      await prisma.rateConfig.upsert({
        where: {
          financeCompanyId_vehicleCode_productType: {
            financeCompanyId: fcId,
            vehicleCode: v.vehicleCode,
            productType: "렌트",
          },
        },
        update: {
          minPriceRates: matrix,
          maxPriceRates: matrix,
        },
        create: {
          financeCompanyId: fcId,
          vehicleCode: v.vehicleCode,
          productType: "렌트",
          minVehiclePrice: v.basePrice * 0.8,
          maxVehiclePrice: v.basePrice * 1.5,
          minPriceRates: matrix,
          maxPriceRates: matrix,
          depositDiscountRate: -0.0005,
          prepayAdjustRate: 0.00007,
        },
      });
    }

    // RecommendationConfig
    await prisma.recommendationConfig.upsert({
      where: { vehicleId: vehicle.id },
      update: {},
      create: {
        vehicleId: vehicle.id,
        highlights: ["가성비 우수", "인기 수입차", "넉넉한 공간"],
        aiCaption: `${v.name}은(는) 세련된 디자인과 뛰어난 성능으로 많은 사랑을 받는 모델입니다.`,
        scoreMatrix: {
          industry: { "법인사업자": 8, "개인사업자": 7, "프리랜서": 6 },
          purpose: { "출퇴근": 9, "가족용": 7, "업무용": 8, "레저": 7 },
          budget: { min: 400, max: 900 }
        }
      }
    });
  }

  console.log("\n✨ 추가 브랜드 시딩 완료!");
}

function generateRateMatrix(baseRate: number) {
  const matrix: any = {};
  const mileages = [10000, 20000, 30000];
  const months = [36, 48, 60];

  for (const mileage of mileages) {
    matrix[mileage] = {};
    for (const month of months) {
      let rate = baseRate;
      if (month === 36) rate += baseRate * 0.2;
      if (month === 60) rate -= baseRate * 0.15;
      if (mileage === 30000) rate += 0.001;
      matrix[mileage][month] = parseFloat(rate.toFixed(6));
    }
  }
  return matrix;
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
