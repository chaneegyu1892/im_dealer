/**
 * 아임딜러 시드 데이터
 * - 금융사 4개 (IM, 신한, BNK, 오릭스)
 * - 차량 20개 (25년 신차 인기 차종)
 * - 트림 데이터
 * - RateConfig (회수율 매트릭스)
 * - RankSurchargeConfig (순위별 가산율)
 * - RecommendationConfig (AI 추천 기초 데이터)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── 금융사 ──────────────────────────────────────────────

const financeCompanies = [
  {
    name: "IM캐피탈",
    code: "IM",
    surchargeRate: 0,
    displayOrder: 1,
  },
  {
    name: "신한캐피탈",
    code: "SHINHAN",
    surchargeRate: 0.3,
    displayOrder: 2,
  },
  {
    name: "BNK캐피탈",
    code: "BNK",
    surchargeRate: 0.2,
    displayOrder: 3,
  },
  {
    name: "오릭스캐피탈",
    code: "ORIX",
    surchargeRate: 0.5,
    displayOrder: 4,
  },
];

// ─── 순위 가산율 ─────────────────────────────────────────

// [수정] 명세 기준: 1순위 +1.0%, 2순위 +1.5%, 3순위 +2.0%, 4순위 이상 +2.5%
const rankSurcharges = [
  { rank: 1, rate: 1.0 },
  { rank: 2, rate: 1.5 },
  { rank: 3, rate: 2.0 },
  { rank: 4, rate: 2.5 },
];

// ─── 차량 데이터 (25년 신차 기준) ─────────────────────────

interface VehicleSeed {
  slug: string;
  name: string;
  brand: string;
  category: string;
  vehicleCode: string;
  basePrice: number;
  thumbnailUrl: string;
  surchargeRate: number;
  isPopular: boolean;
  displayOrder: number;
  description: string;
  trims: TrimSeed[];
}

interface TrimSeed {
  name: string;
  price: number;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string>;
}

const vehicles: VehicleSeed[] = [
  // ── 현대 ──
  {
    slug: "grandeur",
    name: "그랜저",
    brand: "현대",
    category: "세단",
    vehicleCode: "GRANDEUR",
    basePrice: 39_800_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/grandeur/25my/grandeur_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 1,
    description: "대한민국 대표 준대형 세단. 품격 있는 디자인과 안정적인 주행.",
    trims: [
      { name: "프리미엄", price: 39_800_000, engineType: "가솔린", fuelEfficiency: 10.6, isDefault: true, specs: { engine: "2.5 GDi", power: "198ps" } },
      { name: "캘리그래피", price: 44_300_000, engineType: "가솔린", fuelEfficiency: 10.6, isDefault: false, specs: { engine: "2.5 GDi", power: "198ps" } },
      { name: "하이브리드 프리미엄", price: 42_500_000, engineType: "하이브리드", fuelEfficiency: 16.2, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
      { name: "하이브리드 캘리그래피", price: 47_200_000, engineType: "하이브리드", fuelEfficiency: 16.2, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "sonata",
    name: "쏘나타",
    brand: "현대",
    category: "세단",
    vehicleCode: "SONATA",
    basePrice: 30_900_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/sonata/26my/sonata_highlights.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 2,
    description: "국민 중형 세단. 실용성과 효율의 균형.",
    trims: [
      { name: "프리미엄", price: 30_900_000, engineType: "가솔린", fuelEfficiency: 12.5, isDefault: true, specs: { engine: "2.0 MPI", power: "160ps" } },
      { name: "인스퍼레이션", price: 33_800_000, engineType: "가솔린", fuelEfficiency: 12.5, isDefault: false, specs: { engine: "2.0 MPI", power: "160ps" } },
      { name: "하이브리드 프리미엄", price: 33_500_000, engineType: "하이브리드", fuelEfficiency: 19.2, isDefault: false, specs: { engine: "1.6T HEV", power: "195ps" } },
    ],
  },
  {
    slug: "tucson",
    name: "투싼",
    brand: "현대",
    category: "SUV",
    vehicleCode: "TUCSON",
    basePrice: 30_100_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/tucson/25my/tucson_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 3,
    description: "실용성과 연비를 모두 잡은 베스트셀러 SUV.",
    trims: [
      { name: "모던", price: 30_100_000, engineType: "가솔린", fuelEfficiency: 12.0, isDefault: true, specs: { engine: "1.6T GDi", power: "180ps" } },
      { name: "프리미엄", price: 33_000_000, engineType: "가솔린", fuelEfficiency: 12.0, isDefault: false, specs: { engine: "1.6T GDi", power: "180ps" } },
      { name: "하이브리드 모던", price: 33_700_000, engineType: "하이브리드", fuelEfficiency: 16.2, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
      { name: "하이브리드 프리미엄", price: 36_600_000, engineType: "하이브리드", fuelEfficiency: 16.2, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "santafe",
    name: "싼타페",
    brand: "현대",
    category: "SUV",
    vehicleCode: "SANTAFE",
    basePrice: 36_200_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/santafe/25my/santafe_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 4,
    description: "패밀리 중형 SUV의 대명사. 넉넉한 공간과 안전함.",
    trims: [
      { name: "프리미엄", price: 36_200_000, engineType: "가솔린", fuelEfficiency: 10.8, isDefault: true, specs: { engine: "2.5 GDi", power: "194ps" } },
      { name: "캘리그래피", price: 41_000_000, engineType: "가솔린", fuelEfficiency: 10.8, isDefault: false, specs: { engine: "2.5 GDi", power: "194ps" } },
      { name: "하이브리드 프리미엄", price: 39_500_000, engineType: "하이브리드", fuelEfficiency: 14.7, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "palisade",
    name: "팰리세이드",
    brand: "현대",
    category: "SUV",
    vehicleCode: "PALISADE",
    basePrice: 41_800_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/palisade/25fc/palisade_highlights_usp.jpg",
    surchargeRate: 0.3,
    isPopular: true,
    displayOrder: 5,
    description: "현대 플래그십 대형 SUV. 패밀리카의 새 기준.",
    trims: [
      { name: "프리미엄 7인승", price: 41_800_000, engineType: "디젤", fuelEfficiency: 12.8, isDefault: true, specs: { engine: "2.2 디젤", power: "202ps", seat: "7인승" } },
      { name: "캘리그래피 7인승", price: 46_500_000, engineType: "디젤", fuelEfficiency: 12.8, isDefault: false, specs: { engine: "2.2 디젤", power: "202ps", seat: "7인승" } },
      { name: "프리미엄 8인승", price: 41_300_000, engineType: "디젤", fuelEfficiency: 12.8, isDefault: false, specs: { engine: "2.2 디젤", power: "202ps", seat: "8인승" } },
    ],
  },
  {
    slug: "ioniq5",
    name: "아이오닉 5",
    brand: "현대",
    category: "SUV",
    vehicleCode: "IONIQ5",
    basePrice: 47_000_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/ioniq5/25my/ioniq5_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 6,
    description: "현대 전기 크로스오버. 혁신적 디자인과 800V 초급속 충전.",
    trims: [
      { name: "익스클루시브", price: 47_000_000, engineType: "EV", fuelEfficiency: 5.1, isDefault: true, specs: { range: "최대 485km", power: "225ps", charge: "800V" } },
      { name: "프레스티지", price: 50_500_000, engineType: "EV", fuelEfficiency: 5.1, isDefault: false, specs: { range: "최대 485km", power: "225ps", charge: "800V" } },
      { name: "롱레인지 AWD", price: 53_000_000, engineType: "EV", fuelEfficiency: 5.6, isDefault: false, specs: { range: "최대 430km", power: "306ps", charge: "800V" } },
    ],
  },
  {
    slug: "ioniq6",
    name: "아이오닉 6",
    brand: "현대",
    category: "세단",
    vehicleCode: "IONIQ6",
    basePrice: 52_000_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/ioniq6/24my/ioniq6_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 7,
    description: "완전한 전기 세단. 실용성과 주행 감각의 완벽한 균형.",
    trims: [
      { name: "익스클루시브", price: 52_000_000, engineType: "EV", fuelEfficiency: 5.0, isDefault: true, specs: { range: "최대 614km", power: "228ps", charge: "800V" } },
      { name: "프레스티지", price: 55_500_000, engineType: "EV", fuelEfficiency: 5.0, isDefault: false, specs: { range: "최대 614km", power: "228ps", charge: "800V" } },
    ],
  },
  {
    slug: "staria",
    name: "스타리아",
    brand: "현대",
    category: "밴",
    vehicleCode: "STARIA",
    basePrice: 37_600_000,
    thumbnailUrl: "https://www.hyundai.com/static/images/model/staria/24my/staria_highlights_usp.jpg",
    surchargeRate: 0,
    isPopular: false,
    displayOrder: 8,
    description: "미래형 MPV. 넉넉한 공간과 독보적인 디자인.",
    trims: [
      { name: "투어러 9인승", price: 37_600_000, engineType: "디젤", fuelEfficiency: 11.3, isDefault: true, specs: { engine: "2.2 디젤", power: "177ps", seat: "9인승" } },
      { name: "프리미엄 7인승", price: 42_200_000, engineType: "디젤", fuelEfficiency: 11.3, isDefault: false, specs: { engine: "2.2 디젤", power: "177ps", seat: "7인승" } },
    ],
  },

  // ── 기아 ──
  {
    slug: "k8",
    name: "K8",
    brand: "기아",
    category: "세단",
    vehicleCode: "K8",
    basePrice: 37_300_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/k8/25pe/gallery/image/asset/k8_gallery_image_01.jpg",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 9,
    description: "기아 준대형 세단. 세련된 디자인과 우수한 연비.",
    trims: [
      { name: "노블레스", price: 37_300_000, engineType: "가솔린", fuelEfficiency: 10.9, isDefault: true, specs: { engine: "2.5 GDi", power: "198ps" } },
      { name: "시그니처", price: 41_800_000, engineType: "가솔린", fuelEfficiency: 10.9, isDefault: false, specs: { engine: "2.5 GDi", power: "198ps" } },
      { name: "하이브리드 노블레스", price: 40_500_000, engineType: "하이브리드", fuelEfficiency: 17.4, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "k5",
    name: "K5",
    brand: "기아",
    category: "세단",
    vehicleCode: "K5",
    basePrice: 28_800_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krdl243/k5_s_c7s.png",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 10,
    description: "기아 중형 세단. 스포티한 디자인과 실용적인 가격.",
    trims: [
      { name: "트렌디", price: 28_800_000, engineType: "가솔린", fuelEfficiency: 12.8, isDefault: true, specs: { engine: "2.0 MPI", power: "160ps" } },
      { name: "프레스티지", price: 31_500_000, engineType: "가솔린", fuelEfficiency: 12.8, isDefault: false, specs: { engine: "2.0 MPI", power: "160ps" } },
      { name: "하이브리드 트렌디", price: 31_200_000, engineType: "하이브리드", fuelEfficiency: 19.4, isDefault: false, specs: { engine: "1.6T HEV", power: "195ps" } },
    ],
  },
  {
    slug: "sportage",
    name: "스포티지",
    brand: "기아",
    category: "SUV",
    vehicleCode: "SPORTAGE",
    basePrice: 30_500_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krnq259/sportage_s_swp.png",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 11,
    description: "기아 준중형 SUV. 압도적 판매량의 베스트셀러.",
    trims: [
      { name: "트렌디", price: 30_500_000, engineType: "가솔린", fuelEfficiency: 12.1, isDefault: true, specs: { engine: "1.6T GDi", power: "180ps" } },
      { name: "프레스티지", price: 33_800_000, engineType: "가솔린", fuelEfficiency: 12.1, isDefault: false, specs: { engine: "1.6T GDi", power: "180ps" } },
      { name: "하이브리드 트렌디", price: 34_000_000, engineType: "하이브리드", fuelEfficiency: 16.7, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "sorento",
    name: "쏘렌토",
    brand: "기아",
    category: "SUV",
    vehicleCode: "SORENTO",
    basePrice: 36_500_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krmq255/sorento_s_bn4.png",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 12,
    description: "기아 중형 SUV. 실용성과 고급감의 균형.",
    trims: [
      { name: "프레스티지", price: 36_500_000, engineType: "가솔린", fuelEfficiency: 10.5, isDefault: true, specs: { engine: "2.5 GDi", power: "194ps" } },
      { name: "시그니처", price: 40_800_000, engineType: "가솔린", fuelEfficiency: 10.5, isDefault: false, specs: { engine: "2.5 GDi", power: "194ps" } },
      { name: "하이브리드 프레스티지", price: 40_200_000, engineType: "하이브리드", fuelEfficiency: 14.3, isDefault: false, specs: { engine: "1.6T HEV", power: "230ps" } },
    ],
  },
  {
    slug: "carnival",
    name: "카니발",
    brand: "기아",
    category: "밴",
    vehicleCode: "CARNIVAL",
    basePrice: 36_300_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krkp214/carnival_s_isg.png",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 13,
    description: "국내 No.1 미니밴. 탁월한 공간과 다목적 활용성.",
    trims: [
      { name: "프레스티지 7인승", price: 36_300_000, engineType: "가솔린", fuelEfficiency: 9.8, isDefault: true, specs: { engine: "2.5 GDi", power: "194ps", seat: "7인승" } },
      { name: "시그니처 7인승", price: 40_600_000, engineType: "가솔린", fuelEfficiency: 9.8, isDefault: false, specs: { engine: "2.5 GDi", power: "194ps", seat: "7인승" } },
      { name: "프레스티지 9인승", price: 35_800_000, engineType: "가솔린", fuelEfficiency: 9.8, isDefault: false, specs: { engine: "2.5 GDi", power: "194ps", seat: "9인승" } },
      { name: "시그니처 9인승", price: 40_100_000, engineType: "가솔린", fuelEfficiency: 9.8, isDefault: false, specs: { engine: "2.5 GDi", power: "194ps", seat: "9인승" } },
    ],
  },
  {
    slug: "ev6",
    name: "EV6",
    brand: "기아",
    category: "SUV",
    vehicleCode: "EV6",
    basePrice: 48_800_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krcv253/ev6_s_swp.png",
    surchargeRate: 0,
    isPopular: true,
    displayOrder: 14,
    description: "기아의 전기 크로스오버. 날렵한 디자인과 긴 항속거리.",
    trims: [
      { name: "에어 스탠다드", price: 48_800_000, engineType: "EV", fuelEfficiency: 5.2, isDefault: true, specs: { range: "최대 494km", power: "226ps", charge: "800V" } },
      { name: "에어 롱레인지", price: 52_500_000, engineType: "EV", fuelEfficiency: 5.2, isDefault: false, specs: { range: "최대 494km", power: "226ps", charge: "800V" } },
      { name: "GT-Line AWD", price: 57_000_000, engineType: "EV", fuelEfficiency: 5.7, isDefault: false, specs: { range: "최대 400km", power: "325ps", charge: "800V" } },
    ],
  },
  {
    slug: "ev9",
    name: "EV9",
    brand: "기아",
    category: "SUV",
    vehicleCode: "EV9",
    basePrice: 73_700_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krmv297/ev9_s_ism.png",
    surchargeRate: 0.5,
    isPopular: false,
    displayOrder: 15,
    description: "기아 대형 전기 SUV. 프리미엄 전동화 시대의 시작.",
    trims: [
      { name: "에어 스탠다드", price: 73_700_000, engineType: "EV", fuelEfficiency: 4.8, isDefault: true, specs: { range: "최대 501km", power: "204ps", charge: "800V" } },
      { name: "에어 퍼포먼스 AWD", price: 77_700_000, engineType: "EV", fuelEfficiency: 5.3, isDefault: false, specs: { range: "최대 446km", power: "384ps", charge: "800V" } },
    ],
  },

  // ── 제네시스 ──
  {
    slug: "g80",
    name: "G80",
    brand: "제네시스",
    category: "세단",
    vehicleCode: "G80",
    basePrice: 58_900_000,
    thumbnailUrl: "https://www.genesis.com/content/dam/genesis-p2/kr/admin/model-information/G80/list-thumbnail/2026-01-06/16-22-33/genesis-kr-admin-model-list-thumbnail-g80-27my-pc-630x240-ko.png",
    surchargeRate: 0.3,
    isPopular: true,
    displayOrder: 16,
    description: "제네시스 대표 세단. 우아한 디자인과 탁월한 승차감.",
    trims: [
      { name: "2.5T 프리미엄", price: 58_900_000, engineType: "가솔린", fuelEfficiency: 9.7, isDefault: true, specs: { engine: "2.5T", power: "304ps" } },
      { name: "2.5T 럭셔리", price: 64_800_000, engineType: "가솔린", fuelEfficiency: 9.7, isDefault: false, specs: { engine: "2.5T", power: "304ps" } },
      { name: "3.5T 프리미엄", price: 65_500_000, engineType: "가솔린", fuelEfficiency: 8.8, isDefault: false, specs: { engine: "3.5T", power: "380ps" } },
    ],
  },
  {
    slug: "gv70",
    name: "GV70",
    brand: "제네시스",
    category: "SUV",
    vehicleCode: "GV70",
    basePrice: 48_500_000,
    thumbnailUrl: "https://www.genesis.com/content/dam/genesis/au/en/models/luxury-suv-genesis/gv70/gallery/03_GV70_Standard_Driving_Front-Quarter_1920x960.jpg",
    surchargeRate: 0.3,
    isPopular: true,
    displayOrder: 17,
    description: "제네시스 중형 럭셔리 SUV. 역동적인 디자인.",
    trims: [
      { name: "2.0T 프리미엄", price: 48_500_000, engineType: "가솔린", fuelEfficiency: 10.3, isDefault: true, specs: { engine: "2.0T", power: "254ps" } },
      { name: "2.0T 스포츠", price: 52_800_000, engineType: "가솔린", fuelEfficiency: 10.3, isDefault: false, specs: { engine: "2.0T", power: "254ps" } },
      { name: "2.5T 스포츠", price: 57_500_000, engineType: "가솔린", fuelEfficiency: 9.4, isDefault: false, specs: { engine: "2.5T", power: "304ps" } },
    ],
  },
  {
    slug: "gv80",
    name: "GV80",
    brand: "제네시스",
    category: "SUV",
    vehicleCode: "GV80",
    basePrice: 66_300_000,
    thumbnailUrl: "https://www.genesis.com/content/dam/genesis-p2/kr/assets/models/gv80-black/gallery/genesis-kr-gv80-black-galleryKV-large.jpg",
    surchargeRate: 0.5,
    isPopular: false,
    displayOrder: 18,
    description: "제네시스 플래그십 SUV. 럭셔리와 퍼포먼스의 정점.",
    trims: [
      { name: "2.5T 프리미엄 5인승", price: 66_300_000, engineType: "가솔린", fuelEfficiency: 9.2, isDefault: true, specs: { engine: "2.5T", power: "304ps" } },
      { name: "2.5T 럭셔리 7인승", price: 72_000_000, engineType: "가솔린", fuelEfficiency: 9.2, isDefault: false, specs: { engine: "2.5T", power: "304ps" } },
      { name: "3.5T 프리미엄", price: 73_800_000, engineType: "가솔린", fuelEfficiency: 8.5, isDefault: false, specs: { engine: "3.5T", power: "380ps" } },
    ],
  },

  // ── 기타 ──
  {
    slug: "porter2-ev",
    name: "포터 II EV",
    brand: "현대",
    category: "트럭",
    vehicleCode: "PORTER2EV",
    basePrice: 43_500_000,
    thumbnailUrl: "https://www.hyundai.com/contents/repn-car/side-w/porter2-electric-26my-well-side.png",
    surchargeRate: 0,
    isPopular: false,
    displayOrder: 19,
    description: "1톤 전기 트럭. 자영업자와 소상공인의 필수 파트너.",
    trims: [
      { name: "초장축 슈퍼캡", price: 43_500_000, engineType: "EV", fuelEfficiency: null, isDefault: true, specs: { range: "최대 211km", payload: "1톤" } },
      { name: "장축 일반캡", price: 41_200_000, engineType: "EV", fuelEfficiency: null, isDefault: false, specs: { range: "최대 211km", payload: "1톤" } },
    ],
  },
  {
    slug: "bongo3-ev",
    name: "봉고 III EV",
    brand: "기아",
    category: "트럭",
    vehicleCode: "BONGO3EV",
    basePrice: 44_200_000,
    thumbnailUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/represent/krb1279/bongo3-ev_s_ud.png",
    surchargeRate: 0,
    isPopular: false,
    displayOrder: 20,
    description: "기아 1톤 전기 트럭. 친환경 물류의 새 기준.",
    trims: [
      { name: "초장축 슈퍼캡", price: 44_200_000, engineType: "EV", fuelEfficiency: null, isDefault: true, specs: { range: "최대 211km", payload: "1톤" } },
    ],
  },
];

// ─── 회수율 매트릭스 생성 헬퍼 ──────────────────────────

/**
 * 범용 회수율 생성
 * baseRate(48개월·2만km 기준)를 기준으로 기간·거리별 현실적 조정
 *
 * 계약기간별 조정 근거 (실제 장기렌트 시장):
 *   36개월: 잔존가치·리스크 높아 48개월 대비 약 +18~22% 회수율
 *   48개월: 기준
 *   60개월: 장기계약 할인 효과로 48개월 대비 약 -15~18% 회수율
 *
 * 주행거리별 조정 근거:
 *   10000km: 차량 소모 적어 잔존가치 높음 → 약 -5% 회수율
 *   20000km: 기준
 *   30000km: 차량 소모 커 잔존가치 낮음 → 약 +5% 회수율
 */
