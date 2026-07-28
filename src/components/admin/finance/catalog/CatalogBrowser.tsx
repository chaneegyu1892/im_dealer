"use client";

import { useCallback, useEffect, useState } from "react";
import { RATE_KEYS } from "@/lib/quote-calculator";
import type { RateSheetRaw } from "@/types/admin";

interface Props {
  financeCompanyId: string;
  productType: string;
}

interface BrandRow {
  brandCd: string;
  brandName: string;
  trimCount: number;
  lastScrapedAt: string | null;
}
interface ModelRow {
  modelCd: string;
  modelName: string;
  trimCount: number;
  lastScrapedAt: string | null;
}
interface TrimRow {
  id: string;
  dtMdlName: string | null;
  mdelCd: string;
  trimName: string;
  modelYear: string | null;
  vehiclePrice: number;
  baseRates: RateSheetRaw;
  depositRate36_10000: number | null;
  prepayRate36_10000: number | null;
  scrapedAt: string;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("ko-KR") : "-");
const fmtWon = (n: number | null | undefined) => (n && n > 0 ? n.toLocaleString() : "-");

// 월납입금 매트릭스 축 (RATE_KEYS = `${기간}_${거리}`)
const PERIODS = [36, 48, 60] as const; // 계약기간(개월)
const DISTANCES = [10000, 20000, 30000] as const; // 연간주행거리(km)

/**
 * 수집된 카탈로그 열람 — 좌측 브랜드→모델 트리(상시 표시) + 우측 선택 모델 트림 상세.
 * 월납입금 9칸 + 36개월/1만km 보증금10%·선납금10% 추가 표시.
 */
