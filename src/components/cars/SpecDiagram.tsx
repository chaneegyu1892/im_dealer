"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// ── 공통 SVG 컴포넌트 ──────────────────────────────────────

/** 세단 측면도 */
function SideCarBase() {
  return (
    <g>
      {/* 차체 */}
      <path
        d="M28,78 L28,62 L46,47 L78,33 Q90,30 102,30 L148,30 Q160,30 169,35 L194,55 L207,68 L207,78 Z"
        fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 유리 영역 */}
      <path
        d="M50,60 L78,34 Q90,31 102,31 L148,31 Q159,31 167,36 L188,57 L188,60 Z"
        fill="#BFDBFE" fillOpacity="0.65" stroke="#93C5FD" strokeWidth="1"
      />
      {/* 도어 라인 */}
      <line x1="118" y1="46" x2="118" y2="78" stroke="#CBD5E1" strokeWidth="1" />
      {/* 앞 휠 웰 */}
      <ellipse cx="72" cy="78" rx="20" ry="7" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* 뒷 휠 웰 */}
      <ellipse cx="165" cy="78" rx="20" ry="7" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* 앞 바퀴 */}
      <circle cx="72" cy="82" r="13" fill="#475569" />
      <circle cx="72" cy="82" r="7" fill="#94A3B8" />
      <circle cx="72" cy="82" r="3" fill="#475569" />
      {/* 뒷 바퀴 */}
      <circle cx="165" cy="82" r="13" fill="#475569" />
      <circle cx="165" cy="82" r="7" fill="#94A3B8" />
      <circle cx="165" cy="82" r="3" fill="#475569" />
      {/* 지면선 */}
      <line x1="5" y1="95" x2="235" y2="95" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** 정면도 */
function FrontCarBase() {
  return (
    <g>
      {/* 차체 */}
      <path
        d="M52,88 L52,55 Q52,44 62,39 L82,31 L158,31 L178,39 Q188,44 188,55 L188,88 Z"
        fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 앞유리 */}
      <path
        d="M65,54 L69,33 L171,33 L175,54 Z"
        fill="#BFDBFE" fillOpacity="0.65" stroke="#93C5FD" strokeWidth="1"
      />
      {/* 그릴 */}
      <rect x="98" y="68" width="44" height="14" rx="4" fill="#CBD5E1" />
      <line x1="120" y1="68" x2="120" y2="82" stroke="#E2E8F0" strokeWidth="1" />
      {/* 헤드라이트 */}
      <ellipse cx="72" cy="72" rx="13" ry="9" fill="#FEF9C3" stroke="#FDE68A" strokeWidth="1" />
      <ellipse cx="168" cy="72" rx="13" ry="9" fill="#FEF9C3" stroke="#FDE68A" strokeWidth="1" />
      {/* 범퍼 */}
      <rect x="56" y="82" width="128" height="8" rx="3" fill="#E2E8F0" />
      {/* 앞 바퀴 (측면 노출) */}
      <rect x="16" y="63" width="32" height="30" rx="6" fill="#475569" />
      <ellipse cx="32" cy="78" rx="8" ry="11" fill="#94A3B8" />
      <rect x="192" y="63" width="32" height="30" rx="6" fill="#475569" />
      <ellipse cx="208" cy="78" rx="8" ry="11" fill="#94A3B8" />
      {/* 지면선 */}
      <line x1="5" y1="95" x2="235" y2="95" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

// ── 측정 화살표 헬퍼 ──────────────────────────────────────

function HArrow({ x1, y1, x2, color }: { x1: number; y1: number; x2: number; color: string }) {
  const d = 8;
  return (
    <g>
      <line x1={x1 + d} y1={y1} x2={x2 - d} y2={y1} stroke={color} strokeWidth="2" />
      <path d={`M${x1},${y1} L${x1 + d + 2},${y1 - 4} L${x1 + d + 2},${y1 + 4} Z`} fill={color} />
      <path d={`M${x2},${y1} L${x2 - d - 2},${y1 - 4} L${x2 - d - 2},${y1 + 4} Z`} fill={color} />
    </g>
  );
}

function VArrow({ x, y1, y2, color }: { x: number; y1: number; y2: number; color: string }) {
  const d = 8;
  return (
    <g>
      <line x1={x} y1={y1 + d} x2={x} y2={y2 - d} stroke={color} strokeWidth="2" />
      <path d={`M${x},${y1} L${x - 4},${y1 + d + 2} L${x + 4},${y1 + d + 2} Z`} fill={color} />
      <path d={`M${x},${y2} L${x - 4},${y2 - d - 2} L${x + 4},${y2 - d - 2} Z`} fill={color} />
    </g>
  );
}

function DashLine({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1" strokeDasharray="4,3" />;
}

// ── 개별 다이어그램 ──────────────────────────────────────

function DiagramLength() {
  const c = "#1D4ED8";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <SideCarBase />
      <DashLine x1={28} y1={95} x2={28} y2={112} color={c} />
      <DashLine x1={207} y1={95} x2={207} y2={112} color={c} />
      <HArrow x1={28} y1={108} x2={207} color={c} />
      <text x="118" y="120" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>전장 (Overall Length)</text>
    </svg>
  );
}

function DiagramWidth() {
  const c = "#7C3AED";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <FrontCarBase />
      <DashLine x1={52} y1={95} x2={52} y2={112} color={c} />
      <DashLine x1={188} y1={95} x2={188} y2={112} color={c} />
      <HArrow x1={52} y1={108} x2={188} color={c} />
      <text x="120" y="120" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>전폭 (Overall Width)</text>
    </svg>
  );
}

