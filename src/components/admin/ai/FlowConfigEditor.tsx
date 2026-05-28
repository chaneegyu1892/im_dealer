"use client";

import { useState } from "react";
import {
  Save, ChevronDown, ChevronRight, Plus, Trash2,
  MessageSquare, Sliders, RotateCcw, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FLOW_CONFIG,
  type RecommendFlowConfigData,
  type QuestionStep,
  type QuestionOption,
  type DetailScoringRule,
} from "@/lib/recommend-config";

interface Props {
  initialConfig: RecommendFlowConfigData;
}

type Tab = "questions" | "scoring";

// ── 섹션 헤더 ────────────────────────────────────────────

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-[#F4F5F8] rounded-[8px] hover:bg-[#ECEDF5] transition-colors text-left"
    >
      <span className="text-[13px] font-bold text-[#1A1A2E]">{title}</span>
      {open ? <ChevronDown size={14} className="text-[#6B7399]" /> : <ChevronRight size={14} className="text-[#6B7399]" />}
    </button>
  );
}

// ── 숫자 입력 ────────────────────────────────────────────

function NumberInput({
  label, value, onChange, min, max, step = 1, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 text-[13px] border border-[#E8EAF0] rounded-[6px] focus:outline-none focus:border-[#6066EE] bg-white"
      />
      {hint && <p className="text-[10px] text-[#9BA4C0]">{hint}</p>}
    </div>
  );
}

// ── 텍스트 입력 ──────────────────────────────────────────

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-[13px] border border-[#E8EAF0] rounded-[6px] focus:outline-none focus:border-[#6066EE] bg-white"
      />
    </div>
  );
}

// ── 선택지 편집기 ────────────────────────────────────────

function OptionEditor({
  options,
  onChange,
}: {
  options: QuestionOption[];
  onChange: (opts: QuestionOption[]) => void;
}) {
  const update = (i: number, field: keyof QuestionOption, val: string) => {
    const next = options.map((o, idx) => idx === i ? { ...o, [field]: val } : o);
    onChange(next);
  };

  const add = () => onChange([...options, { value: "", label: "", desc: "", icon: "✨" }]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_32px] gap-1.5 items-center bg-[#FAFBFF] border border-[#F0F2F8] rounded-[6px] px-2 py-2">
          <input value={opt.icon} onChange={(e) => update(i, "icon", e.target.value)}
            className="w-full text-center text-[18px] border border-[#E8EAF0] rounded-[4px] py-1 focus:outline-none focus:border-[#6066EE]" />
          <input value={opt.label} onChange={(e) => update(i, "label", e.target.value)}
            placeholder="라벨" className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]" />
          <input value={opt.value} onChange={(e) => update(i, "value", e.target.value)}
            placeholder="값 (변경 주의)" className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE] text-[#9BA4C0]" />
          <input value={opt.desc} onChange={(e) => update(i, "desc", e.target.value)}
            placeholder="설명" className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]" />
          <button onClick={() => remove(i)} className="text-[#DC2626] hover:bg-red-50 rounded-[4px] p-1 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] text-[#6066EE] hover:text-[#000666] font-semibold px-2 py-1">
        <Plus size={12} /> 선택지 추가
      </button>
    </div>
  );
}

// ── 질문 스텝 편집기 ─────────────────────────────────────

