/**
 * 아임딜러 통합 목 데이터
 * - 실제 서비스가 2026년 1월부터 운영 중이라고 가정
 * - 대시보드, 데이터 분석, 견적 데이터 페이지가 공통으로 사용
 * - 2026년 4월 15일(수) 기준 스냅샷
 */

// ── 타입 ──────────────────────────────────────────────────────
export type QuoteStatus = "상담대기" | "상담중" | "계약완료" | "계약취소";

export interface SharedQuote {
  id: string;
  vehicleName: string;
  vehicleShort: string;       // 대시보드용 짧은 이름
  customerName: string;
  phone: string;
  monthlyPayment: number;
  financeCompany: string;
  status: QuoteStatus;
  createdAt: string;
  options: string[];
  lineup: string;             // 라인업 추가
  trim: string;               // 트림 추가
  color: string;
  promotion: string;
  memo: string;
}

// 견적 데이터 페이지에서 사용하는 타입 alias
export type Quotation = SharedQuote;

// ── ① 이번 달 견적 목록 (6건) ─────────────────────────────────
// 상담대기 2 / 상담중 2 / 계약완료 1 / 계약취소 1
export const MOCK_QUOTES: SharedQuote[] = [
  {
    id: "Q-2604-001",
    vehicleName: "아이오닉 6",
    vehicleShort: "아이오닉 6",
    customerName: "김민준",
    phone: "010-2847-5931",
    monthlyPayment: 698000,
    financeCompany: "KB캐피탈",
    status: "상담중",
    createdAt: "2026-04-14",
    lineup: "2024년형 전기 롱레인지",
    trim: "프레스티지 (AWD)",
    options: ["빌트인 캠", "파노라마 선루프"],
    color: "어비스 블랙 펄",
    promotion: "EV 봄 특별 프로모션",
    memo: "선납 20% 조건으로 협의 진행 중.",
  },
  {
    id: "Q-2604-002",
    vehicleName: "더 뉴 쏘렌토",
    vehicleShort: "더 뉴 쏘렌토",
    customerName: "이서연",
    phone: "010-5512-3874",
    monthlyPayment: 743000,
    financeCompany: "현대캐피탈",
    status: "계약완료",
    createdAt: "2026-04-11",
    lineup: "2025년형 가솔린 2.5 터보",
    trim: "시그니처 (5인승)",
    options: ["드라이브 와이즈", "7인승 시트"],
    color: "스노우 화이트 펄",
    promotion: "봄맞이 페스타",
    memo: "최종 계약 완료. 4/18(토) 출고 예정.",
  },
  {
    id: "Q-2604-003",
    vehicleName: "더 뉴 EV6",
    vehicleShort: "더 뉴 EV6",
    customerName: "박도현",
    phone: "010-9183-6745",
    monthlyPayment: 682000,
    financeCompany: "신한카드",
    status: "상담대기",
    createdAt: "2026-04-14",
    lineup: "2026년형 전기 롱레인지",
    trim: "어스 (2WD)",
    options: ["컨비니언스 패키지", "메리디안 사운드"],
    color: "문스케이프 매트",
    promotion: "기본할인",
    memo: "",
  },
  {
    id: "Q-2604-004",
    vehicleName: "GV80",
    vehicleShort: "GV80",
    customerName: "최지우",
    phone: "010-7264-0183",
    monthlyPayment: 1120000,
    financeCompany: "하나캐피탈",
    status: "상담대기",
    createdAt: "2026-04-13",
    lineup: "2025년형 가솔린 3.5 터보",
    trim: "기본 모델 (5인승)",
    options: ["파퓰러 패키지", "렉시콘 사운드"],
    color: "우유니 화이트",
    promotion: "법인 VIP 특별할인",
    memo: "",
  },
  {
    id: "Q-2604-005",
    vehicleName: "더 뉴 투싼",
    vehicleShort: "더 뉴 투싼",
    customerName: "정수빈",
    phone: "010-3345-8820",
    monthlyPayment: 534000,
    financeCompany: "우리카드",
    status: "계약취소",
    createdAt: "2026-04-09",
    lineup: "2024년형 가솔린 1.6 터보",
    trim: "인스퍼레이션",
    options: ["파노라마 선루프"],
    color: "아마존 그레이",
    promotion: "기본할인",
    memo: "타사에서 더 좋은 조건 확인 후 취소.",
  },
  {
    id: "Q-2604-006",
    vehicleName: "더 뉴 K8",
    vehicleShort: "더 뉴 K8",
    customerName: "강성태",
    phone: "010-6678-2491",
    monthlyPayment: 615000,
    financeCompany: "JB우리캐피탈",
    status: "상담중",
    createdAt: "2026-04-12",
    lineup: "2025년형 가솔린 1.6 터보 HEV",
    trim: "노블레스 라이트",
    options: ["드라이브 와이즈", "어드밴스드 패키지"],
    color: "스틸 그레이 메탈릭",
    promotion: "재고할인 특별전",
    memo: "금리 추가 인하 가능 여부 확인 중.",
  },
];