function DiagramHeight() {
  const c = "#16A34A";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <SideCarBase />
      <DashLine x1={14} y1={30} x2={102} y2={30} color={c} />
      <DashLine x1={14} y1={95} x2={28} y2={95} color={c} />
      <VArrow x={14} y1={30} y2={95} color={c} />
      <text x="14" y="64" textAnchor="middle" fontSize="9" fontWeight="700" fill={c}
        transform="rotate(-90,14,64)">전고</text>
    </svg>
  );
}

function DiagramWheelbase() {
  const c = "#DC2626";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <SideCarBase />
      {/* 바퀴 중심 강조 */}
      <circle cx="72" cy="82" r="4" fill={c} stroke="white" strokeWidth="1.5" />
      <circle cx="165" cy="82" r="4" fill={c} stroke="white" strokeWidth="1.5" />
      {/* 수직 점선 → 화살표 라인으로 */}
      <DashLine x1={72} y1={95} x2={72} y2={112} color={c} />
      <DashLine x1={165} y1={95} x2={165} y2={112} color={c} />
      <HArrow x1={72} y1={108} x2={165} color={c} />
      <text x="119" y="120" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>휠베이스 (Wheelbase)</text>
    </svg>
  );
}

function DiagramGroundClearance() {
  const c = "#D97706";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <SideCarBase />
      {/* 차체 하단선 강조 */}
      <line x1={35} y1={78} x2={200} y2={78} stroke={c} strokeWidth="1.5" strokeDasharray="5,3" />
      {/* 측정 화살표 (차체 하단 → 지면) */}
      <DashLine x1={118} y1={78} x2={108} y2={78} color={c} />
      <DashLine x1={118} y1={95} x2={108} y2={95} color={c} />
      <VArrow x={112} y1={78} y2={95} color={c} />
      <text x="155" y="88" fontSize="9" fontWeight="700" fill={c}>최저지상고</text>
      <text x="155" y="99" fontSize="8" fill={c} fillOpacity="0.8">(차체 ↔ 지면)</text>
    </svg>
  );
}

