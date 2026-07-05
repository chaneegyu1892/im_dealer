"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type CarCategory = "sedan" | "suv" | "van" | "hatchback" | string;

function resolveCategory(category?: string): CarCategory {
  const c = (category ?? "").toLowerCase();
  if (c.includes("suv")) return "suv";
  if (c.includes("밴") || c.includes("van") || c.includes("mpv")) return "van";
  if (c.includes("해치") || c.includes("hatch")) return "hatchback";
  return "sedan";
}

// ── 차종별 고퀄리티 SVG 베이스 ────────────────────────────

const BRAND = "#27368A";
const BODY_FILL = "#E8EAF6";
const BODY_STROKE = "#B0B8D8";
const GLASS_FILL = "rgba(96,102,238,0.22)";
const GLASS_STROKE = "rgba(96,102,238,0.4)";
const WHEEL_DARK = "#2D3748";
const WHEEL_LIGHT = "#A0AEC0";
const GROUND = "#E2E8F0";

function SedanSide() {
  return (
    <g>
      {/* 지면 */}
      <line x1="5" y1="98" x2="235" y2="98" stroke={GROUND} strokeWidth="2.5" strokeLinecap="round" />
      {/* 차체 — 낮고 긴 세단 실루엣 */}
      <path
        d="M22,82 C22,74 26,68 34,64 L52,54 C58,50 66,46 78,45 L160,45 C172,46 182,50 190,56 L208,68 C214,72 218,76 218,84 L218,92 L22,92 Z"
        fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 유리 — 앞/뒤 윈드실드 + 사이드 */}
      <path
        d="M56,54 C62,50 70,47 80,47 L120,47 L120,68 L48,68 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      <path
        d="M122,47 L156,47 C166,48 174,51 180,56 L196,68 L122,68 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      {/* B필러 */}
      <line x1="121" y1="47" x2="121" y2="68" stroke={BODY_STROKE} strokeWidth="2" />
      {/* 도어 라인 */}
      <line x1="80" y1="68" x2="80" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="121" y1="68" x2="121" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="162" y1="68" x2="162" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      {/* 앞 휠 웰 */}
      <ellipse cx="72" cy="84" rx="22" ry="8" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      {/* 뒷 휠 웰 */}
      <ellipse cx="168" cy="84" rx="22" ry="8" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      {/* 앞 바퀴 */}
      <circle cx="72" cy="88" r="14" fill={WHEEL_DARK} />
      <circle cx="72" cy="88" r="9" fill={WHEEL_LIGHT} />
      <circle cx="72" cy="88" r="3.5" fill={WHEEL_DARK} />
      {/* 뒷 바퀴 */}
      <circle cx="168" cy="88" r="14" fill={WHEEL_DARK} />
      <circle cx="168" cy="88" r="9" fill={WHEEL_LIGHT} />
      <circle cx="168" cy="88" r="3.5" fill={WHEEL_DARK} />
    </g>
  );
}

function SuvSide() {
  return (
    <g>
      <line x1="5" y1="98" x2="235" y2="98" stroke={GROUND} strokeWidth="2.5" strokeLinecap="round" />
      {/* 차체 — 높고 박스형 SUV 실루엣 */}
      <path
        d="M24,82 C24,72 28,62 36,56 L52,38 C58,33 68,30 80,30 L156,30 C168,31 178,34 186,40 L202,56 C210,62 216,70 216,82 L216,92 L24,92 Z"
        fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 유리 — 넓은 측면 */}
      <path
        d="M56,38 C62,34 70,32 80,32 L118,32 L118,58 L46,58 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      <path
        d="M120,32 L154,32 C164,33 172,36 178,41 L194,58 L120,58 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      <line x1="119" y1="32" x2="119" y2="58" stroke={BODY_STROKE} strokeWidth="2" />
      {/* 도어 라인 */}
      <line x1="80" y1="58" x2="80" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="119" y1="58" x2="119" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="158" y1="58" x2="158" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      {/* 휠 웰 */}
      <ellipse cx="72" cy="84" rx="24" ry="9" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      <ellipse cx="168" cy="84" rx="24" ry="9" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      {/* 큰 바퀴 (SUV 특성) */}
      <circle cx="72" cy="88" r="15" fill={WHEEL_DARK} />
      <circle cx="72" cy="88" r="10" fill={WHEEL_LIGHT} />
      <circle cx="72" cy="88" r="4" fill={WHEEL_DARK} />
      <circle cx="168" cy="88" r="15" fill={WHEEL_DARK} />
      <circle cx="168" cy="88" r="10" fill={WHEEL_LIGHT} />
      <circle cx="168" cy="88" r="4" fill={WHEEL_DARK} />
    </g>
  );
}