// ── ② 주간 견적 조회 추이 (최근 7일 · 4/9 목 ~ 4/15 수) ─────
// 오늘(4/15 수) 23회 → 대시보드 KPI "오늘 견적 조회 23회"와 일치
export const WEEKLY_QUOTE_DATA = [
  { day: "목", value: 18 },
  { day: "금", value: 25 },
  { day: "토", value: 14 },
  { day: "일", value: 19 },
  { day: "월", value: 31 },
  { day: "화", value: 28 },
  { day: "수", value: 23 },
];

// ── ③ 주간 AI 추천 세션 (최근 7일) ─────────────────────────
// 오늘(수) 12회 → 대시보드 KPI "AI 추천 세션 12회"와 일치
export const WEEKLY_AI_DATA = [
  { day: "목", value: 9 },
  { day: "금", value: 13 },
  { day: "토", value: 7 },
  { day: "일", value: 10 },
  { day: "월", value: 16 },
  { day: "화", value: 15 },
  { day: "수", value: 12 },
];

// ── ④ 월별 상담 건수 (서비스 시작 1월~4월) ───────────────────
// 4월 6건 → MOCK_QUOTES 총 6건과 일치
export const MONTHLY_CONSULTATION_DATA = [
  { label: "1월", value: 4 },
  { label: "2월", value: 3 },
  { label: "3월", value: 5 },
  { label: "4월", value: 6 },
];

// ── ⑤ 차량 카테고리 분포 (등록 차량 6대 기준) ────────────────
// 아이오닉6(EV), EV6(EV), 쏘렌토HEV(SUV·HEV), 투싼HEV(SUV·HEV),
// GV80(SUV·가솔린), K8HEV(세단·HEV)
export const CATEGORY_DIST = [
  { label: "EV", count: 2, color: "#000666" },
  { label: "하이브리드", count: 3, color: "#7C3AED" },
  { label: "가솔린", count: 1, color: "#D97706" },
];

// ── ⑥ 차량별 누적 견적 순위 (Analytics 리더보드, 1~4월 누적) ──
// 합계 6,005건 → Analytics KPI "총 견적 발생량 6,005건"과 일치
export const VEHICLE_QUOTE_RANK = [
  { name: "아이오닉 6", brand: "현대", count: 1847, color: "#000666" },
  { name: "더 뉴 쏘렌토", brand: "기아", count: 1523, color: "#2A2A72" },
  { name: "더 뉴 EV6", brand: "기아", count: 1189, color: "#4B4B99" },
  { name: "더 뉴 투싼", brand: "현대", count: 834, color: "#6C6CBF" },
  { name: "GV80", brand: "제네시스", count: 612, color: "#8E8EE6" },
];

// ── ⑦ 파워트레인 선호도 (Analytics, 누적 견적 기준) ───────────
// 하이브리드(쏘렌토+투싼+K8) 50%, EV(아이오닉6+EV6) 33%, 가솔린(GV80) 17%
export const POWERTRAIN_DATA = [
  { label: "하이브리드", value: 50, color: "#000666" },
  { label: "전기 (EV)", value: 33, color: "#6066EE" },
  { label: "가솔린 & 디젤", value: 17, color: "#B0B5D0" },
];

// ── ⑧ 일간 견적 트렌드 (Analytics, 최근 30일) ──────────────────
// 30일 합계 = 611건 → Analytics KPI "총 견적 발생량 611건 / 방문자 2,443명"과 일치
export const TREND_DATA_30D = [
  12, 15, 11, 18, 14, 9, 16, 19, 22, 17,
  25, 21, 18, 14, 23, 27, 24, 19, 28, 23,
  18, 25, 31, 28, 23, 19, 26, 18, 25, 23,
];