function DiagramLegroom({ label }: { label: string }) {
  const c = "#0891B2";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      {/* 간략 실내 단면도 */}
      {/* 바닥 */}
      <rect x="20" y="75" width="200" height="8" rx="2" fill="#E2E8F0" />
      {/* 앞좌석 */}
      <rect x="60" y="42" width="20" height="35" rx="3" fill="#CBD5E1" />
      <rect x="50" y="53" width="35" height="22" rx="3" fill="#CBD5E1" />
      {/* 뒷좌석 */}
      <rect x="148" y="46" width="18" height="31" rx="3" fill="#CBD5E1" />
      <rect x="140" y="55" width="35" height="22" rx="3" fill="#CBD5E1" />
      {/* 천장 */}
      <path d="M30,40 Q120,28 210,40" fill="none" stroke="#CBD5E1" strokeWidth="2" />
      {/* 발 공간 화살표 */}
      {label.includes("앞") ? (
        <>
          <DashLine x1={85} y1={68} x2={85} y2={108} color={c} />
          <DashLine x1={140} y1={68} x2={140} y2={108} color={c} />
          <HArrow x1={85} y1={105} x2={140} color={c} />
          <text x="113" y="118" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{label}</text>
        </>
      ) : (
        <>
          <DashLine x1={175} y1={70} x2={175} y2={108} color={c} />
          <DashLine x1={220} y1={70} x2={220} y2={108} color={c} />
          <HArrow x1={175} y1={105} x2={220} color={c} />
          <text x="198" y="118" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{label}</text>
        </>
      )}
    </svg>
  );
}

function DiagramTrunk() {
  const c = "#0F766E";
  return (
    <svg viewBox="0 0 240 125" className="w-full max-h-48">
      <SideCarBase />
      {/* 트렁크 영역 강조 */}
      <rect x="170" y="36" width="35" height="42" rx="4"
        fill={c} fillOpacity="0.12" stroke={c} strokeWidth="1.5" strokeDasharray="5,3" />
      <text x="188" y="60" textAnchor="middle" fontSize="9" fontWeight="700" fill={c}>트렁크</text>
      <text x="188" y="71" textAnchor="middle" fontSize="8" fill={c} fillOpacity="0.8">용량</text>
    </svg>
  );
}

// ── 다이어그램 설정 맵 ──────────────────────────────────────

interface DiagramConfig {
  description: string;
  component: React.ReactNode;
}

export const SPEC_DIAGRAM_MAP: Record<string, DiagramConfig> = {
  length: {
    description: "차량 앞 끝(범퍼)에서 뒷 끝(범퍼)까지의 전체 길이입니다. 길수록 실내 공간이 넓지만 주차가 어려워집니다.",
    component: <DiagramLength />,
  },
  width: {
    description: "사이드미러를 제외한 차량의 가장 넓은 너비입니다. 좁은 골목이나 주차장 통과 시 중요한 수치입니다.",
    component: <DiagramWidth />,
  },
  height: {
    description: "지면에서 차량 지붕 최상단까지의 높이입니다. 높을수록 헤드룸이 넓고, 지하 주차장 진입 시 확인이 필요합니다.",
    component: <DiagramHeight />,
  },
  wheelbase: {
    description: "앞바퀴 중심에서 뒷바퀴 중심까지의 거리입니다. 값이 클수록 실내 공간(특히 뒷좌석 레그룸)이 넓고 승차감이 좋습니다.",
    component: <DiagramWheelbase />,
  },
  ground_clearance: {
    description: "노면에서 차체 가장 낮은 부분까지의 높이입니다. SUV나 험로 주행 시 이 수치가 높을수록 유리합니다.",
    component: <DiagramGroundClearance />,
  },
  front_legroom: {
    description: "운전석·조수석 시트 앞쪽의 발 여유 공간입니다. 키가 큰 운전자에게 중요한 수치입니다.",
    component: <DiagramLegroom label="앞좌석 레그룸" />,
  },
  rear_legroom: {
    description: "뒷좌석에서 앞좌석 등받이까지의 무릎 여유 공간입니다. 가족 탑승 시 뒷좌석 편의성을 결정합니다.",
    component: <DiagramLegroom label="뒷좌석 레그룸" />,
  },
  trunk_capacity: {
    description: "짐칸(트렁크)에 실을 수 있는 용량입니다. L(리터) 단위로 표기되며, 골프백 2개 기준 약 400L 이상이면 넉넉합니다.",
    component: <DiagramTrunk />,
  },
};

