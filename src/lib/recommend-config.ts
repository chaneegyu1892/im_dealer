/**
 * AI 추천 플로우 설정 타입 + 기본값
 *
 * questions: 각 단계 질문 텍스트·선택지 오버라이드
 * scoring:   점수 규칙 파라미터 (기존 하드코딩 값들의 DB화)
 */

// ── 질문 설정 ──────────────────────────────────────────────

export interface QuestionOption {
  value: string;
  label: string;
  desc: string;
  icon: string;
}

export interface QuestionStep {
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

export interface QuestionsConfig {
  industry: QuestionStep;
  purpose: QuestionStep;
  purposeByIndustry: Record<string, QuestionStep>;
  budget: QuestionStep;
  paymentStyle: QuestionStep;
  mileage: QuestionStep;
  fuel: QuestionStep;
  industryDetail: Record<string, QuestionStep>;
  purposeDetail: Record<string, QuestionStep>;
  budgetDetail: Record<string, QuestionStep>;
}

// ── 점수 규칙 ──────────────────────────────────────────────

export interface BudgetScoring {
  withinBudgetBonus: number;    // 예산 범위 내
  underBudgetBonus: number;     // 예산보다 저렴
  overBudgetPenaltyPerManwon: number; // 예산 초과 만원당 감점
  maxPenalty: number;           // 최대 감점 상한
  flexibleMultiplier: number;   // "조금 타협 가능" 시 예산 상한 배율
  maxBudgetRatio: number;       // 이 배율 초과 차량 제외
}

export interface DetailScoringRule {
  industry?: string;
  purpose?: string;
  detail: string;
  condition: string;  // "always" | "suv" | "largeCat" | "heavyCat" | "premiumCat" | "nonSUV" | "highFuelEff" | "highPrice"
  conditionParam?: number; // e.g. fuelEffThreshold, minPrice
  score: number;
}

export interface FuelScoring {
  전기차: number;
  하이브리드: number;
  "가솔린/디젤": number;
  mismatchPenalty: number;
}

export interface OfficialScoring {
  premiumCategoryBonus: number;
  suvBonus: number;
  smallCategoryPenalty: number;
  minPrice: number;
}

export interface ScoringConfig {
  baseScore: number;
  popularBonus: number;
  budget: BudgetScoring;
  industryDetail: DetailScoringRule[];
  purposeDetail: DetailScoringRule[];
  fuel: FuelScoring;
  official: OfficialScoring;
  highFuelEffBonus: number;     // 연비 우수 차량 이유 추가 보너스
  highFuelEffThreshold: number; // 연비 기준
  familySuvBonus: number;       // 가족 목적 + SUV 이유 보너스
  cargoBonus: number;           // 화물 목적 + 밴/트럭 이유 보너스
  firstCarMaxPrice: number;     // 첫차 합리적 가격 기준
  firstCarPriceBonus: number;   // 첫차 가격 보너스
}

// ── 전체 플로우 설정 ──────────────────────────────────────

export interface RecommendFlowConfigData {
  questions: QuestionsConfig;
  scoring: ScoringConfig;
}

// ── 기본값 (현재 하드코딩 값 그대로) ──────────────────────

export const DEFAULT_QUESTIONS: QuestionsConfig = {
  industry: {
    title: "어떤 업종이신가요?",
    subtitle: "고객 유형에 맞는 최적 추천을 드려요.",
    options: [
      { value: "법인", label: "법인", desc: "법인 명의 차량 등록", icon: "🏢" },
      { value: "개인사업자", label: "개인사업자", desc: "사업자등록증 보유", icon: "📋" },
      { value: "개인", label: "개인", desc: "직장인·프리랜서·비사업자 모두 포함", icon: "👤" },
    ],
  },
  purpose: {
    title: "주요 사용 목적은요?",
    subtitle: "목적에 딱 맞는 차량을 골라드려요.",
    options: [
      { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·영업·외근 통합", icon: "🚗" },
      { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
      { value: "임원용·의전", label: "임원용·의전", desc: "임원·VIP 의전 차량", icon: "🎖️" },
      { value: "가정용", label: "가정용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
    ],
  },
  purposeByIndustry: {
    법인: {
      title: "주요 사용 목적은요?",
      subtitle: "법인 차량 목적에 맞게 추천해 드려요.",
      options: [
        { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·영업·외근 통합", icon: "🚗" },
        { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
        { value: "임원용·의전", label: "임원용·의전", desc: "임원·VIP 의전 차량", icon: "🎖️" },
      ],
    },
    개인사업자: {
      title: "주요 사용 목적은요?",
      subtitle: "사업 목적에 맞게 추천해 드려요.",
      options: [
        { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·영업·외근 통합", icon: "🚗" },
        { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
        { value: "가정용", label: "가정용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
      ],
    },
    개인: {
      title: "주요 사용 목적은요?",
      subtitle: "라이프스타일에 맞게 추천해 드려요.",
      options: [
        { value: "출퇴근·업무용", label: "출퇴근·업무용", desc: "출퇴근·영업·외근 통합", icon: "🚗" },
        { value: "화물·배달", label: "화물·배달", desc: "물건 운반·배달 업무", icon: "📦" },
        { value: "가정용", label: "가정용", desc: "가족 이동·장거리 여행", icon: "👨‍👩‍👧" },
      ],
    },
  },
  budget: {
    title: "월 예산은 어느 정도인가요?",
    subtitle: "예산에 딱 맞는 차량을 추려드려요.",
    options: [
      { value: "~50", label: "50만원 이하", desc: "합리적인 경제형", icon: "💚" },
      { value: "50~100", label: "50–100만원", desc: "중형·준중형 범위", icon: "💛" },
      { value: "100~", label: "100만원 이상", desc: "대형·프리미엄 가능", icon: "🔴" },
    ],
  },
  paymentStyle: {
    title: "초기 비용 부담 방식은요?",
    subtitle: "납입 방식에 따라 월 금액이 달라져요.",
    options: [
      { value: "표준형", label: "초기 비용 없이 가볍게", desc: "보증금·선납금 없이 시작", icon: "✨" },
      { value: "보수형", label: "초기 목돈으로 월 납입 절감", desc: "초기 비용을 넣어 매달 부담 줄이기", icon: "💰" },
    ],
  },
  mileage: {
    title: "연간 주행거리는요?",
    subtitle: "주행 패턴에 맞는 요금제를 선택해요.",
    options: [
      { value: "10000", label: "적게 타요 (연 1만km)", desc: "단거리 위주, 출퇴근만", icon: "🐢" },
      { value: "20000", label: "적당히 타요 (연 2만km)", desc: "80% 고객이 선택하는 평균 주행 패턴", icon: "🚗" },
      { value: "30000", label: "많이 타요 (연 3만km)", desc: "장거리·영업·고주행", icon: "🚀" },
    ],
  },
  fuel: {
    title: "선호하는 연료 방식이 있나요?",
    subtitle: "환경·유지비에 따라 달라져요.",
    options: [
      { value: "전기차", label: "전기차", desc: "충전 인프라 있음, 유지비 절감", icon: "⚡" },
      { value: "하이브리드", label: "하이브리드", desc: "연비와 주행거리 모두 잡아요", icon: "🌿" },
      { value: "가솔린/디젤", label: "내연기관", desc: "익숙한 가솔린·디젤이 편해요", icon: "⛽" },
      { value: "상관없음", label: "상관없음", desc: "연료 방식에 특별한 제한이 없어요", icon: "🔄" },
    ],
  },
  industryDetail: {
    법인: {
      title: "현재 법인 차량 운용 대수는요?",
      subtitle: "규모에 맞는 실용적인 차량을 추천해 드려요.",
      options: [
        { value: "없음", label: "없어요", desc: "처음 도입하는 법인 차량이에요", icon: "🆕" },
        { value: "1대", label: "1대", desc: "이미 1대를 운용 중이에요", icon: "🚗" },
        { value: "2대 이상", label: "2대 이상", desc: "다수 차량을 운용 중이에요", icon: "🏭" },
      ],
    },
    개인사업자: {
      title: "현재 사업자 명의 렌트/리스 차량은요?",
      subtitle: "2대 이상 운용 시 임직원 전용보험이 필수예요.",
      options: [
        { value: "없음", label: "없어요", desc: "사업자 명의 렌트/리스 차량이 없어요", icon: "🆕" },
        { value: "1대", label: "1대 운용 중", desc: "이미 1대를 운용 중이에요", icon: "🚗" },
        { value: "2대 이상", label: "2대 이상 운용 중", desc: "2대 이상 운용 중이에요 (임직원 전용보험 필수)", icon: "⚠️" },
      ],
    },
    개인: {
      title: "주로 몇 명이 함께 탑승하나요?",
      subtitle: "동승 인원에 따라 적합한 차급이 달라져요.",
      options: [
        { value: "혼자", label: "주로 혼자 타요", desc: "1인 사용이 대부분이에요", icon: "👤" },
        { value: "2~3명", label: "2~3명이 함께 타요", desc: "가끔 동승자가 있어요", icon: "👥" },
        { value: "4명 이상", label: "4명 이상 함께 타요", desc: "가족·단체 이동이 잦아요", icon: "👨‍👩‍👧‍👦" },
      ],
    },
  },
  purposeDetail: {
    "출퇴근·업무용": {
      title: "하루 편도 이동 거리는요?",
      subtitle: "거리가 멀수록 연비 좋은 차량이 더 유리해요.",
      options: [
        { value: "10km 이하", label: "10km 이하", desc: "가까운 거리, 시내 위주", icon: "📍" },
        { value: "10~30km", label: "10~30km", desc: "평균적인 출퇴근 거리", icon: "🛣️" },
        { value: "30km 이상", label: "30km 이상", desc: "장거리, 연비가 중요해요", icon: "🛤️" },
      ],
    },
    "화물·배달": {
      title: "주로 어떤 물량을 운반하시나요?",
      subtitle: "적재 용량에 맞는 차종을 추천해 드려요.",
      options: [
        { value: "소형 박스", label: "소형 박스·소화물", desc: "택배, 소형 물품 위주예요", icon: "📦" },
        { value: "대형 화물", label: "대형 화물·자재", desc: "적재 용량이 정말 중요해요", icon: "🏗️" },
      ],
    },
    "임원용·의전": {
      title: "운전은 어떻게 하시나요?",
      subtitle: "운전 방식에 따라 최적 사양을 달리 추천해 드려요.",
      options: [
        { value: "직접 운전", label: "직접 운전해요", desc: "운전자와 탑승자가 같아요", icon: "🙋" },
        { value: "기사 운행", label: "기사가 운전해요", desc: "후석 편의·공간이 중요해요", icon: "🤵" },
      ],
    },
    가정용: {
      title: "자녀 연령대는 어떻게 되나요?",
      subtitle: "연령에 맞는 안전·편의 기능을 우선으로 추천해요.",
      options: [
        { value: "영유아", label: "영유아가 있어요", desc: "카시트, 안전 기능이 중요해요", icon: "👶" },
        { value: "초등 이상", label: "초등 이상이에요", desc: "실내 공간·편의사양을 중시해요", icon: "🧒" },
        { value: "자녀 없음", label: "자녀가 없어요", desc: "부부 또는 성인 위주로 이용해요", icon: "💑" },
      ],
    },
  },
  budgetDetail: {
    표준형: {
      title: "차량 선택 기준이 어떻게 되나요?",
      subtitle: "약간의 유연성이 있으면 더 좋은 차를 제안드려요.",
      options: [
        { value: "예산 엄수", label: "예산은 꼭 지켜야 해요", desc: "정해진 예산을 초과하고 싶지 않아요", icon: "🎯" },
        { value: "조금 타협 가능", label: "조금 더 낼 수 있어요", desc: "좋은 차라면 약간 유연하게 생각해요", icon: "⚖️" },
      ],
    },
    보수형: {
      title: "초기 비용으로 얼마 정도 준비하셨나요?",
      subtitle: "보증금·선납금이 클수록 월 납입금을 더 낮출 수 있어요.",
      options: [
        { value: "100만원 이하", label: "100만원 이하", desc: "소액 보증금/선납금으로 시작해요", icon: "💵" },
        { value: "100~300만원", label: "100~300만원", desc: "적당한 초기 비용이에요", icon: "💰" },
        { value: "300만원 이상", label: "300만원 이상", desc: "초기 목돈으로 월납을 대폭 낮춰요", icon: "💎" },
      ],
    },
  },
};

export const DEFAULT_SCORING: ScoringConfig = {
  baseScore: 50,
  popularBonus: 5,
  budget: {
    withinBudgetBonus: 30,
    underBudgetBonus: 15,
    overBudgetPenaltyPerManwon: 1,
    maxPenalty: 40,
    flexibleMultiplier: 1.1,
    maxBudgetRatio: 1.4,
  },
  industryDetail: [
    { industry: "법인", detail: "2대 이상", condition: "nonSUV", score: 5 },
    { industry: "개인사업자", detail: "없음", condition: "always", score: 3 },
    { industry: "개인", detail: "4명 이상", condition: "largeCat", score: 8 },
  ],
  purposeDetail: [
    { purpose: "출퇴근·업무용", detail: "30km 이상", condition: "highFuelEff", conditionParam: 14, score: 5 },
    { purpose: "화물·배달", detail: "대형 화물", condition: "heavyCat", score: 10 },
    { purpose: "화물·배달", detail: "대형 화물", condition: "otherCat", score: -10 },
    { purpose: "가정용", detail: "영유아", condition: "suv", score: 8 },
    { purpose: "임원용·의전", detail: "기사 운행", condition: "premiumCat", score: 10 },
  ],
  fuel: {
    전기차: 15,
    하이브리드: 15,
    "가솔린/디젤": 5,
    mismatchPenalty: 5,
  },
  official: {
    premiumCategoryBonus: 15,
    suvBonus: 8,
    smallCategoryPenalty: 15,
    minPrice: 60_000_000,
  },
  highFuelEffBonus: 3,
  highFuelEffThreshold: 15,
  familySuvBonus: 5,
  cargoBonus: 5,
  firstCarMaxPrice: 35_000_000,
  firstCarPriceBonus: 3,
};

export const DEFAULT_FLOW_CONFIG: RecommendFlowConfigData = {
  questions: DEFAULT_QUESTIONS,
  scoring: DEFAULT_SCORING,
};

// ── DB에서 설정 로드 (없으면 기본값 반환) ─────────────────

import { prisma } from "@/lib/prisma";

let _cachedConfig: RecommendFlowConfigData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1분 캐시

export async function getRecommendFlowConfig(): Promise<RecommendFlowConfigData> {
  const now = Date.now();
  if (_cachedConfig && now - _cacheTime < CACHE_TTL) return _cachedConfig;

  try {
    const row = await (prisma as any).recommendFlowConfig.findUnique({
      where: { id: "singleton" },
    });
    if (row) {
      _cachedConfig = {
        questions: row.questions as QuestionsConfig,
        scoring: row.scoring as ScoringConfig,
      };
      _cacheTime = now;
      return _cachedConfig;
    }
  } catch {
    // DB에 테이블 없거나 조회 실패 시 기본값 사용
  }
  return DEFAULT_FLOW_CONFIG;
}

export function invalidateRecommendFlowConfigCache() {
  _cachedConfig = null;
  _cacheTime = 0;
}