// ── ⑨ 대시보드 KPI 수치 ────────────────────────────────────────
export const DASHBOARD_STATS = {
  totalVehicles: 6,          // 등록 차량 총 6대
  visibleVehicles: 5,        // 노출 중 5대 (투싼 비노출)
  todayQuoteViews: 23,       // 오늘 견적 조회 (WEEKLY_QUOTE_DATA 마지막 값)
  todayAISessions: 12,       // 오늘 AI 추천 세션 (WEEKLY_AI_DATA 마지막 값)
  monthlyConsultations: 6,   // 이달 신규 상담 (MOCK_QUOTES 총 6건)
  conversionRate: 17,        // 계약 전환율 1/6 ≈ 17%
};

// ── ⑩ 대시보드 인기 차량 Top 4 (VEHICLE_QUOTE_RANK 기반) ───────
export const TOP_VEHICLES_DASHBOARD = [
  { rank: 1, name: "아이오닉 6", views: 1847, bar: 100, barColor: "#000666" },
  { rank: 2, name: "더 뉴 쏘렌토", views: 1523, bar: 82, barColor: "#7C3AED" },
  { rank: 3, name: "더 뉴 EV6", views: 1189, bar: 64, barColor: "#D97706" },
  { rank: 4, name: "더 뉴 투싼", views: 834, bar: 45, barColor: "#9BA4C0" },
  { rank: 5, name: "GV80", views: 612, bar: 33, barColor: "#C0C5DC" },
];

// ── ⑪ 대시보드 최근 상담 4건 (MOCK_QUOTES 최신 4건 기반) ────────
export const RECENT_CONSULTATIONS_DASHBOARD = [
  { id: "Q-2604-001", name: "김민준",  vehicle: "아이오닉 6",     time: "방금 전",  status: "상담중",   sc: "#000666", sb: "#E5E5FA" },
  { id: "Q-2604-003", name: "박도현",  vehicle: "더 뉴 EV6",            time: "3시간 전", status: "상담대기", sc: "#9BA4C0", sb: "#F4F5F8" },
  { id: "Q-2604-002", name: "이서연",  vehicle: "더 뉴 쏘렌토",     time: "3일 전",  status: "계약완료", sc: "#059669", sb: "#ECFDF5" },
  { id: "Q-2604-006", name: "강성태",  vehicle: "더 뉴 K8",   time: "3일 전",  status: "상담중",   sc: "#000666", sb: "#E5E5FA" },
  { id: "Q-2604-004", name: "최지우",  vehicle: "GV80",      time: "4일 전",  status: "상담대기", sc: "#9BA4C0", sb: "#F4F5F8" },
  { id: "Q-2604-005", name: "정수빈",  vehicle: "더 뉴 투싼", time: "1주 전", status: "계약취소", sc: "#DC2626", sb: "#FEF2F2" },
  { id: "Q-2604-007", name: "한지수",  vehicle: "아이오닉 6", time: "2주 전", status: "계약완료", sc: "#059669", sb: "#ECFDF5" },
];

// ── ⑫ 대시보드 최근 관리자 활동 ───────────────────────────────
export const RECENT_ADMIN_ACTIVITY = [
  { id: 1, text: "투싼 하이브리드 비노출 처리",         time: "2일 전",  isAlert: true },
  { id: 2, text: "쏘렌토 HEV 봄맞이 프로모션 등록",     time: "4일 전",  isAlert: false },
  { id: 3, text: "아이오닉 6 기준가 업데이트",           time: "6일 전",  isAlert: false },
  { id: 4, text: "K8 하이브리드 신규 차량 등록 완료",    time: "1주 전",  isAlert: false },
];

// ── ⑬ 재고관리 ─────────────────────────────────────────────────

import { type InventoryStatus, type InventoryItem } from "../types/inventory";

export { type InventoryStatus, type InventoryItem };

/** 금융사 목록 */
export const FINANCE_COMPANIES = [
  "KB캐피탈",
  "현대캐피탈",
  "신한카드",
  "하나캐피탈",
  "JB우리캐피탈",
  "롯데캐피탈",
  "우리카드",
];

// ── 금융사 관리 상세 데이터 ──────────────────────────────────────

export type FinanceStatus = "활성" | "비활성" | "점검중";