/** 다이어그램이 있는 스펙 키인지 확인 */
export function hasSpecDiagram(key: string): boolean {
  return key in SPEC_DIAGRAM_MAP;
}

/** 다이어그램 없는 스펙에 대한 텍스트 설명 */
export const SPEC_TEXT_DESC: Record<string, string> = {
  max_power: "엔진이 낼 수 있는 최대 출력입니다. ps(마력) 또는 kW로 표기하며, 높을수록 가속력이 강합니다.",
  max_torque: "엔진의 회전 강도로, 가속력과 직결됩니다. kgf·m 또는 Nm으로 표기합니다.",
  fuel_efficiency: "연료 1리터(전기차는 1kWh)로 달릴 수 있는 거리입니다. 높을수록 경제적입니다.",
  range: "전기차가 완충 상태에서 달릴 수 있는 최대 거리입니다.",
  engine: "엔진의 형식 및 구성 방식입니다.",
  displacement: "엔진 실린더 내 총 용적(cc)입니다. 배기량이 클수록 일반적으로 출력이 높지만 연비는 낮아집니다.",
  frunk_capacity: "전기차 전면(보닛 아래)에 있는 추가 짐 공간 용량입니다.",
  battery: "전기차 배터리의 총 용량(kWh)입니다. 클수록 1회 충전 주행거리가 늘어납니다.",
  charging: "사용 가능한 충전 방식과 최대 충전 속도입니다.",
  front_suspension: "앞바퀴의 충격 흡수 구조입니다. 독립 서스펜션일수록 코너링 안정성이 높습니다.",
  rear_suspension: "뒷바퀴의 충격 흡수 구조입니다.",
  front_brake: "앞바퀴 제동 장치의 형식입니다. 디스크 브레이크가 드럼보다 제동력이 우수합니다.",
  rear_brake: "뒷바퀴 제동 장치의 형식입니다.",
  steering: "핸들 조작을 바퀴에 전달하는 방식입니다. 전동식(MDPS)이 주류입니다.",
  drag_coefficient: "공기 저항 계수(Cd)입니다. 낮을수록 고속에서 안정적이고 연비가 좋습니다.",
  fuel_tank: "주유 가능한 연료 탱크 전체 용량(L)입니다.",
};

// ── 모달 컴포넌트 (export) ──────────────────────────────────

interface SpecModalProps {
  specKey: string;
  label: string;
  value: string;
  onClose: () => void;
}

export function SpecDiagramModal({ specKey, label, value, onClose }: SpecModalProps) {
  const diagramConfig = SPEC_DIAGRAM_MAP[specKey];
  const textDesc = SPEC_TEXT_DESC[specKey];
  const description = diagramConfig?.description ?? textDesc;

  return (
    <AnimatePresence>
      <motion.div
        key="spec-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center px-5"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40" />
        <motion.div
          key="spec-modal-panel"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-[400px] bg-white rounded-[22px] shadow-2xl overflow-hidden"
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-line">
            <div>
              <p className="t-kick mb-1.5">차량 제원</p>
              <h3 className="text-[19px] font-extrabold tracking-[-0.03em] text-ink">{label}</h3>
              <p className="num text-[24px] font-extrabold text-brand mt-1 leading-none">{value}</p>
            </div>
            <button
              onClick={onClose}
              className="t-iconbtn shrink-0 mt-0.5 hover:bg-line2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 다이어그램 */}
          {diagramConfig && (
            <div className="px-5 pt-4 pb-3 bg-sec">
              {diagramConfig.component}
            </div>
          )}

          {/* 설명 */}
          {description && (
            <div className="px-5 py-4">
              <p className="text-[13.5px] text-g1 leading-[1.6]">{description}</p>
            </div>
          )}

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