function StepEditor({
  label,
  step,
  onChange,
}: {
  label: string;
  step: QuestionStep;
  onChange: (s: QuestionStep) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#E8EAF0] rounded-[8px] overflow-hidden">
      <SectionHeader title={label} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div className="px-4 py-4 space-y-3 bg-white">
          <TextInput label="질문 텍스트" value={step.title} onChange={(v) => onChange({ ...step, title: v })} />
          <TextInput label="부제목" value={step.subtitle} onChange={(v) => onChange({ ...step, subtitle: v })} />
          <div>
            <p className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider mb-2">선택지</p>
            <div className="text-[10px] text-[#9BA4C0] mb-1.5 flex items-center gap-1">
              <Info size={10} />
              아이콘 · 라벨 · 값(value) · 설명 순서
            </div>
            <OptionEditor options={step.options} onChange={(opts) => onChange({ ...step, options: opts })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 점수 규칙 행 ────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  always: "항상 적용",
  suv: "SUV 카테고리",
  largeCat: "SUV·대형 카테고리",
  heavyCat: "밴·트럭 카테고리",
  otherCat: "밴·트럭 이외",
  premiumCat: "대형·세단 카테고리",
  nonSUV: "SUV 아님",
  highFuelEff: "고연비 차량 (임계값 이상)",
  highPrice: "고가 차량 (임계값 이상)",
};

function ScoringRuleRow({
  rule,
  onChange,
  onDelete,
  scope,
}: {
  rule: DetailScoringRule;
  onChange: (r: DetailScoringRule) => void;
  onDelete: () => void;
  scope: "industry" | "purpose";
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_28px] gap-1.5 items-center bg-[#FAFBFF] border border-[#F0F2F8] rounded-[6px] px-2 py-2">
      <input
        value={scope === "industry" ? (rule.industry ?? "") : (rule.purpose ?? "")}
        onChange={(e) => onChange(scope === "industry" ? { ...rule, industry: e.target.value } : { ...rule, purpose: e.target.value })}
        placeholder={scope === "industry" ? "업종" : "목적"}
        className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]"
      />
      <input
        value={rule.detail}
        onChange={(e) => onChange({ ...rule, detail: e.target.value })}
        placeholder="추가 답변값"
        className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]"
      />
      <select
        value={rule.condition}
        onChange={(e) => onChange({ ...rule, condition: e.target.value })}
        className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE] bg-white"
      >
        {Object.entries(CONDITION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {(rule.condition === "highFuelEff" || rule.condition === "highPrice") ? (
        <input
          type="number"
          value={rule.conditionParam ?? 0}
          onChange={(e) => onChange({ ...rule, conditionParam: Number(e.target.value) })}
          placeholder="임계값"
          className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]"
        />
      ) : <div />}
      <input
        type="number"
        value={rule.score}
        onChange={(e) => onChange({ ...rule, score: Number(e.target.value) })}
        placeholder="점수"
        className="px-2 py-1.5 text-[12px] border border-[#E8EAF0] rounded-[4px] focus:outline-none focus:border-[#6066EE]"
      />
      <button onClick={onDelete} className="text-[#DC2626] hover:bg-red-50 rounded-[4px] p-1 transition-colors">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────

export default function FlowConfigEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<RecommendFlowConfigData>(initialConfig);
  const [activeTab, setActiveTab] = useState<Tab>("scoring");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const { questions: q, scoring: sc } = config;

  // ── 질문 헬퍼 ───────────────────────────────────────

  const setQ = (patch: Partial<typeof q>) =>
    setConfig((c) => ({ ...c, questions: { ...c.questions, ...patch } }));

  const setIndustryDetail = (key: string, step: QuestionStep) =>
    setQ({ industryDetail: { ...q.industryDetail, [key]: step } });

  const setPurposeDetail = (key: string, step: QuestionStep) =>
    setQ({ purposeDetail: { ...q.purposeDetail, [key]: step } });

  // ── 스코어링 헬퍼 ──────────────────────────────────

  const setSc = (patch: Partial<typeof sc>) =>
    setConfig((c) => ({ ...c, scoring: { ...c.scoring, ...patch } }));

  const updateIndustryRule = (i: number, rule: DetailScoringRule) =>
    setSc({ industryDetail: sc.industryDetail.map((r, idx) => idx === i ? rule : r) });

  const deleteIndustryRule = (i: number) =>
    setSc({ industryDetail: sc.industryDetail.filter((_, idx) => idx !== i) });

  const addIndustryRule = () =>
    setSc({ industryDetail: [...sc.industryDetail, { industry: "", detail: "", condition: "always", score: 5 }] });

  const updatePurposeRule = (i: number, rule: DetailScoringRule) =>
    setSc({ purposeDetail: sc.purposeDetail.map((r, idx) => idx === i ? rule : r) });

  const deletePurposeRule = (i: number) =>
    setSc({ purposeDetail: sc.purposeDetail.filter((_, idx) => idx !== i) });

  const addPurposeRule = () =>
    setSc({ purposeDetail: [...sc.purposeDetail, { purpose: "", detail: "", condition: "always", score: 5 }] });

  // ── 저장 ─────────────────────────────────────────

  const handleSave = async (part: "questions" | "scoring" | "all") => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (part === "questions" || part === "all") body.questions = q;
      if (part === "scoring" || part === "all") body.scoring = sc;

      const res = await fetch("/api/admin/ai/flow-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "저장 실패");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm("모든 설정을 기본값으로 초기화하시겠습니까?")) return;
    setConfig(DEFAULT_FLOW_CONFIG);
  };

  return (
    <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-[#F0F2F8] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-[#1A1A2E]">추천 플로우 설정</h3>
          <p className="text-[11px] text-[#9BA4C0] mt-0.5">
            질문 텍스트·선택지와 점수 규칙을 직접 조정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-[11px] text-emerald-500 font-medium">{savedAt} 저장됨</span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[12px] text-[#9BA4C0] hover:text-[#DC2626] transition-colors px-2 py-1.5 rounded-[6px] hover:bg-red-50"
          >
            <RotateCcw size={12} /> 초기화
          </button>
          <button
            onClick={() => handleSave("all")}
            disabled={saving}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#000666] hover:bg-[#0010CC] px-3 py-1.5 rounded-[6px] transition-colors disabled:opacity-60"
          >
            <Save size={12} /> {saving ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#F0F2F8] px-5">
        {([
          { id: "scoring" as Tab, label: "점수 규칙", icon: Sliders },
          { id: "questions" as Tab, label: "질문·선택지", icon: MessageSquare },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors",
              activeTab === id
                ? "border-[#6066EE] text-[#000666]"
                : "border-transparent text-[#6B7399] hover:text-[#1A1A2E]"
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">

        {/* ── 점수 규칙 탭 ──────────────────────────────── */}
        {activeTab === "scoring" && (
          <div className="space-y-5">
            {/* 기본 점수 */}
            <div>
              <p className="text-[12px] font-bold text-[#1A1A2E] mb-3">기본 점수</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberInput label="기본 점수" value={sc.baseScore} onChange={(v) => setSc({ baseScore: v })} min={0} hint="모든 차량의 시작 점수" />
                <NumberInput label="인기 차량 가산" value={sc.popularBonus} onChange={(v) => setSc({ popularBonus: v })} min={0} hint="isPopular 차량" />
                <NumberInput label="고연비 가산 기준" value={sc.highFuelEffThreshold} onChange={(v) => setSc({ highFuelEffThreshold: v })} step={0.1} hint="km/L 이상" />
                <NumberInput label="고연비 가산 점수" value={sc.highFuelEffBonus} onChange={(v) => setSc({ highFuelEffBonus: v })} />
              </div>
            </div>

            {/* 예산 점수 */}
            <div>
              <p className="text-[12px] font-bold text-[#1A1A2E] mb-3">예산 적합도</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumberInput label="예산 내 가산" value={sc.budget.withinBudgetBonus} onChange={(v) => setSc({ budget: { ...sc.budget, withinBudgetBonus: v } })} />
                <NumberInput label="예산 이하 가산" value={sc.budget.underBudgetBonus} onChange={(v) => setSc({ budget: { ...sc.budget, underBudgetBonus: v } })} />
                <NumberInput label="초과 만원당 감점" value={sc.budget.overBudgetPenaltyPerManwon} onChange={(v) => setSc({ budget: { ...sc.budget, overBudgetPenaltyPerManwon: v } })} step={0.5} />
                <NumberInput label="최대 감점" value={sc.budget.maxPenalty} onChange={(v) => setSc({ budget: { ...sc.budget, maxPenalty: v } })} hint="감점 상한" />
                <NumberInput label="유연 예산 배율" value={sc.budget.flexibleMultiplier} onChange={(v) => setSc({ budget: { ...sc.budget, flexibleMultiplier: v } })} step={0.05} hint="'조금 타협 가능' 시 상한 배율" />
                <NumberInput label="제외 예산 배율" value={sc.budget.maxBudgetRatio} onChange={(v) => setSc({ budget: { ...sc.budget, maxBudgetRatio: v } })} step={0.1} hint="이 배율 초과 시 추천 제외" />
              </div>
            </div>

            {/* 연료 점수 */}
            <div>
              <p className="text-[12px] font-bold text-[#1A1A2E] mb-3">연료방식 가산</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberInput label="전기차 일치" value={sc.fuel["전기차"]} onChange={(v) => setSc({ fuel: { ...sc.fuel, "전기차": v } })} />
                <NumberInput label="하이브리드 일치" value={sc.fuel["하이브리드"]} onChange={(v) => setSc({ fuel: { ...sc.fuel, "하이브리드": v } })} />
                <NumberInput label="내연기관 일치" value={sc.fuel["가솔린/디젤"]} onChange={(v) => setSc({ fuel: { ...sc.fuel, "가솔린/디젤": v } })} />
                <NumberInput label="미일치 감점" value={sc.fuel.mismatchPenalty} onChange={(v) => setSc({ fuel: { ...sc.fuel, mismatchPenalty: v } })} hint="양수 입력 → 실제 감점" />
              </div>
            </div>

            {/* 의전 점수 */}
            <div>
              <p className="text-[12px] font-bold text-[#1A1A2E] mb-3">임원용·의전 스코어</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberInput label="대형·세단 가산" value={sc.official.premiumCategoryBonus} onChange={(v) => setSc({ official: { ...sc.official, premiumCategoryBonus: v } })} />
                <NumberInput label="SUV 가산" value={sc.official.suvBonus} onChange={(v) => setSc({ official: { ...sc.official, suvBonus: v } })} />
                <NumberInput label="소형·경차 감점" value={sc.official.smallCategoryPenalty} onChange={(v) => setSc({ official: { ...sc.official, smallCategoryPenalty: v } })} hint="양수 입력 → 실제 감점" />
                <NumberInput label="최소 차량가 (원)" value={sc.official.minPrice} onChange={(v) => setSc({ official: { ...sc.official, minPrice: v } })} step={1000000} hint="이하 차량은 의전 제외" />
              </div>
            </div>

            {/* 업종 추가답변 규칙 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-bold text-[#1A1A2E]">업종 추가답변 규칙</p>
                <button onClick={addIndustryRule} className="flex items-center gap-1 text-[11px] text-[#6066EE] font-semibold hover:text-[#000666]">
                  <Plus size={11} /> 규칙 추가
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_28px] gap-1 mb-1 px-2">
                {["업종", "추가답변 값", "적용 조건", "임계값", "점수", ""].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-[#9BA4C0] uppercase tracking-wider">{h}</span>
                ))}
              </div>
              <div className="space-y-1.5">
                {sc.industryDetail.map((rule, i) => (
                  <ScoringRuleRow key={i} rule={rule} scope="industry"
                    onChange={(r) => updateIndustryRule(i, r)}
                    onDelete={() => deleteIndustryRule(i)} />
                ))}
              </div>
            </div>

            {/* 목적 추가답변 규칙 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-bold text-[#1A1A2E]">목적 추가답변 규칙</p>
                <button onClick={addPurposeRule} className="flex items-center gap-1 text-[11px] text-[#6066EE] font-semibold hover:text-[#000666]">
                  <Plus size={11} /> 규칙 추가
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_28px] gap-1 mb-1 px-2">
                {["목적", "추가답변 값", "적용 조건", "임계값", "점수", ""].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-[#9BA4C0] uppercase tracking-wider">{h}</span>
                ))}
              </div>
              <div className="space-y-1.5">
                {sc.purposeDetail.map((rule, i) => (
                  <ScoringRuleRow key={i} rule={rule} scope="purpose"
                    onChange={(r) => updatePurposeRule(i, r)}
                    onDelete={() => deletePurposeRule(i)} />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => handleSave("scoring")} disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#000666] hover:bg-[#0010CC] px-4 py-2 rounded-[6px] disabled:opacity-60">
                <Save size={12} /> 점수 규칙 저장
              </button>
            </div>
          </div>
        )}

        {/* ── 질문·선택지 탭 ──────────────────────────── */}
        {activeTab === "questions" && (
          <div className="space-y-4">
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2 flex items-start gap-2">
              <Info size={12} className="mt-0.5 shrink-0" />
              선택지의 <strong>값(value)</strong>은 점수 규칙과 연결됩니다. 값을 변경하면 점수 규칙도 함께 수정하세요.
            </div>

            <p className="text-[12px] font-bold text-[#1A1A2E]">주요 단계</p>
            <StepEditor label="1단계 — 업종" step={q.industry} onChange={(s) => setQ({ industry: s })} />
            <StepEditor label="2단계 — 목적 (기본)" step={q.purpose} onChange={(s) => setQ({ purpose: s })} />
            <StepEditor label="3단계 — 예산 범위" step={q.budget} onChange={(s) => setQ({ budget: s })} />
            <StepEditor label="3단계 — 납입 방식" step={q.paymentStyle} onChange={(s) => setQ({ paymentStyle: s })} />
            <StepEditor label="3단계 — 주행거리" step={q.mileage} onChange={(s) => setQ({ mileage: s })} />
            <StepEditor label="4단계 — 연료 방식" step={q.fuel} onChange={(s) => setQ({ fuel: s })} />

            <p className="text-[12px] font-bold text-[#1A1A2E] mt-2">업종별 목적 (업종 선택 후 표시)</p>
            {Object.entries(q.purposeByIndustry).map(([industry, step]) => (
              <StepEditor key={industry} label={`${industry} → 목적`} step={step}
                onChange={(s) => setQ({ purposeByIndustry: { ...q.purposeByIndustry, [industry]: s } })} />
            ))}

            <p className="text-[12px] font-bold text-[#1A1A2E] mt-2">업종 추가 질문 (업종 선택 후 표시)</p>
            {Object.entries(q.industryDetail).map(([key, step]) => (
              <StepEditor key={key} label={`${key} — 추가 질문`} step={step}
                onChange={(s) => setIndustryDetail(key, s)} />
            ))}

            <p className="text-[12px] font-bold text-[#1A1A2E] mt-2">목적 추가 질문 (목적 선택 후 표시)</p>
            {Object.entries(q.purposeDetail).map(([key, step]) => (
              <StepEditor key={key} label={`${key} — 추가 질문`} step={step}
                onChange={(s) => setPurposeDetail(key, s)} />
            ))}

            <div className="flex justify-end pt-2">
              <button onClick={() => handleSave("questions")} disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#000666] hover:bg-[#0010CC] px-4 py-2 rounded-[6px] disabled:opacity-60">
                <Save size={12} /> 질문 설정 저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