export interface FinancePIC {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface FinancePolicy {
  agencyFeeRate: number;       // 딜러 수수료율 (%)
  preferredTerm: number;       // 선호 계약 기간 (개월)
  preferredDeposit: number;    // 선호 선납금 비율 (%)
  maxApprovalAmount: number;   // 최대 승인 가능 금액 (만원)
  specialVehicles: string[];   // 특판 차종
  rentAvailable: boolean;      // 장기렌트 취급 가능
  leaseAvailable: boolean;     // 리스 취급 가능
}

export interface FinanceCompanyRecord {
  id: string;
  name: string;
  shortName: string;
  status: FinanceStatus;
  color: string;               // 브랜드 컬러 (Hex)
  approvalRate: number;        // 심사 승인율 (%)
  quoteShare: number;          // 견적 점유율 (%)
  totalContracts: number;      // 누적 계약 건수
  recentContracts: number;     // 최근 30일 계약 건수
  pic: FinancePIC;
  policy: FinancePolicy;
  memo: string;
  registeredAt: string;
}

export const MOCK_FINANCES: FinanceCompanyRecord[] = [
  {
    id: "FC-001",
    name: "KB캐피탈",
    shortName: "KB",
    status: "활성",
    color: "#FFB900",
    approvalRate: 88,
    quoteShare: 31,
    totalContracts: 142,
    recentContracts: 18,
    pic: { name: "박준혁", role: "심사역", phone: "02-1234-5001", email: "junhyuk.park@kb-capital.co.kr" },
    policy: {
      agencyFeeRate: 2.5,
      preferredTerm: 48,
      preferredDeposit: 30,
      maxApprovalAmount: 8000,
      specialVehicles: ["아이오닉 6", "K8 HEV"],
      rentAvailable: true,
      leaseAvailable: true,
    },
    memo: "2분기 EV차량 금리 우대 혜택 적용 중. 선납 30% 이상 시 금리 0.3%p 추가 인하.",
    registeredAt: "2026-01-03",
  },
  {
    id: "FC-002",
    name: "현대캐피탈",
    shortName: "HCA",
    status: "활성",
    color: "#002C5F",
    approvalRate: 84,
    quoteShare: 26,
    totalContracts: 118,
    recentContracts: 14,
    pic: { name: "이지은", role: "영업담당", phone: "02-1234-5002", email: "jieun.lee@hyundaicapital.com" },
    policy: {
      agencyFeeRate: 2.2,
      preferredTerm: 60,
      preferredDeposit: 20,
      maxApprovalAmount: 10000,
      specialVehicles: ["GV80", "투싼 HEV"],
      rentAvailable: true,
      leaseAvailable: true,
    },
    memo: "현대/기아 차량에 대한 브랜드 연계 상품 우선 제안 권장.",
    registeredAt: "2026-01-03",
  },
  {
    id: "FC-003",
    name: "신한카드",
    shortName: "Shinhan",
    status: "활성",
    color: "#0046A0",
    approvalRate: 79,
    quoteShare: 17,
    totalContracts: 73,
    recentContracts: 9,
    pic: { name: "최동현", role: "심사역", phone: "02-1234-5003", email: "donghyun.choi@shinhancard.com" },
    policy: {
      agencyFeeRate: 2.8,
      preferredTerm: 48,
      preferredDeposit: 30,
      maxApprovalAmount: 7000,
      specialVehicles: ["기아 EV6"],
      rentAvailable: true,
      leaseAvailable: false,
    },
    memo: "리스 상품 미취급. 장기렌트 전문. 초기 비용 최소화 고객에게 추천.",
    registeredAt: "2026-01-10",
  },
  {
    id: "FC-004",
    name: "하나캐피탈",
    shortName: "Hana",
    status: "활성",
    color: "#009B6B",
    approvalRate: 81,
    quoteShare: 12,
    totalContracts: 54,
    recentContracts: 7,
    pic: { name: "정수민", role: "영업담당", phone: "02-1234-5004", email: "sumin.jung@hanacapital.co.kr" },
    policy: {
      agencyFeeRate: 3.0,
      preferredTerm: 36,
      preferredDeposit: 20,
      maxApprovalAmount: 6000,
      specialVehicles: ["쏘렌토 HEV"],
      rentAvailable: false,
      leaseAvailable: true,
    },
    memo: "리스 전문 금융사. 법인 고객 비율 높음. 단기 계약 고객에게 유리.",
    registeredAt: "2026-02-01",
  },
  {
    id: "FC-005",
    name: "JB우리캐피탈",
    shortName: "JB",
    status: "점검중",
    color: "#5B3EE0",
    approvalRate: 72,
    quoteShare: 8,
    totalContracts: 31,
    recentContracts: 0,
    pic: { name: "임재원", role: "심사역", phone: "02-1234-5005", email: "jaewon.lim@jbwoori.co.kr" },
    policy: {
      agencyFeeRate: 3.2,
      preferredTerm: 48,
      preferredDeposit: 30,
      maxApprovalAmount: 5000,
      specialVehicles: [],
      rentAvailable: true,
      leaseAvailable: true,
    },
    memo: "4/18(토) 00:00~06:00 시스템 점검 예정. 해당 기간 접수 불가.",
    registeredAt: "2026-02-15",
  },
  {
    id: "FC-006",
    name: "롯데캐피탈",
    shortName: "Lotte",
    status: "비활성",
    color: "#E60012",
    approvalRate: 68,
    quoteShare: 4,
    totalContracts: 16,
    recentContracts: 0,
    pic: { name: "강민서", role: "영업담당", phone: "02-1234-5006", email: "minseo.kang@lottecapital.com" },
    policy: {
      agencyFeeRate: 2.0,
      preferredTerm: 48,
      preferredDeposit: 40,
      maxApprovalAmount: 5500,
      specialVehicles: [],
      rentAvailable: true,
      leaseAvailable: false,
    },
    memo: "현재 신규 계약 중단 상태. 수수료 재협상 완료 후 재개 예정.",
    registeredAt: "2026-03-01",
  },
  {
    id: "FC-007",
    name: "우리카드",
    shortName: "Woori",
    status: "활성",
    color: "#0070C0",
    approvalRate: 76,
    quoteShare: 2,
    totalContracts: 8,
    recentContracts: 2,
    pic: { name: "한지수", role: "심사역", phone: "02-1234-5007", email: "jisu.han@wooricard.com" },
    policy: {
      agencyFeeRate: 2.7,
      preferredTerm: 48,
      preferredDeposit: 25,
      maxApprovalAmount: 6500,
      specialVehicles: [],
      rentAvailable: true,
      leaseAvailable: false,
    },
    memo: "신규 파트너십 체결 (2026-03). 아직 실적 구축 단계. 적극 활용 권장.",
    registeredAt: "2026-03-10",
  },
];

/** 브랜드 목록 */
export const VEHICLE_BRANDS = ["현대", "기아", "제네시스"];

import { MOCK_INVENTORY } from "./mock-inventory";
export { MOCK_INVENTORY };

// ── ⑭ 사용자 관리 ──────────────────────────────────────────────

/** 사용자 계정 상태 */
export type UserStatus = "정상" | "휴면" | "탈퇴";

/** 사용자가 현재 연관된 상담/계약 항목 요약 */
export interface UserActiveItem {
  quoteId: string;
  vehicleName: string;
  status: QuoteStatus;
}

/** 사용자 데이터 */
export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;           // 가입일
  lastLoginAt: string;        // 마지막 로그인
  status: UserStatus;
  quoteViewCount: number;     // 누적 견적 조회 수
  consultationCount: number;  // 상담 신청 횟수
  pdfDownloadCount: number;   // PDF 다운로드 횟수
  activeItems: UserActiveItem[]; // 현재 진행 중인 상담/계약
  memo: string;
}