function generateRateMatrix(baseRate: number): Record<string, Record<string, number>> {
  // 계약기간별 조정 (baseRate 대비 절대값 조정)
  const monthsAdjust: Record<string, number> = {
    "36": baseRate * 0.20,   // +20%: 36개월은 단기계약, 회수율 높음
    "48": 0,                 // 기준
    "60": baseRate * -0.16,  // -16%: 60개월 장기계약, 회수율 낮음
  };

  // 주행거리별 조정 (baseRate 대비 절대값 조정)
  const mileageAdjust: Record<string, number> = {
    "10000": baseRate * -0.05,  // -5%: 저주행 → 잔존가치 높음
    "20000": 0,                 // 기준
    "30000": baseRate * 0.05,   // +5%: 고주행 → 잔존가치 낮음
  };

  const matrix: Record<string, Record<string, number>> = {};
  for (const [mileage, mAdj] of Object.entries(mileageAdjust)) {
    matrix[mileage] = {};
    for (const [months, tAdj] of Object.entries(monthsAdjust)) {
      matrix[mileage][months] = parseFloat((baseRate + mAdj + tAdj).toFixed(6));
    }
  }
  return matrix;
}

// ─── 메인 시드 함수 ─────────────────────────────────────

async function main() {
  console.log("🌱 시드 데이터 삽입 시작...\n");

  // 1) 순위 가산율
  console.log("📊 순위 가산율 생성...");
  for (const rs of rankSurcharges) {
    await prisma.rankSurchargeConfig.upsert({
      where: { rank: rs.rank },
      update: { rate: rs.rate },
      create: rs,
    });
  }
  console.log(`   ✅ ${rankSurcharges.length}개 순위 가산율\n`);

  // 2) 금융사
  console.log("🏦 금융사 생성...");
  const fcIds: Record<string, string> = {};
  for (const fc of financeCompanies) {
    const created = await prisma.financeCompany.upsert({
      where: { code: fc.code },
      update: { name: fc.name, surchargeRate: fc.surchargeRate, displayOrder: fc.displayOrder },
      create: fc,
    });
    fcIds[fc.code] = created.id;
  }
  console.log(`   ✅ ${financeCompanies.length}개 금융사\n`);

  // 3) 차량 + 트림
  console.log("🚗 차량 및 트림 생성...");
  const vehicleIds: Record<string, string> = {};

  for (const v of vehicles) {
    // 기존 thumbnailUrl 보존 (관리자가 설정한 이미지 URL을 seed가 덮어쓰지 않도록)
    const existing = await prisma.vehicle.findUnique({
      where: { slug: v.slug },
      select: { thumbnailUrl: true },
    });
    const thumbnailUrl = existing?.thumbnailUrl || v.thumbnailUrl;

    const created = await prisma.vehicle.upsert({
      where: { slug: v.slug },
      update: {
        name: v.name,
        brand: v.brand,
        category: v.category,
        vehicleCode: v.vehicleCode,
        basePrice: v.basePrice,
        thumbnailUrl,
        surchargeRate: v.surchargeRate,
        isPopular: v.isPopular,
        displayOrder: v.displayOrder,
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
        imageUrls: [],
        surchargeRate: v.surchargeRate,
        isPopular: v.isPopular,
        displayOrder: v.displayOrder,
        description: v.description,
      },
    });
    vehicleIds[v.slug] = created.id;

    // 트림: 이미 존재하면 스킵 (seed-trims.ts에서 임포트한 상세 데이터 보존)
    const existingTrimCount = await prisma.trim.count({ where: { vehicleId: created.id } });
    if (existingTrimCount === 0) {
      for (const t of v.trims) {
        await prisma.trim.create({
          data: {
            vehicleId: created.id,
            name: t.name,
            price: t.price,
            engineType: t.engineType,
            fuelEfficiency: t.fuelEfficiency,
            isDefault: t.isDefault,
            specs: t.specs,
          },
        });
      }
      console.log(`   ✅ ${v.brand} ${v.name} (${v.trims.length}개 트림 신규 생성)`);
    } else {
      console.log(`   ↩ ${v.brand} ${v.name} (트림 ${existingTrimCount}개 이미 존재, 스킵)`);
    }
  }

  // 4) 회수율 (RateConfig) — 금융사 × 차량 코드
  console.log("\n📈 회수율(RateConfig) 생성...");

  // 금융사별 기본 회수율 차이 (IM이 가장 낮은 기본 회수율 = 가장 저렴)
  const fcBaseRateOffset: Record<string, number> = {
    IM: 0,
    SHINHAN: 0.0003,
    BNK: 0.0002,
    ORIX: 0.0005,
  };

  // 차량 카테고리별 기본 회수율
  const categoryBaseRate: Record<string, number> = {
    세단: 0.0218,
    SUV: 0.0225,
    밴: 0.0230,
    트럭: 0.0235,
  };

  // 차량가격대별 min/max 구간
  const priceRanges: Record<string, { min: number; max: number }> = {
    low: { min: 25_000_000, max: 40_000_000 },
    mid: { min: 35_000_000, max: 55_000_000 },
    high: { min: 50_000_000, max: 80_000_000 },
  };

  let rateConfigCount = 0;
  for (const v of vehicles) {
    const priceRange = v.basePrice < 35_000_000 ? "low" : v.basePrice < 55_000_000 ? "mid" : "high";
    const range = priceRanges[priceRange];
    const baseRate = categoryBaseRate[v.category] ?? 0.0225;

    for (const [fcCode, fcId] of Object.entries(fcIds)) {
      const offset = fcBaseRateOffset[fcCode] ?? 0;
      const effectiveRate = baseRate + offset;

      // 렌트 회수율
      await prisma.rateConfig.upsert({
        where: {
          financeCompanyId_vehicleCode_productType: {
            financeCompanyId: fcId,
            vehicleCode: v.vehicleCode,
            productType: "렌트",
          },
        },
        update: {
          minVehiclePrice: range.min,
          maxVehiclePrice: range.max,
          minPriceRates: generateRateMatrix(effectiveRate),
          maxPriceRates: generateRateMatrix(effectiveRate + 0.0008),
          depositDiscountRate: -0.000523, // [수정] 명세 기준값
          prepayAdjustRate: 0.000073,     // [수정] 명세 기준값 (양수 저장, 계산 시 차감)
        },
        create: {
          financeCompanyId: fcId,
          vehicleCode: v.vehicleCode,
          productType: "렌트",
          minVehiclePrice: range.min,
          maxVehiclePrice: range.max,
          minPriceRates: generateRateMatrix(effectiveRate),
          maxPriceRates: generateRateMatrix(effectiveRate + 0.0008),
          depositDiscountRate: -0.000523, // [수정] 명세 기준값
          prepayAdjustRate: 0.000073,     // [수정] 명세 기준값 (양수 저장, 계산 시 차감)
        },
      });

      // 리스 회수율 (렌트보다 약간 낮음)
      await prisma.rateConfig.upsert({
        where: {
          financeCompanyId_vehicleCode_productType: {
            financeCompanyId: fcId,
            vehicleCode: v.vehicleCode,
            productType: "리스",
          },
        },
        update: {
          minVehiclePrice: range.min,
          maxVehiclePrice: range.max,
          minPriceRates: generateRateMatrix(effectiveRate - 0.0015),
          maxPriceRates: generateRateMatrix(effectiveRate - 0.0007),
          depositDiscountRate: -0.0010,
          prepayAdjustRate: 0.0003,
        },
        create: {
          financeCompanyId: fcId,
          vehicleCode: v.vehicleCode,
          productType: "리스",
          minVehiclePrice: range.min,
          maxVehiclePrice: range.max,
          minPriceRates: generateRateMatrix(effectiveRate - 0.0015),
          maxPriceRates: generateRateMatrix(effectiveRate - 0.0007),
          depositDiscountRate: -0.0010,
          prepayAdjustRate: 0.0003,
        },
      });

      rateConfigCount += 2;
    }
  }
  console.log(`   ✅ ${rateConfigCount}개 회수율 설정 (${vehicles.length}개 차량 × ${financeCompanies.length}개 금융사 × 2종)\n`);

  // [수정] ORIX × SORENTO 실제 회수율 데이터로 덮어쓰기 (명세 기준)
  console.log("📈 ORIX × SORENTO 실제 회수율 업데이트...");
  const orixId = fcIds["ORIX"];
  if (orixId) {
    await prisma.rateConfig.upsert({
      where: {
        financeCompanyId_vehicleCode_productType: {
          financeCompanyId: orixId,
          vehicleCode: "SORENTO",
          productType: "렌트",
        },
      },
      update: {
        minVehiclePrice: 43_840_000,
        maxVehiclePrice: 49_290_000,
        minPriceRates: {
          "10000": { "36": 0.012325, "48": 0.012726, "60": 0.012110 },
          "20000": { "36": 0.013337, "48": 0.012506, "60": 0.012181 },
          "30000": { "36": 0.013993, "48": 0.013682, "60": 0.012997 },
        },
        maxPriceRates: {
          "10000": { "36": 0.012634, "48": 0.012914, "60": 0.012236 },
          "20000": { "36": 0.013695, "48": 0.012841, "60": 0.012406 },
          "30000": { "36": 0.014395, "48": 0.013986, "60": 0.013126 },
        },
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
      },
      create: {
        financeCompanyId: orixId,
        vehicleCode: "SORENTO",
        productType: "렌트",
        minVehiclePrice: 43_840_000,
        maxVehiclePrice: 49_290_000,
        minPriceRates: {
          "10000": { "36": 0.012325, "48": 0.012726, "60": 0.012110 },
          "20000": { "36": 0.013337, "48": 0.012506, "60": 0.012181 },
          "30000": { "36": 0.013993, "48": 0.013682, "60": 0.012997 },
        },
        maxPriceRates: {
          "10000": { "36": 0.012634, "48": 0.012914, "60": 0.012236 },
          "20000": { "36": 0.013695, "48": 0.012841, "60": 0.012406 },
          "30000": { "36": 0.014395, "48": 0.013986, "60": 0.013126 },
        },
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
      },
    });
    console.log("   ✅ ORIX × SORENTO 실제 회수율 설정 완료\n");
  }

  // 5) AI 추천 기초 데이터 (RecommendationConfig)
  console.log("🤖 AI 추천 기초 데이터 생성...");

  const scoreProfiles: Record<string, {
    business: number; family: number; commute: number; leisure: number;
    budget: string; highlights: string[]; caption: string;
  }> = {
    grandeur: { business: 9, family: 7, commute: 8, leisure: 6, budget: "mid", highlights: ["법인 인기 1위", "넓은 실내공간", "합리적 유지비"], caption: "사업용 차량의 정석. 격식과 실용의 균형." },
    sonata: { business: 7, family: 6, commute: 9, leisure: 5, budget: "low", highlights: ["최고의 가성비", "높은 연비", "넉넉한 트렁크"], caption: "출퇴근부터 업무용까지. 가장 합리적인 선택." },
    tucson: { business: 5, family: 8, commute: 7, leisure: 8, budget: "low", highlights: ["하이브리드 연비 16.2km/L", "넉넉한 적재공간", "5인 가족 최적"], caption: "가족 SUV의 표준. 연비와 공간 모두 만족." },
    santafe: { business: 6, family: 9, commute: 6, leisure: 8, budget: "mid", highlights: ["7인승 가능", "넉넉한 2열 공간", "안정적인 승차감"], caption: "가족이 많을수록 빛나는 중형 SUV." },
    palisade: { business: 5, family: 10, commute: 5, leisure: 9, budget: "mid", highlights: ["대형 SUV", "7·8인승", "프리미엄 승차감"], caption: "대가족의 든든한 파트너. 여유로운 공간." },
    ioniq5: { business: 7, family: 7, commute: 9, leisure: 7, budget: "mid", highlights: ["800V 초급속 충전", "넓은 실내", "비용처리 유리"], caption: "전기차 시대의 스마트한 선택." },
    ioniq6: { business: 8, family: 5, commute: 9, leisure: 6, budget: "mid", highlights: ["614km 주행거리", "800V 충전", "세련된 디자인"], caption: "효율과 디자인을 모두 잡은 전기 세단." },
    staria: { business: 4, family: 8, commute: 4, leisure: 7, budget: "mid", highlights: ["최대 9인승", "미래형 디자인", "넓은 화물 공간"], caption: "다인승 이동의 새로운 기준." },
    k8: { business: 9, family: 7, commute: 8, leisure: 6, budget: "mid", highlights: ["세련된 디자인", "하이브리드 17.4km/L", "임원급 품격"], caption: "품격 있는 비즈니스 세단." },
    k5: { business: 7, family: 6, commute: 9, leisure: 5, budget: "low", highlights: ["스포티한 디자인", "하이브리드 19.4km/L", "합리적 가격"], caption: "젊은 사업가의 스마트한 선택." },
    sportage: { business: 5, family: 8, commute: 7, leisure: 8, budget: "low", highlights: ["국내 판매 1위", "하이브리드 16.7km/L", "넓은 실내"], caption: "판매량이 증명하는 실용 SUV." },
    sorento: { business: 6, family: 9, commute: 6, leisure: 8, budget: "mid", highlights: ["7인승 가능", "넉넉한 공간", "하이브리드 선택"], caption: "쏘렌토는 가족의 선택." },
    carnival: { business: 4, family: 10, commute: 4, leisure: 8, budget: "mid", highlights: ["국내 1위 미니밴", "9인승 비용처리", "최대 공간"], caption: "9인승 비용처리의 정석." },
    ev6: { business: 7, family: 7, commute: 9, leisure: 7, budget: "mid", highlights: ["800V 급속충전", "스포티한 디자인", "넉넉한 주행거리"], caption: "미래 지향 전기 크로스오버." },
    ev9: { business: 6, family: 8, commute: 5, leisure: 7, budget: "high", highlights: ["대형 전기 SUV", "프리미엄 인테리어", "501km 주행"], caption: "전동화 시대의 프리미엄." },
    g80: { business: 10, family: 6, commute: 7, leisure: 5, budget: "high", highlights: ["법인 대표 세단", "최고급 승차감", "제네시스 브랜드"], caption: "대표이사의 차. 품격의 완성." },
    gv70: { business: 8, family: 7, commute: 7, leisure: 7, budget: "mid", highlights: ["럭셔리 중형 SUV", "역동적 디자인", "합리적 제네시스"], caption: "접근 가능한 럭셔리." },
    gv80: { business: 9, family: 7, commute: 6, leisure: 6, budget: "high", highlights: ["플래그십 SUV", "최고급 인테리어", "강력한 퍼포먼스"], caption: "럭셔리와 퍼포먼스의 정점." },
    "porter2-ev": { business: 3, family: 1, commute: 3, leisure: 1, budget: "mid", highlights: ["전기 1톤 트럭", "자영업 필수", "운영비 절감"], caption: "소상공인의 친환경 파트너." },
    "bongo3-ev": { business: 3, family: 1, commute: 3, leisure: 1, budget: "mid", highlights: ["전기 1톤 트럭", "물류 최적화", "운영비 절감"], caption: "친환경 물류의 새 기준." },
  };

  for (const v of vehicles) {
    const profile = scoreProfiles[v.slug];
    if (!profile) continue;

    const budgetRange = { low: [200, 400], mid: [350, 600], high: [500, 900] }[profile.budget] ?? [300, 600];

    await prisma.recommendationConfig.upsert({
      where: { vehicleId: vehicleIds[v.slug] },
      update: {
        scoreMatrix: {
          industry: { 법인사업자: profile.business, 개인사업자: Math.max(1, profile.business - 1), 프리랜서: Math.max(1, profile.business - 2) },
          purpose: { 업무용: profile.commute, 출퇴근: profile.commute, 가족용: profile.family, 레저: profile.leisure },
          budget: { min: budgetRange[0], max: budgetRange[1] },
        },
        highlights: profile.highlights,
        aiCaption: profile.caption,
      },
      create: {
        vehicleId: vehicleIds[v.slug],
        scoreMatrix: {
          industry: { 법인사업자: profile.business, 개인사업자: Math.max(1, profile.business - 1), 프리랜서: Math.max(1, profile.business - 2) },
          purpose: { 업무용: profile.commute, 출퇴근: profile.commute, 가족용: profile.family, 레저: profile.leisure },
          budget: { min: budgetRange[0], max: budgetRange[1] },
        },
        highlights: profile.highlights,
        aiCaption: profile.caption,
        updatedBy: "seed",
      },
    });
  }
  console.log(`   ✅ ${Object.keys(scoreProfiles).length}개 추천 기초 데이터\n`);

  // 6) 메인 배너
  console.log("🎨 메인 배너 생성...");
  await prisma.contentBanner.upsert({
    where: { id: "hero-main" },
    update: {},
    create: {
      id: "hero-main",
      type: "hero",
      title: "AI가 찾아주는 진짜견적",
      subtitle: "허위견적 없이, 개인정보 없이, 내 조건에 맞는 장기렌트·리스 견적을 바로 확인하세요.",
      ctaLabel: "AI 추천 시작하기",
      ctaUrl: "/recommend",
      displayOrder: 1,
    },
  });
  console.log("   ✅ 히어로 배너\n");

  // 7) 추천 구성 (PopularConfig)
  console.log("🔧 추천 구성 생성...");

  const popularConfigsData: {
    slug: string;
    configs: { name: string; note?: string; displayOrder: number; items: { name: string; price: number; displayOrder: number }[] }[];
  }[] = [
    {
      slug: "grandeur",
      configs: [
        {
          name: "편의 패키지", note: "법인 고객 78% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_160_000, displayOrder: 1 },
            { name: "통풍·열선시트", price: 690_000, displayOrder: 2 },
            { name: "HUD(헤드업 디스플레이)", price: 500_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 92% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스 Ⅱ", price: 500_000, displayOrder: 1 },
            { name: "후측방 모니터(BVM)", price: 300_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "sonata",
      configs: [
        {
          name: "편의 패키지", note: "개인 고객 71% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 890_000, displayOrder: 1 },
            { name: "내비게이션(10.25인치)", price: 890_000, displayOrder: 2 },
            { name: "통풍시트", price: 490_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 88% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스", price: 400_000, displayOrder: 1 },
            { name: "후측방 충돌방지 보조", price: 200_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "tucson",
      configs: [
        {
          name: "편의 패키지", note: "가족 고객 82% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프 + 루프랙", price: 1_160_000, displayOrder: 1 },
            { name: "인포테인먼트 내비", price: 890_000, displayOrder: 2 },
            { name: "컴포트 Ⅰ(통풍·열선시트)", price: 690_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 90% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스", price: 400_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 500_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "santafe",
      configs: [
        {
          name: "프리미엄 편의 패키지", note: "패밀리 고객 85% 선택", displayOrder: 1,
          items: [
            { name: "2열 파워 도어", price: 800_000, displayOrder: 1 },
            { name: "파노라믹 선루프", price: 1_100_000, displayOrder: 2 },
            { name: "컴포트 패키지(통풍·마사지시트)", price: 990_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 93% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스 Ⅱ", price: 500_000, displayOrder: 1 },
            { name: "주차충돌방지 보조 Ⅱ", price: 300_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "palisade",
      configs: [
        {
          name: "럭셔리 편의 패키지", note: "법인 고객 80% 선택", displayOrder: 1,
          items: [
            { name: "렉시콘 프리미엄 사운드", price: 990_000, displayOrder: 1 },
            { name: "2열 열선·통풍시트", price: 690_000, displayOrder: 2 },
            { name: "파노라믹 선루프", price: 1_200_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 94% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스 Ⅱ", price: 500_000, displayOrder: 1 },
            { name: "후측방 모니터(BVM)", price: 300_000, displayOrder: 2 },
            { name: "빌트인 캠", price: 400_000, displayOrder: 3 },
          ],
        },
      ],
    },
    {
      slug: "ioniq5",
      configs: [
        {
          name: "편의 패키지", note: "전기차 고객 77% 선택", displayOrder: 1,
          items: [
            { name: "파노라믹 글라스루프", price: 990_000, displayOrder: 1 },
            { name: "릴렉션 컴포트 시트", price: 890_000, displayOrder: 2 },
            { name: "빌트인 캠 2채널", price: 500_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 91% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스 Ⅱ", price: 500_000, displayOrder: 1 },
            { name: "디지털 사이드 미러", price: 690_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "ioniq6",
      configs: [
        {
          name: "편의 패키지", note: "개인 고객 73% 선택", displayOrder: 1,
          items: [
            { name: "파노라믹 글라스루프", price: 990_000, displayOrder: 1 },
            { name: "증강현실 내비(AR HUD)", price: 690_000, displayOrder: 2 },
            { name: "릴렉션 시트", price: 790_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 89% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스", price: 400_000, displayOrder: 1 },
            { name: "디지털 사이드 미러", price: 690_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "staria",
      configs: [
        {
          name: "편의 패키지", note: "패밀리·법인 85% 선택", displayOrder: 1,
          items: [
            { name: "2열 파워 슬라이딩 도어", price: 500_000, displayOrder: 1 },
            { name: "파노라믹 선루프", price: 990_000, displayOrder: 2 },
            { name: "2·3열 열선시트", price: 490_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 88% 선택", displayOrder: 2,
          items: [
            { name: "현대 스마트센스 Ⅱ", price: 500_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 500_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "k8",
      configs: [
        {
          name: "편의 패키지", note: "법인 고객 76% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_000_000, displayOrder: 1 },
            { name: "HUD(헤드업 디스플레이)", price: 500_000, displayOrder: 2 },
            { name: "릴렉션 컴포트 시트", price: 890_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 90% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈", price: 490_000, displayOrder: 1 },
            { name: "후측방 충돌 방지 보조", price: 290_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "k5",
      configs: [
        {
          name: "편의 패키지", note: "개인 고객 69% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 890_000, displayOrder: 1 },
            { name: "내비게이션 패키지", price: 790_000, displayOrder: 2 },
            { name: "통풍시트", price: 490_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 86% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈", price: 490_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 490_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "sportage",
      configs: [
        {
          name: "편의 패키지", note: "가족 고객 79% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 990_000, displayOrder: 1 },
            { name: "12.3인치 내비게이션", price: 890_000, displayOrder: 2 },
            { name: "통풍·열선시트", price: 590_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 91% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈", price: 490_000, displayOrder: 1 },
            { name: "빌트인 캠 2채널", price: 490_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "sorento",
      configs: [
        {
          name: "프리미엄 편의 패키지", note: "패밀리 고객 83% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_100_000, displayOrder: 1 },
            { name: "2열 열선·통풍시트", price: 590_000, displayOrder: 2 },
            { name: "HUD(헤드업 디스플레이)", price: 490_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 92% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈 Ⅱ", price: 590_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 490_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "carnival",
      configs: [
        {
          name: "패밀리 편의 패키지", note: "패밀리 고객 87% 선택", displayOrder: 1,
          items: [
            { name: "파워 슬라이딩 도어(양측)", price: 890_000, displayOrder: 1 },
            { name: "파노라마 선루프", price: 1_100_000, displayOrder: 2 },
            { name: "2·3열 열선시트", price: 490_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 89% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈", price: 490_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터 Ⅱ", price: 590_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "ev6",
      configs: [
        {
          name: "편의 패키지", note: "전기차 고객 74% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 990_000, displayOrder: 1 },
            { name: "빌트인 캠 2채널", price: 490_000, displayOrder: 2 },
            { name: "릴렉션 시트", price: 890_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 90% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈", price: 490_000, displayOrder: 1 },
            { name: "디지털 사이드 미러", price: 690_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "ev9",
      configs: [
        {
          name: "럭셔리 편의 패키지", note: "법인 고객 81% 선택", displayOrder: 1,
          items: [
            { name: "듀얼 파노라마 선루프", price: 1_400_000, displayOrder: 1 },
            { name: "VIP 릴렉션 시트(2열)", price: 1_200_000, displayOrder: 2 },
            { name: "메리디안 프리미엄 사운드", price: 1_100_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 95% 선택", displayOrder: 2,
          items: [
            { name: "기아 드라이브 와이즈 Ⅱ", price: 590_000, displayOrder: 1 },
            { name: "원격 스마트 주차 보조", price: 490_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "g80",
      configs: [
        {
          name: "제네시스 편의 패키지", note: "법인 고객 86% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_300_000, displayOrder: 1 },
            { name: "마그네슘 제어 서스펜션(MCS)", price: 1_100_000, displayOrder: 2 },
            { name: "후석 엔터테인먼트(RSE)", price: 990_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 94% 선택", displayOrder: 2,
          items: [
            { name: "제네시스 액티브 세이프티 Ⅱ", price: 690_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 490_000, displayOrder: 2 },
            { name: "원격 스마트 주차 보조 Ⅱ", price: 490_000, displayOrder: 3 },
          ],
        },
      ],
    },
    {
      slug: "gv70",
      configs: [
        {
          name: "제네시스 편의 패키지", note: "법인 고객 79% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_200_000, displayOrder: 1 },
            { name: "릴렉션 컴포트 시트", price: 990_000, displayOrder: 2 },
            { name: "HUD(헤드업 디스플레이)", price: 590_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 91% 선택", displayOrder: 2,
          items: [
            { name: "제네시스 액티브 세이프티 Ⅱ", price: 690_000, displayOrder: 1 },
            { name: "서라운드뷰 모니터", price: 490_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "gv80",
      configs: [
        {
          name: "플래그십 편의 패키지", note: "법인 고객 88% 선택", displayOrder: 1,
          items: [
            { name: "파노라마 선루프", price: 1_400_000, displayOrder: 1 },
            { name: "후석 엔터테인먼트(RSE)", price: 1_100_000, displayOrder: 2 },
            { name: "럭셔리 릴렉션 시트", price: 1_200_000, displayOrder: 3 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 96% 선택", displayOrder: 2,
          items: [
            { name: "제네시스 액티브 세이프티 Ⅱ", price: 690_000, displayOrder: 1 },
            { name: "원격 스마트 주차 보조 Ⅱ", price: 590_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "porter2ev",
      configs: [
        {
          name: "업무 편의 패키지", note: "사업자 고객 72% 선택", displayOrder: 1,
          items: [
            { name: "인포테인먼트 내비(7인치)", price: 490_000, displayOrder: 1 },
            { name: "후방 카메라 고화질", price: 290_000, displayOrder: 2 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 85% 선택", displayOrder: 2,
          items: [
            { name: "전방 충돌방지 보조", price: 300_000, displayOrder: 1 },
            { name: "차로 이탈방지 보조", price: 200_000, displayOrder: 2 },
          ],
        },
      ],
    },
    {
      slug: "bongo3ev",
      configs: [
        {
          name: "업무 편의 패키지", note: "사업자 고객 70% 선택", displayOrder: 1,
          items: [
            { name: "내비게이션(8인치)", price: 490_000, displayOrder: 1 },
            { name: "후방 카메라", price: 290_000, displayOrder: 2 },
          ],
        },
        {
          name: "안전 패키지", note: "전 고객 83% 선택", displayOrder: 2,
          items: [
            { name: "전방 충돌방지 보조", price: 300_000, displayOrder: 1 },
            { name: "차로 이탈방지 보조", price: 200_000, displayOrder: 2 },
          ],
        },
      ],
    },
  ];

  let configCount = 0;
  for (const entry of popularConfigsData) {
    const vehicle = await prisma.vehicle.findUnique({ where: { slug: entry.slug } });
    if (!vehicle) continue;

    // 이미 있으면 스킵
    const existing = await prisma.popularConfig.count({ where: { vehicleId: vehicle.id } });
    if (existing > 0) {
      console.log(`   ↩ ${vehicle.name} 추천 구성 (이미 존재, 스킵)`);
      continue;
    }

    for (const cfg of entry.configs) {
      await prisma.popularConfig.create({
        data: {
          vehicleId: vehicle.id,
          name: cfg.name,
          note: cfg.note,
          displayOrder: cfg.displayOrder,
          items: {
            create: cfg.items,
          },
        },
      });
      configCount++;
    }
  }
  console.log(`   ✅ ${configCount}개 추천 구성 생성\n`);

  // 8) TrimOptions 생성 + PopularConfigItem 연결
  console.log("🔧 TrimOptions 생성 및 연결...");
  let trimOptionCount = 0;
  let linkCount = 0;

  for (const entry of popularConfigsData) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { slug: entry.slug },
      include: { trims: { where: { isDefault: true }, take: 1 } },
    });
    if (!vehicle || vehicle.trims.length === 0) continue;
    const defaultTrim = vehicle.trims[0];

    // 기존 TrimOptions 로드 (이름→ID 맵)
    const existingOptions = await prisma.trimOption.findMany({
      where: { trimId: defaultTrim.id },
      select: { id: true, name: true, price: true },
    });
    const optionMap = new Map(existingOptions.map((o) => [`${o.name}::${o.price}`, o.id]));

    const vehiclePopularConfigs = await prisma.popularConfig.findMany({
      where: { vehicleId: vehicle.id },
      include: { items: { orderBy: { displayOrder: "asc" } } },
    });

    for (const config of vehiclePopularConfigs) {
      for (const item of config.items) {
        // 이미 연결되어 있으면 스킵
        if (item.trimOptionId) continue;

        const key = `${item.name}::${item.price}`;
        let trimOptionId = optionMap.get(key);

        if (!trimOptionId) {
          // TrimOption 신규 생성
          const trimOption = await prisma.trimOption.create({
            data: { trimId: defaultTrim.id, name: item.name, price: item.price },
          });
          trimOptionId = trimOption.id;
          optionMap.set(key, trimOptionId);
          trimOptionCount++;
        }

        // PopularConfigItem에 연결
        await prisma.popularConfigItem.update({
          where: { id: item.id },
          data: { trimOptionId },
        });
        linkCount++;
      }
    }
    if (linkCount > 0) console.log(`   ✅ ${vehicle.name} 연결 완료`);
  }
  console.log(`   ✅ TrimOption 신규 ${trimOptionCount}개 생성, ${linkCount}개 연결\n`);

  // 초기 어드민 계정
  const adminEmail = process.env.ADMIN_INITIAL_EMAIL ?? "admin@imdealers.com";
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ?? "changeme123!";
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: "관리자",
        role: "admin",
        isActive: true,
      },
    });
    console.log(`👤 어드민 계정 생성: ${adminEmail}`);
  } else {
    console.log(`👤 어드민 계정 이미 존재: ${adminEmail}`);
  }

  console.log("✨ 시드 데이터 삽입 완료!");
}

main()
  .catch((e) => {
    console.error("❌ 시드 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
