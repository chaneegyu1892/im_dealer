"use client";

import { useMemo, useState } from "react";
import { Search, Settings2 } from "lucide-react";
import type { OperationalEligibilityStatus } from "@/lib/recommend/operational-eligibility";
import type { VehicleAiConfigDto } from "@/types/admin-ai";
import ProfileEditor, { type SavedProfileState } from "./ProfileEditor";

interface Props { readonly initialConfigs: VehicleAiConfigDto[] }
type ConfigFilter = "all" | "missing" | "valid" | "migration";
type MileageFilter = "all" | "10000" | "20000" | "30000";

const statusLabel: Record<OperationalEligibilityStatus, string> = {
  excluded_vehicle_class: "제외",
  hidden: "숨김",
  no_profile: "설정 없음",
  inactive_profile: "비활성",
  invalid_profile: "설정 오류",
  no_visible_latest_trim: "최신 트림 없음",
  no_valid_active_rate: "요율 없음",
  non_positive_quote: "견적 불가",
  eligible: "운영 가능",
};
const inactiveCoverage: VehicleAiConfigDto["coverage"] = {
  "10000": "inactive_profile",
  "20000": "inactive_profile",
  "30000": "inactive_profile",
};
const mileageKeys: readonly (keyof VehicleAiConfigDto["coverage"])[] = ["10000", "20000", "30000"];

function coverageTone(status: OperationalEligibilityStatus): string {
  if (status === "eligible") return "bg-emerald-50 text-emerald-700";
  if (status === "excluded_vehicle_class" || status === "invalid_profile") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
}