export const MOCK_USERS: UserRecord[] = [
  {
    id: "USR-001",
    name: "김민준",
    phone: "010-2847-5931",
    email: "minjun.kim@gmail.com",
    joinedAt: "2026-03-10",
    lastLoginAt: "2026-04-14",
    status: "정상",
    quoteViewCount: 14,
    consultationCount: 2,
    pdfDownloadCount: 3,
    activeItems: [
      { quoteId: "Q-2604-001", vehicleName: "아이오닉 6", status: "상담중" },
    ],
    memo: "선납 20% 조건 선호. VIP 고객 후보.",
  },
  {
    id: "USR-002",
    name: "이서연",
    phone: "010-5512-3874",
    email: "seoyeon.lee@naver.com",
    joinedAt: "2026-02-20",
    lastLoginAt: "2026-04-11",
    status: "정상",
    quoteViewCount: 22,
    consultationCount: 3,
    pdfDownloadCount: 5,
    activeItems: [
      { quoteId: "Q-2604-002", vehicleName: "더 뉴 쏘렌토", status: "계약완료" },
    ],
    memo: "4/18 출고 예정. 4/17 최종 확인 연락 필요.",
  },
  {
    id: "USR-003",
    name: "박도현",
    phone: "010-9183-6745",
    email: "",
    joinedAt: "2026-04-14",
    lastLoginAt: "2026-04-14",
    status: "정상",
    quoteViewCount: 3,
    consultationCount: 1,
    pdfDownloadCount: 1,
    activeItems: [
      { quoteId: "Q-2604-003", vehicleName: "더 뉴 EV6", status: "상담대기" },
    ],
    memo: "",
  },
  {
    id: "USR-004",
    name: "최지우",
    phone: "010-7264-0183",
    email: "jiwoo.choi@kakao.com",
    joinedAt: "2026-01-05",
    lastLoginAt: "2026-04-13",
    status: "정상",
    quoteViewCount: 41,
    consultationCount: 5,
    pdfDownloadCount: 8,
    activeItems: [
      { quoteId: "Q-2604-004", vehicleName: "GV80", status: "상담대기" },
    ],
    memo: "법인 VIP. 고가 차종 선호. 담당자 직접 응대 요청.",
  },
  {
    id: "USR-005",
    name: "정수빈",
    phone: "010-3345-8820",
    email: "subin.jung@gmail.com",
    joinedAt: "2026-02-01",
    lastLoginAt: "2026-04-09",
    status: "정상",
    quoteViewCount: 9,
    consultationCount: 2,
    pdfDownloadCount: 2,
    activeItems: [
      { quoteId: "Q-2604-005", vehicleName: "더 뉴 투싼", status: "계약취소" },
    ],
    memo: "타사 계약 전환. 재접촉 가능성 있음.",
  },
  {
    id: "USR-006",
    name: "강성태",
    phone: "010-6678-2491",
    email: "sungtae.kang@naver.com",
    joinedAt: "2026-03-22",
    lastLoginAt: "2026-04-12",
    status: "정상",
    quoteViewCount: 17,
    consultationCount: 2,
    pdfDownloadCount: 4,
    activeItems: [
      { quoteId: "Q-2604-006", vehicleName: "더 뉴 K8", status: "상담중" },
    ],
    memo: "금리 추가 인하 여부 확인 중.",
  },
  {
    id: "USR-007",
    name: "윤하은",
    phone: "010-4421-9905",
    email: "haeun.yoon@gmail.com",
    joinedAt: "2026-01-18",
    lastLoginAt: "2026-03-30",
    status: "휴면",
    quoteViewCount: 6,
    consultationCount: 1,
    pdfDownloadCount: 1,
    activeItems: [],
    memo: "30일 이상 미접속. 재활성화 알림 대상.",
  },
  {
    id: "USR-008",
    name: "조현우",
    phone: "010-8812-3344",
    email: "hyunwoo.jo@kakao.com",
    joinedAt: "2026-02-14",
    lastLoginAt: "2026-02-28",
    status: "휴면",
    quoteViewCount: 4,
    consultationCount: 0,
    pdfDownloadCount: 0,
    activeItems: [],
    memo: "",
  },
];