export default function CatalogBrowser({ financeCompanyId, productType }: Props) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [modelsByBrand, setModelsByBrand] = useState<Record<string, ModelRow[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ brand: BrandRow; model: ModelRow } | null>(null);
  const [trims, setTrims] = useState<TrimRow[]>([]);
  const [search, setSearch] = useState("");
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState<string | null>(null);
  const [loadingTrims, setLoadingTrims] = useState(false);

  const base = `/api/admin/capital-catalog?financeCompanyId=${financeCompanyId}&productType=${encodeURIComponent(productType)}`;

  const loadBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const d = await (await fetch(base)).json();
      setBrands(d.brands ?? []);
    } finally {
      setLoadingBrands(false);
    }
  }, [base]);

  useEffect(() => {
    setExpanded(null);
    setSelected(null);
    setTrims([]);
    setModelsByBrand({});
    setSearch("");
    void loadBrands();
  }, [loadBrands]);

  const toggleBrand = async (b: BrandRow) => {
    if (expanded === b.brandCd) {
      setExpanded(null);
      return;
    }
    setExpanded(b.brandCd);
    if (!modelsByBrand[b.brandCd]) {
      setLoadingModels(b.brandCd);
      try {
        const d = await (await fetch(`${base}&brandCd=${b.brandCd}`)).json();
        setModelsByBrand((prev) => ({ ...prev, [b.brandCd]: d.models ?? [] }));
      } finally {
        setLoadingModels(null);
      }
    }
  };

  const openModel = async (brand: BrandRow, m: ModelRow) => {
    setSelected({ brand, model: m });
    setSearch("");
    setLoadingTrims(true);
    try {
      const d = await (await fetch(`${base}&brandCd=${brand.brandCd}&modelCd=${encodeURIComponent(m.modelCd)}`)).json();
      setTrims(d.trims ?? []);
    } finally {
      setLoadingTrims(false);
    }
  };

  const visibleTrims = search ? trims.filter((t) => t.trimName.toLowerCase().includes(search.toLowerCase())) : trims;

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:h-[560px]">
        {/* ── 좌측: 브랜드 → 모델 트리 ── */}
        <aside className="w-full md:w-72 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-[#E8EAF0] flex flex-col">
          <div className="px-3 py-2.5 border-b border-[#F0F1FA] flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1A2E]">브랜드 · 모델</span>
            {loadingBrands && <span className="text-[11px] text-[#9BA4C0]">로딩…</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {brands.length === 0 && !loadingBrands ? (
              <p className="px-2 py-8 text-center text-xs text-[#9BA4C0]">
                수집된 카탈로그가 없습니다.
                <br />
                「카탈로그 수집」 탭에서 브랜드를 수집하세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {brands.map((b) => {
                  const isOpen = expanded === b.brandCd;
                  const models = modelsByBrand[b.brandCd] ?? [];
                  return (
                    <li key={b.brandCd}>
                      <button
                        type="button"
                        onClick={() => void toggleBrand(b)}
                        className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-[#F8F9FC] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`text-[10px] text-[#9BA4C0] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                          <span className="text-sm font-bold text-[#1A1A2E]">{b.brandName}</span>
                        </span>
                        <span className="text-[11px] text-[#9BA4C0]">{b.trimCount}</span>
                      </button>
                      {isOpen && (
                        <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-[#F0F1FA] pl-2">
                          {loadingModels === b.brandCd && <li className="px-2 py-1.5 text-[11px] text-[#9BA4C0]">모델 로딩…</li>}
                          {models.map((m) => {
                            const active = selected?.model.modelCd === m.modelCd && selected?.brand.brandCd === b.brandCd;
                            return (
                              <li key={m.modelCd}>
                                <button
                                  type="button"
                                  onClick={() => void openModel(b, m)}
                                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                                    active ? "bg-[#EEF0FE] text-[#4F55D8]" : "hover:bg-[#F8F9FC] text-[#5A6080]"
                                  }`}
                                >
                                  <span className={`text-[13px] ${active ? "font-bold" : "font-medium"}`}>{m.modelName}</span>
                                  <span className="text-[11px] text-[#9BA4C0]">{m.trimCount}</span>
                                </button>
                              </li>
                            );
                          })}
                          {!loadingModels && models.length === 0 && (
                            <li className="px-2 py-1.5 text-[11px] text-[#9BA4C0]">모델 없음</li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── 우측: 선택 모델 트림 상세 ── */}
        <section className="flex-1 min-w-0 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-center text-sm text-[#9BA4C0]">
                왼쪽에서 브랜드를 펼쳐 모델을 선택하면
                <br />
                트림별 월납입금·보증금·선납금을 볼 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-[#F0F1FA] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-bold text-[#1A1A2E]">{selected.brand.brandName}</span>
                <span className="text-[#C9CEEA]">/</span>
                <span className="text-sm font-bold text-[#1A1A2E]">{selected.model.modelName}</span>
                <span className="text-xs text-[#9BA4C0]">트림 {selected.model.trimCount}개 · {fmtDate(selected.model.lastScrapedAt)}</span>
                {loadingTrims && <span className="text-[11px] text-[#9BA4C0]">로딩…</span>}
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="트림명 검색…"
                  className="ml-auto w-40 rounded-lg border border-[#E8EAF2] px-3 py-1 text-xs focus:border-[#6066EE] focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs whitespace-nowrap tabular-nums border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    {/* 1단: 그룹(계약기간 / 보증·선납) */}
                    <tr className="bg-[#F8F9FC] text-[#9BA4C0]">
                      <th rowSpan={2} className="px-3 py-2 text-left font-semibold sticky left-0 bg-[#F8F9FC] border-b border-[#E8EAF2] align-bottom">트림</th>
                      <th rowSpan={2} className="px-2 py-2 text-right font-semibold border-b border-[#E8EAF2] align-bottom">연식</th>
                      <th rowSpan={2} className="px-2 py-2 text-right font-semibold border-b border-[#E8EAF2] align-bottom">차량가</th>
                      {PERIODS.map((p) => (
                        <th key={p} colSpan={DISTANCES.length} className="px-2 py-1.5 text-center font-bold text-[#5A6080] border-l border-[#E8EAF2]">
                          {p}개월
                        </th>
                      ))}
                      <th rowSpan={2} className="px-2 py-1.5 text-right font-bold bg-[#EEF0FE] text-[#4F55D8] border-l border-[#E8EAF2] border-b align-bottom">
                        보증금10%<br /><span className="font-normal text-[10px]">36개월·1만</span>
                      </th>
                      <th rowSpan={2} className="px-2 py-1.5 text-right font-bold bg-[#EFF7EE] text-[#3E8E4E] border-b align-bottom">
                        선납금10%<br /><span className="font-normal text-[10px]">36개월·1만</span>
                      </th>
                      <th rowSpan={2} className="px-2 py-2 text-right font-semibold border-l border-[#E8EAF2] border-b align-bottom">수집일</th>
                    </tr>
                    {/* 2단: 연간주행거리 */}
                    <tr className="bg-[#F8F9FC] text-[#9BA4C0]">
                      {PERIODS.map((p) =>
                        DISTANCES.map((d, di) => (
                          <th
                            key={`${p}_${d}`}
                            className={`px-2 pb-2 text-right font-medium text-[10px] border-b border-[#E8EAF2] ${di === 0 ? "border-l" : ""}`}
                          >
                            {d / 10000}만km
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrims.map((t) => (
                      <tr key={t.id} className="hover:bg-[#F8F9FC] border-b border-[#F0F1FA]">
                        <td className="px-3 py-1.5 font-medium text-[#1A1A2E] sticky left-0 bg-white border-b border-[#F0F1FA]">{t.trimName}</td>
                        <td className="px-2 py-1.5 text-right text-[#5A6080] border-b border-[#F0F1FA]">{t.modelYear ?? "-"}</td>
                        <td className="px-2 py-1.5 text-right text-[#5A6080] border-b border-[#F0F1FA]">{t.vehiclePrice.toLocaleString()}</td>
                        {PERIODS.map((p) =>
                          DISTANCES.map((d, di) => {
                            const v = t.baseRates?.[`${p}_${d}` as keyof RateSheetRaw] ?? 0;
                            return (
                              <td
                                key={`${p}_${d}`}
                                className={`px-2 py-1.5 text-right border-b border-[#F0F1FA] ${di === 0 ? "border-l border-[#F0F1FA]" : ""} ${v > 0 ? "text-[#1A1A2E]" : "text-red-400 font-semibold"}`}
                              >
                                {fmtWon(v)}
                              </td>
                            );
                          })
                        )}
                        <td className={`px-2 py-1.5 text-right bg-[#F6F7FF] border-l border-b border-[#F0F1FA] ${t.depositRate36_10000 ? "text-[#4F55D8] font-semibold" : "text-[#C9CEEA]"}`}>
                          {fmtWon(t.depositRate36_10000)}
                        </td>
                        <td className={`px-2 py-1.5 text-right bg-[#F5FBF4] border-b border-[#F0F1FA] ${t.prepayRate36_10000 ? "text-[#3E8E4E] font-semibold" : "text-[#C9CEEA]"}`}>
                          {fmtWon(t.prepayRate36_10000)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[#9BA4C0] border-l border-b border-[#F0F1FA]">{fmtDate(t.scrapedAt)}</td>
                      </tr>
                    ))}
                    {!loadingTrims && visibleTrims.length === 0 && (
                      <tr>
                        <td colSpan={RATE_KEYS.length + 6} className="px-3 py-8 text-center text-[#9BA4C0]">
                          {search ? "검색 결과 없음" : "트림 없음"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-1.5 text-[11px] text-[#B0B8D0] border-t border-[#F0F1FA]">
                월납입금(원) = 계약기간/연간주행거리별 · 붉은 &quot;-&quot; = 미산출 · 보증10%·선납10%는 36개월/1만km 기준(구 데이터는 미수집)
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