function VanSide() {
  return (
    <g>
      <line x1="5" y1="98" x2="235" y2="98" stroke={GROUND} strokeWidth="2.5" strokeLinecap="round" />
      {/* 차체 — 높고 수직적인 밴 실루엣 */}
      <path
        d="M28,82 C28,68 32,52 42,40 L52,32 C58,28 68,26 82,26 L160,26 C176,27 192,32 204,42 C210,48 216,58 216,74 L216,92 L28,92 Z"
        fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 유리 — 넓은 전면 + 다중 측면 */}
      <path
        d="M56,32 C62,29 70,27 82,27 L118,27 L118,52 L46,52 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      <path
        d="M120,27 L158,27 C170,28 182,32 192,40 L204,52 L120,52 Z"
        fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1"
      />
      <line x1="119" y1="27" x2="119" y2="52" stroke={BODY_STROKE} strokeWidth="2" />
      {/* 밴 특유 슬라이딩 도어 라인 */}
      <line x1="86" y1="52" x2="86" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="119" y1="52" x2="119" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="152" y1="52" x2="152" y2="84" stroke={BODY_STROKE} strokeWidth="0.8" opacity="0.5" />
      {/* 휠 웰 */}
      <ellipse cx="72" cy="84" rx="22" ry="8" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      <ellipse cx="168" cy="84" rx="22" ry="8" fill="#F8FAFC" stroke={BODY_STROKE} strokeWidth="1" />
      {/* 바퀴 */}
      <circle cx="72" cy="88" r="14" fill={WHEEL_DARK} />
      <circle cx="72" cy="88" r="9" fill={WHEEL_LIGHT} />
      <circle cx="72" cy="88" r="3.5" fill={WHEEL_DARK} />
      <circle cx="168" cy="88" r="14" fill={WHEEL_DARK} />
      <circle cx="168" cy="88" r="9" fill={WHEEL_LIGHT} />
      <circle cx="168" cy="88" r="3.5" fill={WHEEL_DARK} />
    </g>
  );
}

function CarSide({ category }: { category: CarCategory }) {
  switch (category) {
    case "suv": return <SuvSide />;
    case "van": return <VanSide />;
    default: return <SedanSide />;
  }
}

// 정면도 (공용)
function CarFront() {
  return (
    <g>
      <line x1="5" y1="98" x2="235" y2="98" stroke={GROUND} strokeWidth="2.5" strokeLinecap="round" />
      {/* 차체 정면 */}
      <path
        d="M48,90 C48,58 52,44 64,36 L86,28 L154,28 L176,36 C188,44 192,58 192,90 Z"
        fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* 윈드실드 */}
      <path d="M68,52 L74,30 L166,30 L172,52 Z" fill={GLASS_FILL} stroke={GLASS_STROKE} strokeWidth="1" />
      {/* 그릴 */}
      <rect x="100" y="64" width="40" height="16" rx="5" fill={BODY_STROKE} opacity="0.6" />
      <line x1="120" y1="64" x2="120" y2="80" stroke={BODY_STROKE} strokeWidth="0.8" />
      {/* 헤드라이트 */}
      <ellipse cx="74" cy="68" rx="14" ry="10" fill="rgba(255,235,100,0.3)" stroke="rgba(255,200,50,0.5)" strokeWidth="1" />
      <ellipse cx="166" cy="68" rx="14" ry="10" fill="rgba(255,235,100,0.3)" stroke="rgba(255,200,50,0.5)" strokeWidth="1" />
      {/* 범퍼 */}
      <rect x="54" y="82" width="132" height="9" rx="4" fill={BODY_STROKE} opacity="0.4" />
      {/* 측면 바퀴 노출 */}
      <rect x="14" y="60" width="34" height="32" rx="7" fill={WHEEL_DARK} />
      <ellipse cx="31" cy="76" rx="9" ry="12" fill={WHEEL_LIGHT} />
      <rect x="192" y="60" width="34" height="32" rx="7" fill={WHEEL_DARK} />
      <ellipse cx="209" cy="76" rx="9" ry="12" fill={WHEEL_LIGHT} />
    </g>
  );
}