/** 사용자 관리 요약 통계 */
export const USER_STATS = {
  total: 8,
  active: 6,
  dormant: 2,
  withdrawn: 0,
  newThisMonth: 2,
};

// ── ⑮ 운영 메모 ──────────────────────────────────────────────

/** 메모 카테고리 */
export type MemoCategory = "이슈/긴급" | "공지사항" | "일반" | "업무/인수인계";

/** 운영 메모 데이터 */
export interface AdminMemo {
  id: string;
  title: string;
  content: string;
  category: MemoCategory;
  isPinned: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export const MOCK_MEMOS: AdminMemo[] = [
  {
    id: "MEMO-001",
    title: "신규 더 뉴 K8 프로모션 정책 적용 안내",
    content: "영업팀 요청에 따라 더 뉴 K8 모델에 대한 2분기 추가 프로모션 할인이 적용되었습니다.\n기존 대비 월 납입금 변동이 있으니 고객 상담 시 반드시 최신 견적서를 다시 발송해주시기 바랍니다.\n\n적용일: 2026-04-12 부터\n변동 특이사항: 선납금 30% 이상 시 금리 추가 인하 적용.",
    category: "공지사항",
    isPinned: true,
    author: "최관리자",
    createdAt: "2026-04-12T09:00:00",
    updatedAt: "2026-04-12T09:00:00",
  },
  {
    id: "MEMO-002",
    title: "JB우리캐피탈 시스템 점검 예정",
    content: "이번 주 주말 시스템 점검으로 인해 JB우리캐피탈 신용조회 및 견적 산출이 지연될 수 있습니다.\n해당 시간대에 접수되는 견적은 월요일 일괄 처리됨을 고객에게 안내 부탁드립니다.\n\n- 점검 일시: 4/18(토) 00:00 ~ 06:00",
    category: "이슈/긴급",
    isPinned: true,
    author: "시스템운영팀",
    createdAt: "2026-04-14T14:30:00",
    updatedAt: "2026-04-15T08:15:00",
  },
  {
    id: "MEMO-003",
    title: "상담 우수사례 공유 - 더 뉴 GV80",
    content: "4월 2주차 더 뉴 GV80 법인 고객 계약 전환율이 전주 대비 20% 상승했습니다.\n주요 전환 요인은 초기 비용 최소화 플랜 제안과 빠른 출고 일정 확보였습니다.\n\n재고 중 하나캐피탈 배정분 먼저 소진하는 방향으로 유도 바랍니다.",
    category: "업무/인수인계",
    isPinned: false,
    author: "박팀장",
    createdAt: "2026-04-13T10:11:00",
    updatedAt: "2026-04-13T10:11:00",
  },
  {
    id: "MEMO-004",
    title: "더 뉴 투싼 재고 입고 지연 안내",
    content: "반도체 수급 문제로 더 뉴 투싼 트림의 4월 3주차 입고가 지연되고 있습니다.\n- 예상 지연 기간: 1주일~2주일\n\n대기 고객님들께 지연 문자를 발송할 예정이며 개별 연락이 필요한 VIP 고객의 경우 매니저가 직접 전화 부탁드립니다.",
    category: "일반",
    isPinned: false,
    author: "최관리자",
    createdAt: "2026-04-10T16:45:00",
    updatedAt: "2026-04-10T16:45:00",
  },
  {
    id: "MEMO-005",
    title: "(인수인계) 김민준 고객님 관리의 건",
    content: "아이오닉 6 상담 중이신 김민준 고객님(USR-001) 관련 인수인계 내용입니다.\n선납금 20% 조건을 강력히 선호하시어 조건을 맞추는 중이며, 기존 차량 탁송 시점에 대해 예민하십니다.\n\n이번 주 목요일까지 추가 제안서 전달하기로 약속되었습니다. 잊지 말고 챙겨주세요.",
    category: "업무/인수인계",
    isPinned: false,
    author: "이대리",
    createdAt: "2026-04-14T18:20:00",
    updatedAt: "2026-04-14T18:25:00",
  },
];

// ── ⑯ 회수율(잔존가치율) 설정 ──────────────────────────────────

/** 차량 카테고리 */
export type VehicleCategory = "국산 EV" | "국산 HEV" | "국산 가솔린" | "수입 EV" | "수입 HEV" | "수입 가솔린/디젤";

/** 연식 구간 */
export type VintageRange = "1년 이하" | "1~2년" | "2~3년" | "3~4년" | "4~5년" | "5년 초과";

/** 주행거리 구간 */
export type MileageRange = "1만km 미만" | "1~3만km" | "3~5만km" | "5~7만km" | "7~10만km" | "10만km 초과";

/**
 * 차종별 기본 회수율 설정
 * - baseRate: 신차 대비 잔존가치율 (%)
 * - vintageAdjust: 연식별 추가 감가율 (%)
 * - mileageAdjust: 주행거리별 추가 감가율 (%)
 */
export interface RecoveryRateItem {
  id: string;
  category: VehicleCategory;
  vehicleName: string;          // 대표 차종명
  brand: string;
  baseRate: number;             // 기본 잔존가치율 (%)
  vintageRates: Record<VintageRange, number>;   // 연식별 잔존가치율 (%)
  mileageAdjust: Record<MileageRange, number>;  // 주행거리별 추가 감가율 (%)
  updatedAt: string;
  updatedBy: string;
  memo: string;
}

/** 회수율 변경 이력 */
export interface RecoveryRateHistory {
  id: string;
  vehicleName: string;
  field: string;          // 변경된 항목
  oldValue: number;
  newValue: number;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export const MOCK_RECOVERY_RATES: RecoveryRateItem[] = [
  {
    id: "RR-001",
    category: "국산 EV",
    vehicleName: "현대 아이오닉 6",
    brand: "현대",
    baseRate: 72,
    vintageRates: {
      "1년 이하":  72,
      "1~2년":     65,
      "2~3년":     58,
      "3~4년":     51,
      "4~5년":     45,
      "5년 초과":  38,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -5,
      "10만km 초과":  -8,
    },
    updatedAt: "2026-04-10",
    updatedBy: "최관리자",
    memo: "EV 배터리 열화 반영, 시장 거래가 기준 재산정.",
  },
  {
    id: "RR-002",
    category: "국산 EV",
    vehicleName: "더 뉴 EV6",
    brand: "기아",
    baseRate: 70,
    vintageRates: {
      "1년 이하":  70,
      "1~2년":     63,
      "2~3년":     56,
      "3~4년":     49,
      "4~5년":     43,
      "5년 초과":  36,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -5,
      "10만km 초과":  -8,
    },
    updatedAt: "2026-04-10",
    updatedBy: "최관리자",
    memo: "",
  },
  {
    id: "RR-003",
    category: "국산 HEV",
    vehicleName: "더 뉴 쏘렌토",
    brand: "기아",
    baseRate: 78,
    vintageRates: {
      "1년 이하":  78,
      "1~2년":     72,
      "2~3년":     66,
      "3~4년":     60,
      "4~5년":     54,
      "5년 초과":  47,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -4,
      "10만km 초과":  -7,
    },
    updatedAt: "2026-04-08",
    updatedBy: "박팀장",
    memo: "SUV 수요 강세로 HEV 잔존가치 상향 조정.",
  },
  {
    id: "RR-004",
    category: "국산 HEV",
    vehicleName: "더 뉴 투싼",
    brand: "현대",
    baseRate: 76,
    vintageRates: {
      "1년 이하":  76,
      "1~2년":     70,
      "2~3년":     63,
      "3~4년":     57,
      "4~5년":     51,
      "5년 초과":  44,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -5,
      "10만km 초과":  -7,
    },
    updatedAt: "2026-04-08",
    updatedBy: "박팀장",
    memo: "",
  },
  {
    id: "RR-005",
    category: "국산 HEV",
    vehicleName: "더 뉴 K8",
    brand: "기아",
    baseRate: 75,
    vintageRates: {
      "1년 이하":  75,
      "1~2년":     68,
      "2~3년":     62,
      "3~4년":     56,
      "4~5년":     49,
      "5년 초과":  42,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -4,
      "10만km 초과":  -7,
    },
    updatedAt: "2026-04-05",
    updatedBy: "이대리",
    memo: "",
  },
  {
    id: "RR-006",
    category: "국산 가솔린",
    vehicleName: "더 뉴 GV80",
    brand: "제네시스",
    baseRate: 74,
    vintageRates: {
      "1년 이하":  74,
      "1~2년":     67,
      "2~3년":     60,
      "3~4년":     53,
      "4~5년":     47,
      "5년 초과":  40,
    },
    mileageAdjust: {
      "1만km 미만":    0,
      "1~3만km":      -1,
      "3~5만km":      -2,
      "5~7만km":      -3,
      "7~10만km":     -5,
      "10만km 초과":  -8,
    },
    updatedAt: "2026-03-28",
    updatedBy: "최관리자",
    memo: "프리미엄 브랜드 특성상 감가율 완만 적용.",
  },
];

export const MOCK_RECOVERY_HISTORY: RecoveryRateHistory[] = [
  {
    id: "RH-001",
    vehicleName: "아이오닉 6",
    field: "기본 잔존가치율",
    oldValue: 70,
    newValue: 72,
    changedBy: "최관리자",
    changedAt: "2026-04-10T11:30:00",
    reason: "2026년 2분기 시장 조사 반영",
  },
  {
    id: "RH-002",
    vehicleName: "더 뉴 쏘렌토",
    field: "기본 잔존가치율",
    oldValue: 75,
    newValue: 78,
    changedBy: "박팀장",
    changedAt: "2026-04-08T09:15:00",
    reason: "SUV 수요 강세 반영",
  },
  {
    id: "RH-003",
    vehicleName: "더 뉴 투싼",
    field: "1년 이하 잔존가치율",
    oldValue: 74,
    newValue: 76,
    changedBy: "박팀장",
    changedAt: "2026-04-08T09:20:00",
    reason: "쏘렌토 HEV 연동 조정",
  },
  {
    id: "RH-004",
    vehicleName: "더 뉴 EV6",
    field: "10만km 초과 감가율",
    oldValue: -7,
    newValue: -8,
    changedBy: "최관리자",
    changedAt: "2026-04-01T14:00:00",
    reason: "EV 고주행 중고차 시장 거래가 하락 반영",
  },
  {
    id: "RH-005",
    vehicleName: "더 뉴 GV80",
    field: "기본 잔존가치율",
    oldValue: 72,
    newValue: 74,
    changedBy: "최관리자",
    changedAt: "2026-03-28T16:45:00",
    reason: "프리미엄 브랜드 중고차 거래 활성화 반영",
  },
];

/** 회수율 설정 요약 KPI */
export const RECOVERY_RATE_STATS = {
  totalModels: 6,
  avgBaseRate: 74.2,
  lastUpdated: "2026-04-10",
  pendingReview: 2,   // 검토 필요 차종 수
};
