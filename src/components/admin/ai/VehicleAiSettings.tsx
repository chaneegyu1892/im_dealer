"use client";

import { useState } from "react";
import { Search, Save, Plus, X, Sparkles } from "lucide-react";

interface RecommendationConfigEntry {
  id: string;
  highlights: string[];
  aiCaption: string | null;
  scoreMatrix: unknown;
  vehicle: { name: string; brand: string; category: string };
}

function toScoreMatrix(value: unknown): Record<string, Record<string, number>> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Record<string, number>>;
  }
  return null;
}

interface Props {
  initialConfigs: RecommendationConfigEntry[];
}

export default function VehicleAiSettings({ initialConfigs }: Props) {
  const [configs, setConfigs] = useState<RecommendationConfigEntry[]>(initialConfigs);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filtered = configs.filter((c) =>
    c.vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleUpdate = async (
    id: string,
    updatedData: {
      highlights: string[];
      aiCaption: string;
      scoreMatrix?: Record<string, Record<string, number>>;
    }
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updatedData }),
      });
      if (res.ok) {
        const result = await res.json();
        setConfigs(configs.map((c) => (c.id === id ? { ...c, ...result.data } : c)));
        setEditingId(null);
        alert("설정이 저장되었습니다.");
      } else {
        alert("저장 중 오류가 발생했습니다.");
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF2] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-[#E8EAF2] flex flex-wrap items-center gap-3 justify-between bg-[#F8F9FC]">
        <div className="relative flex-1 min-w-0 max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" size={14} />
          <input
            type="text"
            placeholder="차량명 또는 브랜드 검색..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8EAF2] rounded-xl text-xs focus:outline-none focus:border-[#6066EE]"
          />
        </div>
        <span className="text-[11px] text-[#9BA4C0]">총 {filtered.length}대 설정 가능</span>
      </div>

      {/* ── 모바일 카드 뷰 ── */}
      {paginatedItems.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#9BA4C0]">설정 가능한 차량이 없습니다.</div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-[#F0F1FA]">
            {paginatedItems.map((config) => (
              <div key={config.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#1A1A2E] truncate">{config.vehicle.name}</p>
                    <p className="text-[11px] text-[#9BA4C0] mt-0.5">{config.vehicle.brand} · {config.vehicle.category}</p>
                  </div>
                  <div className="shrink-0">
                    <SettingsMenu config={config} onUpdate={handleUpdate} saving={saving} />
                  </div>
                </div>
                {config.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {config.highlights.map((h: string, idx: number) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                        #{h}
                      </span>
                    ))}
                  </div>
                )}
                {config.aiCaption && (
                  <p className="text-[11px] text-[#5A6080] line-clamp-2">{config.aiCaption}</p>
                )}
                {!config.aiCaption && config.highlights.length === 0 && (
                  <p className="text-[11px] text-[#C0C5D8] italic">설정 없음 — 상세 설정을 통해 추가하세요</p>
                )}
              </div>
            ))}
          </div>

          {/* ── 데스크탑 테이블 뷰 ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-[#F8F9FC] text-[#9BA4C0] text-[11px] uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-semibold">차량 정보</th>
                  <th className="px-6 py-3 text-left font-semibold">AI 하이라이트 (Keywords)</th>
                  <th className="px-6 py-3 text-left font-semibold">AI 한줄 평 (Caption)</th>
                  <th className="px-6 py-3 text-right font-semibold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1FA]">
                {paginatedItems.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#1A1A2E]">{config.vehicle.name}</span>
                        <span className="text-[10px] text-[#9BA4C0]">{config.vehicle.brand} · {config.vehicle.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {config.highlights.map((h: string, idx: number) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            #{h}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-xs text-[#5A6080] truncate">{config.aiCaption || "-"}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <SettingsMenu config={config} onUpdate={handleUpdate} saving={saving} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 페이지네이션 컨트롤 */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[#F0F1FA] bg-[#F8F9FC] flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 px-2 text-xs font-semibold text-[#9BA4C0] hover:text-[#6066EE] disabled:opacity-30 disabled:hover:text-[#9BA4C0]"
          >
            이전
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
                  currentPage === page
                    ? "bg-[#6066EE] text-white shadow-sm"
                    : "text-[#9BA4C0] hover:bg-white hover:text-[#5A6080]"
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 px-2 text-xs font-semibold text-[#9BA4C0] hover:text-[#6066EE] disabled:opacity-30 disabled:hover:text-[#9BA4C0]"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

interface SettingsMenuProps {
  config: RecommendationConfigEntry;
  onUpdate: (id: string, data: {
    highlights: string[];
    aiCaption: string;
    scoreMatrix?: Record<string, Record<string, number>>;
  }) => Promise<void>;
  saving: boolean;
}

function SettingsMenu({ config, onUpdate, saving }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempHighlights, setTempHighlights] = useState<string[]>(config.highlights || []);
  const [tempCaption, setTempCaption] = useState(config.aiCaption || "");
  const [newTag, setNewTag] = useState("");
  const scoreMatrixValue = toScoreMatrix(config.scoreMatrix);
  const [scoreMatrixJson, setScoreMatrixJson] = useState<string>(
    scoreMatrixValue ? JSON.stringify(scoreMatrixValue, null, 2) : "{}"
  );
  const [scoreMatrixError, setScoreMatrixError] = useState<string | null>(null);

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)} className="text-xs font-bold text-[#6066EE] hover:underline">
      상세 설정
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div className="p-4 md:p-6 border-b border-[#F0F1FA] flex items-center justify-between bg-[#F8F9FC]">
          <div className="flex items-center gap-2 text-[#1A1A2E]">
            <Sparkles size={18} className="text-[#6066EE]" />
            <h3 className="text-base md:text-lg font-bold">AI 추천 상세 설정</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto max-h-[70vh] sm:max-h-[60vh]">
          <div>
            <p className="text-sm font-bold text-[#1A1A2E] mb-1">{config.vehicle.name}</p>
            <p className="text-xs text-[#9BA4C0]">{config.vehicle.brand} · {config.vehicle.category}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#1A1A2E] block mb-2">AI 하이라이트 (Keywords)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {tempHighlights.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
                    {tag}
                    <button onClick={() => setTempHighlights(tempHighlights.filter((_, idx) => idx !== i))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="예: 최강 경제성"
                  className="flex-1 px-3 py-2 border border-[#E8EAF2] rounded-xl text-xs focus:outline-none focus:border-[#6066EE]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (newTag.trim()) {
                        setTempHighlights([...tempHighlights, newTag.trim()]);
                        setNewTag("");
                      }
                    }
                  }}
                />
                <button
                  onClick={() => { if (newTag.trim()) { setTempHighlights([...tempHighlights, newTag.trim()]); setNewTag(""); } }}
                  className="p-2 bg-[#F0F1FA] text-[#6066EE] rounded-xl"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1A2E] block mb-2">AI 추천 사유 캡션</label>
              <textarea
                value={tempCaption}
                onChange={(e) => setTempCaption(e.target.value)}
                rows={3}
                placeholder="추천 엔진에서 사용자에게 보여줄 차량별 전용 코멘트입니다."
                className="w-full px-4 py-3 border border-[#E8EAF2] rounded-2xl text-xs focus:outline-none focus:border-[#6066EE] resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#1A1A2E] block mb-1">추천 점수 매트릭스 (JSON)</label>
              <p className="text-[10px] text-[#9BA4C0] mb-2">
                업종(industry) × 용도(purpose) 별 점수. 예: {`{ "IT": { "영업": 8, "배송": 3 } }`}
              </p>
              <textarea
                value={scoreMatrixJson}
                onChange={(e) => {
                  setScoreMatrixJson(e.target.value);
                  setScoreMatrixError(null);
                }}
                rows={6}
                placeholder={`{\n  "IT": { "영업": 8, "배송": 3 },\n  "금융": { "영업": 6 }\n}`}
                className={`w-full px-4 py-3 border rounded-2xl text-xs focus:outline-none resize-none font-mono ${
                  scoreMatrixError
                    ? "border-red-400 focus:border-red-500"
                    : "border-[#E8EAF2] focus:border-[#6066EE]"
                }`}
              />
              {scoreMatrixError && (
                <p className="mt-1 text-[10px] text-red-500">{scoreMatrixError}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 bg-[#F8F9FC] border-t border-[#F0F1FA] flex gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 py-3 text-sm font-bold text-[#9BA4C0] hover:text-[#5A6080] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              let parsedMatrix: Record<string, Record<string, number>> | undefined;
              try {
                const parsed: unknown = JSON.parse(scoreMatrixJson);
                parsedMatrix = parsed as Record<string, Record<string, number>>;
                setScoreMatrixError(null);
              } catch {
                setScoreMatrixError("올바른 JSON 형식이 아닙니다.");
                return;
              }
              onUpdate(config.id, {
                highlights: tempHighlights,
                aiCaption: tempCaption,
                scoreMatrix: parsedMatrix,
              });
            }}
            disabled={saving}
            className="flex-1 py-3 bg-[#000666] text-white rounded-2xl text-sm font-bold hover:bg-[#000888] transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
