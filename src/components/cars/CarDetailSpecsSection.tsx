"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasSpecDiagram,
  SPEC_TEXT_DESC,
  SpecDiagramModal,
} from "@/components/cars/SpecDiagram";
import type { VehicleDetailedSpecs } from "@/types/api";

const SPEC_KEY_LABEL: Record<string, string> = {
  engine: "엔진",
  displacement: "배기량",
  max_power: "최고출력",
  max_torque: "최대토크",
  fuel_efficiency: "연비 / 전비",
  range: "1회 충전 주행거리",
  length: "전장",
  width: "전폭",
  height: "전고",
  wheelbase: "휠베이스",
  front_suspension: "전륜 서스펜션",
  rear_suspension: "후륜 서스펜션",
  front_brake: "전륜 브레이크",
  rear_brake: "후륜 브레이크",
  steering: "스티어링",
  drag_coefficient: "공기저항계수",
  front_legroom: "앞좌석 레그룸",
  rear_legroom: "뒷좌석 레그룸",
  trunk_capacity: "트렁크 용량",
  frunk_capacity: "프렁크 용량",
  ground_clearance: "최저지상고",
  fuel_tank: "연료탱크",
  battery: "배터리 용량",
  charging: "충전 방식",
};

const TECH_SECTION_LABEL: Record<string, string> = {
  chassis: "섀시 & 제동",
  aerodynamics: "공력 성능",
  interior_dimensions: "실내 공간",
  capacities: "용량",
  electric_system: "전기 시스템",
};

interface SelectedSpec {
  key: string;
  label: string;
  value: string;
}

function engineVariantLabel(key: string): string {
  if (key === "dimensions") return "";
  return key
    .replace("gasoline_", "가솔린 ")
    .replace("hybrid_", "하이브리드 ")
    .replace("long_range_2wd", "롱레인지 2WD")
    .replace("long_range_awd", "롱레인지 AWD")
    .replace("_turbo", "T")
    .replace(/_/g, " ")
    .trim();
}

function SpecCard({
  specKey,
  label,
  value,
  highlight = false,
  onSelect,
}: {
  specKey: string;
  label: string;
  value: string;
  highlight?: boolean;
  onSelect: (spec: SelectedSpec) => void;
}) {
  const clickable = hasSpecDiagram(specKey) || !!SPEC_TEXT_DESC[specKey];

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect({ key: specKey, label, value })}
      className={cn(
        "min-h-[86px] rounded-[16px] border p-3.5 text-left transition-all duration-150",
        highlight
          ? "border-brand bg-brand-soft"
          : "border-line bg-surface-muted",
        clickable
          ? "cursor-pointer hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
          : "cursor-default",
      )}
    >
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-ink-label">{label}</span>
        {clickable && <Info size={12} className="shrink-0 text-ink-caption" />}
      </span>
      <span className={cn("block text-[15px] font-extrabold", highlight ? "text-brand" : "text-ink")}>
        {value}
      </span>
    </button>
  );
}

function SpecsGrid({
  title,
  entries,
  highlightKey,
  onSelect,
}: {
  title: string;
  entries: Record<string, unknown>;
  highlightKey?: string;
  onSelect: (spec: SelectedSpec) => void;
}) {
  return (
    <div>
      <p className="t-kick mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {Object.entries(entries).map(([key, value]) => (
          <SpecCard
            key={key}
            specKey={key}
            label={SPEC_KEY_LABEL[key] ?? key}
            value={String(value)}
            highlight={key === highlightKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function CarDetailSpecsSection({
  specs,
  category,
}: {
  specs: VehicleDetailedSpecs;
  category?: string;
}) {
  const [activeEngine, setActiveEngine] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<SelectedSpec | null>(null);
  const engineVariants = Object.keys(specs.specs ?? {})
    .filter((key) => key !== "dimensions")
    .sort((a, b) => {
      const order = (key: string) =>
        key.startsWith("gasoline") ? 0 : key.startsWith("hybrid") ? 1 : 2;
      return order(a) - order(b);
    });
  const currentEngine = activeEngine || engineVariants[0] || "";
  const currentEngineSpecs = currentEngine ? specs.specs?.[currentEngine] : null;

  return (
    <>
      <AnimatePresence>
        {selectedSpec && (
          <SpecDiagramModal
            specKey={selectedSpec.key}
            label={selectedSpec.label}
            value={selectedSpec.value}
            category={category}
            onClose={() => setSelectedSpec(null)}
          />
        )}
      </AnimatePresence>

      <motion.section
        initial={false}
        className="t-card overflow-hidden shadow-soft"
      >
        <div className="flex items-center gap-2.5 border-b border-line bg-surface-muted px-5 py-4 md:px-6">
          <span className="t-iconbtn h-8 w-8 bg-brand-soft text-brand">
            <Settings2 size={15} />
          </span>
          <p className="text-[15px] font-extrabold text-ink">상세 제원</p>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-label">
            <Info size={11} />
            클릭 시 설명
          </span>
        </div>

        <div className="space-y-7 px-5 py-5 md:px-6">
          {engineVariants.length > 0 && currentEngineSpecs && (
            <div>
              <p className="t-kick mb-3">엔진 제원</p>
              {engineVariants.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {engineVariants.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveEngine(key)}
                      className={cn("chip !px-3.5 !py-2 !text-[12.5px]", currentEngine === key && "chip-on")}
                    >
                      {engineVariantLabel(key)}
                    </button>
                  ))}
                </div>
              )}
              <SpecsGrid title="" entries={currentEngineSpecs} onSelect={setSelectedSpec} />
            </div>
          )}

          {specs.specs?.dimensions && (
            <SpecsGrid
              title="차체 치수"
              entries={specs.specs.dimensions}
              highlightKey="wheelbase"
              onSelect={setSelectedSpec}
            />
          )}

          {specs.technical_specs &&
            Object.entries(specs.technical_specs).map(([sectionKey, sectionData]) =>
              sectionData && Object.keys(sectionData).length > 0 ? (
                <SpecsGrid
                  key={sectionKey}
                  title={TECH_SECTION_LABEL[sectionKey] ?? sectionKey}
                  entries={sectionData}
                  onSelect={setSelectedSpec}
                />
              ) : null,
            )}
        </div>
      </motion.section>
    </>
  );
}
