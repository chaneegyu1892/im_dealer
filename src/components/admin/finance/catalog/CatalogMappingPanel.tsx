"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface VehicleLite {
  id: string;
  brand: string;
  name: string;
}
interface Props {
  financeCompanyId: string;
  productType: string;
  vehicles: VehicleLite[];
}

interface CatalogTrimLite {
  id: string;
  brandName?: string;
  modelName?: string;
  trimName: string;
  modelYear: string | null;
  vehiclePrice: number;
}
interface MappingRow {
  trimId: string;
  trimName: string;
  price: number;
  mapping: {
    id: string;
    source: string;
    confidence: string | null;
    externalLabel: string;
    catalogTrim: CatalogTrimLite;
    newerYearAvailable: boolean;
  } | null;
}
interface Suggestion {
  catalogTrimId: string;
  label: string;
  vehiclePrice: number;
  confidence: "exact" | "fuzzy";
}

function weekOfMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

/** 우리 트림 ↔ 카탈로그 매핑 + 정확값 시트 반영. */
export default function CatalogMappingPanel({ financeCompanyId, productType, vehicles }: Props) {
  const brands = useMemo(() => Array.from(new Set(vehicles.map((v) => v.brand))).sort(), [vehicles]);
  const [brand, setBrand] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | null>>({});
  const [suggestWarning, setSuggestWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  // 수동 검색 (트림 행 단위)
  const [searchRow, setSearchRow] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogTrimLite[]>([]);
  // 반영
  const [applySel, setApplySel] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const brandVehicles = useMemo(() => vehicles.filter((v) => v.brand === brand), [vehicles, brand]);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    setApplyResult(null);
    try {
      const d = await (
        await fetch(
          `/api/admin/capital-catalog/mappings?financeCompanyId=${financeCompanyId}&vehicleId=${vehicleId}&productType=${encodeURIComponent(productType)}`
        )
      ).json();
      const rs: MappingRow[] = d.trims ?? [];
      setRows(rs);
      setApplySel(new Set(rs.filter((r) => r.mapping).map((r) => r.trimId)));
    } finally {
      setLoading(false);
    }
  }, [financeCompanyId, vehicleId, productType]);

  useEffect(() => {
    setRows([]);
    setSuggestions({});
    setSuggestWarning(null);
    setSearchRow(null);
    void load();
  }, [load]);

  const suggest = async () => {
    setSuggesting(true);
    setSuggestWarning(null);
    try {
      const d = await (
        await fetch("/api/admin/capital-catalog/mappings/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ financeCompanyId, vehicleId, productType }),
        })
      ).json();
      if (d.warning) setSuggestWarning(d.warning);
      const map: Record<string, Suggestion | null> = {};
      for (const s of d.suggestions ?? []) map[s.trimId] = s.suggestion;
      setSuggestions(map);
    } finally {
      setSuggesting(false);
    }
  };

  const saveMapping = async (trimId: string, catalogTrimId: string, source: "auto" | "manual", confidence?: string) => {
    const res = await fetch("/api/admin/capital-catalog/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ financeCompanyId, trimId, productType, catalogTrimId, source, confidence: confidence ?? null }),
    });
    if (res.ok) {
      setSuggestions((prev) => ({ ...prev, [trimId]: null }));
      await load();
    }
  };

  const adoptAll = async () => {
    for (const [trimId, s] of Object.entries(suggestions)) {
      if (s) await saveMapping(trimId, s.catalogTrimId, "auto", s.confidence);
    }
  };

  const removeMapping = async (mappingId: string) => {
    await fetch(`/api/admin/capital-catalog/mappings?id=${mappingId}`, { method: "DELETE" });
    await load();
  };

  const runSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const d = await (
      await fetch(
        `/api/admin/capital-catalog?financeCompanyId=${financeCompanyId}&productType=${encodeURIComponent(productType)}&q=${encodeURIComponent(q)}`
      )
    ).json();
    setSearchResults(d.trims ?? []);
  };

  const apply = async () => {
    const trimIds = Array.from(applySel);
    if (trimIds.length === 0) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/admin/capital-rates/apply-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financeCompanyId, productType, weekOf: weekOfMonday(), trimIds }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setApplyResult(`❌ ${d.error ?? "반영 실패"}`);
      else
        setApplyResult(
          `✅ 트림 ${d.applied}개 정확값 시트 반영 완료${(d.warnings ?? []).length ? ` · 건너뜀 ${d.warnings.length}건` : ""} — 회수율 데이터 관리 탭에서 확인 가능`
        );
    } finally {
      setApplying(false);
    }
  };

  const hasSuggestions = Object.values(suggestions).some(Boolean);
  const mappedCount = rows.filter((r) => r.mapping).length;

  const confBadge = (m: MappingRow["mapping"]) => {
    if (!m) return null;
    const label = m.source === "manual" ? "수동" : m.confidence === "exact" ? "자동·정확" : "자동·유사";
    const cls =
      m.source === "manual"
        ? "bg-indigo-50 text-indigo-600"
        : m.confidence === "exact"
          ? "bg-emerald-50 text-emerald-600"
          : "bg-amber-50 text-amber-600";
    return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-4 flex flex-col gap-3">
      {/* 차량 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={brand} onChange={(e) => { setBrand(e.target.value); setVehicleId(""); }} className="rounded-lg border border-[#D7DBF0] px-3 py-2 text-sm">
          <option value="">브랜드 선택…</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={!brand} className="rounded-lg border border-[#D7DBF0] px-3 py-2 text-sm min-w-48">
          <option value="">차량 선택…</option>
          {brandVehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        {vehicleId && (
          <>
            <button
              type="button"
              onClick={() => void suggest()}
              disabled={suggesting || loading}
              className="rounded-lg bg-[#6066EE] px-3 py-2 text-xs font-bold text-white hover:bg-[#4F55D8] disabled:opacity-40"
            >
              {suggesting ? "분석 중…" : "자동 매핑 제안"}
            </button>
            {hasSuggestions && (
              <button type="button" onClick={() => void adoptAll()} className="rounded-lg border border-[#6066EE] px-3 py-2 text-xs font-bold text-[#6066EE] hover:bg-[#F0F1FA]">
                제안 전체 채택
              </button>
            )}
            <span className="text-xs text-[#9BA4C0]">매핑 {mappedCount}/{rows.length}</span>
          </>
        )}
      </div>
      {suggestWarning && <p className="text-xs text-amber-600">{suggestWarning}</p>}

      {/* 트림 리스트 */}
      {vehicleId && (
        <div className="rounded-lg border border-[#E8EAF2] divide-y divide-[#F0F1FA]">
          {loading ? (
            <p className="py-8 text-center text-sm text-[#9BA4C0]">로딩 중…</p>
          ) : (
            rows.map((r) => {
              const s = suggestions[r.trimId];
              const mapping = r.mapping;
              return (
                <div key={r.trimId} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applySel.has(r.trimId)}
                      disabled={!mapping}
                      onChange={() =>
                        setApplySel((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.trimId)) next.delete(r.trimId);
                          else next.add(r.trimId);
                          return next;
                        })
                      }
                      className="h-3.5 w-3.5 accent-[#6066EE]"
                    />
                    <span className="font-medium text-[#1A1A2E]">{r.trimName}</span>
                    <span className="text-xs text-[#9BA4C0]">{r.price.toLocaleString()}원</span>
                    {confBadge(mapping)}
                    {mapping?.newerYearAvailable && (
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600" title="카탈로그에 더 최신 연식이 있습니다 — 자동 제안으로 재매핑을 검토하세요">
                        새 연식 후보
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {mapping ? (
                        <>
                          <span className="text-xs text-[#5A6080]">
                            → {mapping.externalLabel} <span className="text-[#9BA4C0]">({mapping.catalogTrim.vehiclePrice.toLocaleString()}원)</span>
                          </span>
                          <button type="button" onClick={() => void removeMapping(mapping.id)} className="text-[11px] text-[#C0392B] hover:underline">
                            해제
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-[#C9CEEA]">미매핑</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSearchRow(searchRow === r.trimId ? null : r.trimId);
                          setSearchQ("");
                          setSearchResults([]);
                        }}
                        className="text-[11px] text-[#6066EE] hover:underline"
                      >
                        수동 검색
                      </button>
                    </div>
                  </div>

                  {/* 자동 제안 미리보기 */}
                  {s && (
                    <div className="mt-1.5 ml-6 flex flex-wrap items-center gap-2 rounded-lg bg-[#F8F9FC] px-2.5 py-1.5 text-xs">
                      <span className="text-[#5A6080]">
                        제안: <b>{s.label}</b> ({s.vehiclePrice.toLocaleString()}원 · {s.confidence === "exact" ? "정확" : "유사"})
                      </span>
                      <button type="button" onClick={() => void saveMapping(r.trimId, s.catalogTrimId, "auto", s.confidence)} className="rounded bg-[#6066EE] px-2 py-1 text-[11px] font-bold text-white">
                        채택
                      </button>
                    </div>
                  )}

                  {/* 수동 검색 콤보 */}
                  {searchRow === r.trimId && (
                    <div className="mt-1.5 ml-6">
                      <input
                        type="text"
                        value={searchQ}
                        onChange={(e) => void runSearch(e.target.value)}
                        placeholder="카탈로그 트림명/모델명 검색 (2자 이상)…"
                        autoFocus
                        className="w-full max-w-md rounded-lg border border-[#E8EAF2] px-3 py-1.5 text-xs focus:border-[#6066EE] focus:outline-none"
                      />
                      {searchResults.length > 0 && (
                        <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-[#E8EAF2] divide-y divide-[#F0F1FA]">
                          {searchResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                void saveMapping(r.trimId, c.id, "manual");
                                setSearchRow(null);
                              }}
                              className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-[#F0F1FA]"
                            >
                              <b>{c.modelName}</b> {c.trimName}
                              {c.modelYear ? ` [${c.modelYear}]` : ""} · {c.vehiclePrice.toLocaleString()}원
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 견적 반영 */}
      {vehicleId && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E8EAF2] bg-[#F8F9FC] px-3 py-2.5">
          <button
            type="button"
            onClick={() => void apply()}
            disabled={applying || applySel.size === 0}
            className="rounded-lg bg-[#000666] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {applying ? "반영 중…" : `견적 반영 (${applySel.size}개 트림)`}
          </button>
          <span className="text-[11px] text-[#9BA4C0]">
            매핑된 카탈로그 값으로 트림별 정확값 회수율 시트를 생성합니다 (min=max, 이번 주 기준 · 기존 활성 시트는 이력으로 보존)
          </span>
          {applyResult && <span className="text-xs font-semibold text-[#1A1A2E]">{applyResult}</span>}
        </div>
      )}
    </div>
  );
}