// 실내 단면도 (레그룸)
function CabinDiagram() {
  return (
    <g>
      {/* 바닥 */}
      <rect x="18" y="76" width="204" height="8" rx="2" fill={BODY_STROKE} opacity="0.3" />
      {/* 천장 */}
      <path d="M28,40 Q120,26 212,40" fill="none" stroke={BODY_STROKE} strokeWidth="2" />
      {/* 앞좌석 */}
      <rect x="58" y="42" width="22" height="36" rx="4" fill={BODY_STROKE} opacity="0.4" />
      <rect x="48" y="54" width="38" height="24" rx="4" fill={BODY_STROKE} opacity="0.3" />
      {/* 뒷좌석 */}
      <rect x="150" y="46" width="20" height="32" rx="4" fill={BODY_STROKE} opacity="0.4" />
      <rect x="142" y="56" width="36" height="24" rx="4" fill={BODY_STROKE} opacity="0.3" />
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

// ── 개별 다이어그램 (category-aware) ─────────────────────

interface DiagramProps {
  category: CarCategory;
}

function DiagramLength({ category }: DiagramProps) {
  const left = 22;
  const right = category === "van" ? 216 : 218;
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarSide category={category} />
      <DashLine x1={left} y1={98} x2={left} y2={115} color={BRAND} />
      <DashLine x1={right} y1={98} x2={right} y2={115} color={BRAND} />
      <HArrow x1={left} y1={110} x2={right} color={BRAND} />
      <text x="120" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill={BRAND}>전장 (Overall Length)</text>
    </svg>
  );
}

function DiagramWidth({ category }: DiagramProps) {
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarFront />
      <DashLine x1={48} y1={98} x2={48} y2={115} color="#7C3AED" />
      <DashLine x1={192} y1={98} x2={192} y2={115} color="#7C3AED" />
      <HArrow x1={48} y1={110} x2={192} color="#7C3AED" />
      <text x="120" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7C3AED">전폭 (Overall Width)</text>
    </svg>
  );
}

function DiagramHeight({ category }: DiagramProps) {
  const top = category === "suv" ? 30 : category === "van" ? 26 : 45;
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarSide category={category} />
      <DashLine x1={8} y1={top} x2={100} y2={top} color="#16A34A" />
      <DashLine x1={8} y1={98} x2={22} y2={98} color="#16A34A" />
      <VArrow x={8} y1={top} y2={98} color="#16A34A" />
      <text x="8" y={top + 30} textAnchor="middle" fontSize="10" fontWeight="700" fill="#16A34A"
        transform={`rotate(-90,8,${top + 30})`}>전고</text>
    </svg>
  );
}

function DiagramWheelbase({ category }: DiagramProps) {
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarSide category={category} />
      <circle cx="72" cy="88" r="5" fill="#DC2626" stroke="white" strokeWidth="1.5" />
      <circle cx="168" cy="88" r="5" fill="#DC2626" stroke="white" strokeWidth="1.5" />
      <DashLine x1={72} y1={98} x2={72} y2={115} color="#DC2626" />
      <DashLine x1={168} y1={98} x2={168} y2={115} color="#DC2626" />
      <HArrow x1={72} y1={110} x2={168} color="#DC2626" />
      <text x="120" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill="#DC2626">휠베이스 (Wheelbase)</text>
    </svg>
  );
}

function DiagramGroundClearance({ category }: DiagramProps) {
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarSide category={category} />
      <line x1="30" y1="82" x2="210" y2="82" stroke="#D97706" strokeWidth="1.5" strokeDasharray="5,3" />
      <VArrow x={112} y1={82} y2={98} color="#D97706" />
      <text x="150" y="90" fontSize="10" fontWeight="700" fill="#D97706">최저지상고</text>
      <text x="150" y="102" fontSize="9" fill="#D97706" fillOpacity="0.8">(차체 ↔ 지면)</text>
    </svg>
  );
}

function DiagramLegroom({ label }: { label: string }) {
  const c = "#0891B2";
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CabinDiagram />
      {label.includes("앞") ? (
        <>
          <DashLine x1={86} y1={68} x2={86} y2={108} color={c} />
          <DashLine x1={140} y1={68} x2={140} y2={108} color={c} />
          <HArrow x1={86} y1={105} x2={140} color={c} />
          <text x="113" y="120" textAnchor="middle" fontSize="11" fontWeight="700" fill={c}>{label}</text>
        </>
      ) : (
        <>
          <DashLine x1={172} y1={70} x2={172} y2={108} color={c} />
          <DashLine x1={222} y1={70} x2={222} y2={108} color={c} />
          <HArrow x1={172} y1={105} x2={222} color={c} />
          <text x="197" y="120" textAnchor="middle" fontSize="11" fontWeight="700" fill={c}>{label}</text>
        </>
      )}
    </svg>
  );
}