export default function VehicleAiSettings({ initialConfigs }: Props) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, SavedProfileState>>(() => new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [configFilter, setConfigFilter] = useState<ConfigFilter>("all");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [exclusionFilter, setExclusionFilter] = useState("all");
  const [mileageFilter, setMileageFilter] = useState<MileageFilter>("all");

  const rows = useMemo<VehicleAiConfigDto[]>(() => initialConfigs.map((row) => {
    const state = overrides.get(row.vehicle.id);
    if (!state) return row;
    return {
      ...row,
      profileState: state.profileState,
      fuelGroup: state.fuelGroup,
      config: {
        id: state.id,
        profile: state.profile,
        isActive: state.isActive,
        highlights: state.highlights,
        aiCaption: state.aiCaption,
        updatedAt: state.updatedAt,
      },
      coverage: state.isActive ? row.coverage : inactiveCoverage,
    };
  }), [initialConfigs, overrides]);
  const filtered = useMemo(() => rows.filter((row) => {
    const text = `${row.vehicle.name} ${row.vehicle.brand} ${row.vehicle.slug}`.toLowerCase();
    if (!text.includes(search.toLowerCase())) return false;
    if (configFilter === "missing" && row.profileState !== "missing") return false;
    if (configFilter === "valid" && row.profileState !== "valid") return false;
    if (configFilter === "migration" && row.profileState !== "legacy" && row.profileState !== "invalid") return false;
    if (fuelFilter !== "all" && row.fuelGroup !== fuelFilter) return false;
    if (visibilityFilter === "visible" && !row.vehicle.isVisible) return false;
    if (visibilityFilter === "hidden" && row.vehicle.isVisible) return false;
    if (exclusionFilter === "excluded" && row.exclusion === null) return false;
    if (exclusionFilter === "included" && row.exclusion !== null) return false;
    if (mileageFilter !== "all" && row.coverage[mileageFilter] !== "eligible") return false;
    return true;
  }), [configFilter, exclusionFilter, fuelFilter, mileageFilter, rows, search, visibilityFilter]);

  const editingRow = rows.find((row) => row.vehicle.id === editingId) ?? null;
  const handleSaved = (vehicleId: string, state: SavedProfileState) => {
    setOverrides((current) => new Map(current).set(vehicleId, state));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8EAF2] bg-white shadow-sm">
      <div className="space-y-3 border-b border-[#E8EAF2] bg-[#F8F9FC] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <span className="sr-only">차량 검색</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="차량명, 브랜드, slug 검색" className="w-full rounded-xl border border-[#E8EAF2] bg-white py-2 pl-9 pr-3 text-xs focus:border-[#6066EE] focus:outline-none" />
          </label>
          <span className="text-xs text-[#9BA4C0]">{filtered.length} / {rows.length}대</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Filter label="설정 상태" value={configFilter} onChange={(value) => setConfigFilter(value === "missing" || value === "valid" || value === "migration" ? value : "all")} options={["all:전체", "missing:설정 없음", "valid:v2 정상", "migration:이전/오류"]} />
          <Filter label="연료" value={fuelFilter} onChange={setFuelFilter} options={["all:전체 연료", "ICE:ICE", "HEV:HEV", "EV:EV"]} />
          <Filter label="노출" value={visibilityFilter} onChange={setVisibilityFilter} options={["all:전체", "visible:노출", "hidden:숨김"]} />
          <Filter label="제외" value={exclusionFilter} onChange={setExclusionFilter} options={["all:전체", "included:추천 대상", "excluded:제외 차량"]} />
          <Filter label="요율 커버리지" value={mileageFilter} onChange={(value) => setMileageFilter(value === "10000" || value === "20000" || value === "30000" ? value : "all")} options={["all:전체", "10000:1만km 가능", "20000:2만km 가능", "30000:3만km 가능"]} />
        </div>
      </div>

      {filtered.length === 0 ? <p className="p-12 text-center text-sm text-[#9BA4C0]">조건에 맞는 차량이 없습니다.</p> : (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <article key={row.vehicle.id} className="rounded-2xl border border-[#E8EAF2] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[#1A1A2E]">{row.vehicle.name}</h3>
                  <p className="mt-1 truncate text-[11px] text-[#9BA4C0]">{row.vehicle.brand} · {row.vehicle.category} · {row.vehicle.slug}</p>
                </div>
                <button onClick={() => setEditingId(row.vehicle.id)} className="flex shrink-0 items-center gap-1 rounded-lg bg-[#F0F1FA] px-2 py-1.5 text-[11px] font-bold text-[#6066EE]"><Settings2 size={13} />설정</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge text={row.profileState === "valid" ? `${row.fuelGroup} v2` : row.profileState === "missing" ? "설정 없음" : "마이그레이션 필요"} tone={row.profileState === "valid" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"} />
                <Badge text={row.vehicle.isVisible ? "노출" : "숨김"} tone={row.vehicle.isVisible ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-500"} />
                {row.exclusion && <Badge text="추천 제외" tone="bg-red-50 text-red-700" />}
                {row.config && <Badge text={row.config.isActive ? "활성" : "비활성"} tone={row.config.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"} />}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {mileageKeys.map((mileage) => <span key={mileage} title={statusLabel[row.coverage[mileage]]} className={`rounded-lg px-2 py-1 text-center text-[10px] font-semibold ${coverageTone(row.coverage[mileage])}`}>{Number(mileage) / 10000}만 · {statusLabel[row.coverage[mileage]]}</span>)}
              </div>
            </article>
          ))}
        </div>
      )}
      {editingRow && <ProfileEditor row={editingRow} onClose={() => setEditingId(null)} onSaved={handleSaved} />}
    </div>
  );
}

function Badge({ text, tone }: { readonly text: string; readonly tone: string }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{text}</span>;
}

function Filter({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (value: string) => void }) {
  return <label className="text-[10px] font-bold text-[#5A6080]">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[#E8EAF2] bg-white px-2 py-2 text-xs font-normal focus:border-[#6066EE] focus:outline-none">{options.map((option) => { const separator = option.indexOf(":"); const valuePart = option.slice(0, separator); return <option key={valuePart} value={valuePart}>{option.slice(separator + 1)}</option>; })}</select></label>;
}
