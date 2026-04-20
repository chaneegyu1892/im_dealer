import type { VehicleCategory, EngineType } from "@/types/vehicle";

export interface MockVehicle {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  engineType: EngineType;
  basePrice: number;
  monthlyFrom: number;        // 표준형 36개월 기준 최저 월납입 (원)
  thumbnailUrl: string;
  isPopular: boolean;
  isFeatured: boolean;
  tags: string[];
  shortDesc: string;
  brandColor: string;         // 이미지 없을 때 placeholder 그라디언트
  keySpecs: { label: string; value: string }[];
}

export const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: "1",
    slug: "ioniq6",
    name: "아이오닉 6",
    brand: "현대",
    category: "세단",
    engineType: "EV",
    basePrice: 55_000_000,
    monthlyFrom: 720_000,
    thumbnailUrl: "",
    isPopular: true,
    isFeatured: true,
    tags: ["인기", "EV", "비용처리 가능"],
    shortDesc: "완전한 전기 세단. 실용성과 주행 감각의 완벽한 균형.",
    brandColor: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
    keySpecs: [
      { label: "주행거리", value: "최대 614km" },
      { label: "출력", value: "228hp" },
      { label: "충전", value: "800V 급속" },
    ],
  },
  {
    id: "2",
    slug: "ev6",
    name: "더 뉴 EV6",
    brand: "기아",
    category: "세단",
    engineType: "EV",
    basePrice: 52_000_000,
    monthlyFrom: 680_000,
    thumbnailUrl: "",
    isPopular: true,
    isFeatured: true,
    tags: ["인기", "EV", "비용처리 가능"],
    shortDesc: "기아의 전기 크로스오버. 날렵한 디자인과 긴 항속거리.",
    brandColor: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
    keySpecs: [
      { label: "주행거리", value: "최대 483km" },
      { label: "출력", value: "226hp" },
      { label: "충전", value: "800V 급속" },
    ],
  },
  {
    id: "3",
    slug: "gv80",
    name: "GV80",
    brand: "제네시스",
    category: "SUV",
    engineType: "가솔린",
    basePrice: 72_000_000,
    monthlyFrom: 1_150_000,
    thumbnailUrl: "",
    isPopular: false,
    isFeatured: false,
    tags: ["프리미엄", "법인 인기"],
    shortDesc: "제네시스 플래그십 SUV. 럭셔리와 퍼포먼스의 정점.",
    brandColor: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
    keySpecs: [
      { label: "배기량", value: "2.5T / 3.5T" },
      { label: "최고출력", value: "304hp" },
      { label: "AWD", value: "기본 탑재" },
    ],
  },
  {
    id: "4",
    slug: "tucson",
    name: "더 뉴 투싼",
    brand: "현대",
    category: "SUV",
    engineType: "하이브리드",
    basePrice: 35_000_000,
    monthlyFrom: 540_000,
    thumbnailUrl: "",
    isPopular: true,
    isFeatured: false,
    tags: ["가성비", "하이브리드"],
    shortDesc: "실용성과 연비를 모두 잡은 베스트셀러 SUV.",
    brandColor: "linear-gradient(145deg, #000666 0%, #1A3A6E 100%)",
    keySpecs: [
      { label: "연비", value: "16.2km/L" },
      { label: "적재공간", value: "620L" },
      { label: "복합연비", value: "1·2등급" },
    ],
  },
  {
    id: "5",
    slug: "carnival",
    name: "카니발",
    brand: "기아",
    category: "밴",
    engineType: "가솔린",
    basePrice: 42_000_000,
    monthlyFrom: 680_000,
    thumbnailUrl: "",
    isPopular: false,
    isFeatured: false,
    tags: ["9인승", "비용처리 가능"],
    shortDesc: "국내 No.1 미니밴. 탁월한 공간과 다목적 활용성.",
    brandColor: "linear-gradient(145deg, #111111 0%, #1F2E1F 100%)",
    keySpecs: [
      { label: "탑승인원", value: "7·8·9인승" },
      { label: "적재공간", value: "최대 4,057L" },
      { label: "연비", value: "9.8km/L" },
    ],
  },
  {
    id: "6",
    slug: "g80",
    name: "더 뉴 G80",
    brand: "제네시스",
    category: "세단",
    engineType: "가솔린",
    basePrice: 65_000_000,
    monthlyFrom: 980_000,
    thumbnailUrl: "",
    isPopular: false,
    isFeatured: false,
    tags: ["프리미엄", "법인 인기"],
    shortDesc: "제네시스 대표 세단. 우아한 디자인과 탁월한 승차감.",
    brandColor: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
    keySpecs: [
      { label: "배기량", value: "2.5T / 3.5T" },
      { label: "최고출력", value: "304hp" },
      { label: "구동", value: "RWD / AWD" },
    ],
  },
  {
    id: "7",
    slug: "palisade",
    name: "더 뉴 팰리세이드",
    brand: "현대",
    category: "SUV",
    engineType: "디젤",
    basePrice: 48_000_000,
    monthlyFrom: 820_000,
    thumbnailUrl: "",
    isPopular: false,
    isFeatured: false,
    tags: ["대형 SUV", "7·8인승"],
    shortDesc: "현대 플래그십 대형 SUV. 패밀리카의 새 기준.",
    brandColor: "linear-gradient(145deg, #000666 0%, #0A2A5E 100%)",
    keySpecs: [
      { label: "탑승인원", value: "7·8인승" },
      { label: "연비", value: "12.8km/L" },
      { label: "배기량", value: "2.2 디젤" },
    ],
  },
  {
    id: "8",
    slug: "k8",
    name: "더 뉴 K8",
    brand: "기아",
    category: "세단",
    engineType: "하이브리드",
    basePrice: 40_000_000,
    monthlyFrom: 720_000,
    thumbnailUrl: "",
    isPopular: false,
    isFeatured: false,
    tags: ["하이브리드", "준대형"],
    shortDesc: "기아 준대형 세단. 세련된 디자인과 우수한 연비.",
    brandColor: "linear-gradient(145deg, #111111 0%, #1A2A3A 100%)",
    keySpecs: [
      { label: "연비", value: "17.4km/L" },
      { label: "배기량", value: "1.6T 하이브리드" },
      { label: "출력", value: "230ps" },
    ],
  },
];

export const VEHICLE_CATEGORIES = ["전체", "세단", "SUV", "밴", "트럭"] as const;
export const VEHICLE_BRANDS = ["전체", "현대", "기아", "제네시스", "수입"] as const;
export type VehicleCategoryFilter = (typeof VEHICLE_CATEGORIES)[number];
export type VehicleBrandFilter = (typeof VEHICLE_BRANDS)[number];