function DiagramTrunk({ category }: DiagramProps) {
  return (
    <svg viewBox="0 0 240 130" className="w-full max-h-52">
      <CarSide category={category} />
      <rect x="170" y="36" width="42" height="48" rx="5"
        fill="#0F766E" fillOpacity="0.12" stroke="#0F766E" strokeWidth="1.5" strokeDasharray="5,3" />
      <text x="191" y="62" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F766E">트렁크</text>
      <text x="191" y="74" textAnchor="middle" fontSize="9" fill="#0F766E" fillOpacity="0.8">용량</text>
    </svg>
  );
}

// ── 다이어그램 설정 맵 ──────────────────────────────────────

interface DiagramConfig {
  description: string;
  component: (props: DiagramProps) => React.ReactNode;
}

export const SPEC_DIAGRAM_MAP: Record<string, DiagramConfig> = {
  length: {
    description: "차량 앞 끝(범퍼)에서 뒷 끝(범퍼)까지의 전체 길이입니다. 길수록 실내 공간이 넓지만 주차가 어려워집니다.",
    component: (p) => <DiagramLength {...p} />,
  },
  width: {
    description: "사이드미러를 제외한 차량의 가장 넓은 너비입니다. 좁은 골목이나 주차장 통과 시 중요한 수치입니다.",
    component: (p) => <DiagramWidth {...p} />,
  },
  height: {
    description: "지면에서 차량 지붕 최상단까지의 높이입니다. 높을수록 헤드룸이 넓고, 지하 주차장 진입 시 확인이 필요합니다.",
    component: (p) => <DiagramHeight {...p} />,
  },
  wheelbase: {
    description: "앞바퀴 중심에서 뒷바퀴 중심까지의 거리입니다. 값이 클수록 실내 공간(특히 뒷좌석 레그룸)이 넓고 승차감이 좋습니다.",
    component: (p) => <DiagramWheelbase {...p} />,
  },
  ground_clearance: {
    description: "노면에서 차체 가장 낮은 부분까지의 높이입니다. SUV나 험로 주행 시 이 수치가 높을수록 유리합니다.",
    component: (p) => <DiagramGroundClearance {...p} />,
  },
  front_legroom: {
    description: "운전석·조수석 시트 앞쪽의 발 여유 공간입니다. 키가 큰 운전자에게 중요한 수치입니다.",
    component: () => <DiagramLegroom label="앞좌석 레그룸" />,
  },
  rear_legroom: {
    description: "뒷좌석에서 앞좌석 등받이까지의 무릎 여유 공간입니다. 가족 탑승 시 뒷좌석 편의성을 결정합니다.",
    component: () => <DiagramLegroom label="뒷좌석 레그룸" />,
  },
  trunk_capacity: {
    description: "짐칸(트렁크)에 실을 수 있는 용량입니다. L(리터) 단위로 표기되며, 골프백 2개 기준 약 400L 이상이면 넉넉합니다.",
    component: (p) => <DiagramTrunk {...p} />,
  },
};

export function hasSpecDiagram(key: string): boolean {
  return key in SPEC_DIAGRAM_MAP;
}

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

// ── 모달 컴포넌트 ──────────────────────────────────────────

interface SpecModalProps {
  specKey: string;
  label: string;
  value: string;
  category?: string;
  onClose: () => void;
}

export function SpecDiagramModal({ specKey, label, value, category, onClose }: SpecModalProps) {
  const cat = resolveCategory(category);
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
          className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between border-b border-[#E5E8EB] px-5 pb-4 pt-5">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand">차량 제원</p>
              <h3 className="text-[19px] font-extrabold tracking-[-0.03em] text-text-strong">{label}</h3>
              <p className="num mt-1 text-[24px] font-extrabold leading-none text-brand">{value}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-[#F8FAFC]"
            >
              <X size={18} />
            </button>
          </div>

          {/* 다이어그램 */}
          {diagramConfig && (
            <div className="bg-[#F8FAFC] px-5 pb-3 pt-4">
              {diagramConfig.component({ category: cat })}
            </div>
          )}

          {/* 설명 */}
          {description && (
            <div className="px-5 py-4">
              <p className="text-[13.5px] leading-[1.6] text-text-body">{description}</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
