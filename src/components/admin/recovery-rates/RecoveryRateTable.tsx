"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { 
  Search, Filter, ChevronDown, ChevronRight, 
  Edit3, Save, MoreHorizontal, 
  Car, Calendar, Gauge, CheckSquare, Square
} from "lucide-react";
import { 
  RecoveryRateItem, 
  VintageRange, 
  MileageRange 
} from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Fragment } from "react";

interface RecoveryRateTableProps {
  data: RecoveryRateItem[];
  onUpdateRate: (id: string, field: string, value: number) => void;
  currentBrand: string;
}

export function RecoveryRateTable({ data, onUpdateRate, currentBrand }: RecoveryRateTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 상세 필터 팝오버 메뉴 상태
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // 카테고리 셋은 전체 데이터 기준
  const availableCategories = useMemo(
    () => Array.from(new Set(data.map(d => d.category))),
    [data],
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(availableCategories));

  // Inline editing state: { id, field, value }
  const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);

  // 필터 적용 (검색 + 카테고리 필터)
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.vehicleName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategories.has(item.category);
      return matchesSearch && matchesCategory;
    });
  }, [data, searchTerm, selectedCategories]);

  // 외부 클릭 시 필터 팝오버 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current && !filterRef.current.contains(event.target as Node) &&
        filterButtonRef.current && !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCellClick = (id: string, field: string, value: number) => {
    setEditingCell({ id, field, value: value.toString() });
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      onUpdateRate(editingCell.id, editingCell.field, Number(editingCell.value));
      setEditingCell(null);
    }
  };

  const handleToggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d.id)));
    }
  };

  const handleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[16px] border border-[#E8EAF0] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
      {/* ── 상단 컨트롤 바 ── */}
      <div className="px-5 py-3 border-b border-[#F0F2F8] bg-[#FAFBFF] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Car size={16} className="text-[#000666]" />
            <h2 className="text-[14px] font-bold text-[#1A1A2E]">{currentBrand} 회수율 목록</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-[#E5E5FA] text-[#000666] font-semibold font-mono">
              {filteredData.length}건
            </span>
          </div>
          <div className="w-px h-4 bg-[#D4D8EC] mx-2" />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text"
              placeholder="차종명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[220px] h-9 pl-9 pr-3 bg-white border border-[#E8EAF0] rounded-[6px] text-[13px] placeholder:text-[#9BA4C0] focus:ring-1 focus:ring-[#000666] outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <button 
            ref={filterButtonRef}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
               "flex items-center gap-2 px-3 h-9 border rounded-[6px] text-[12px] font-semibold transition-colors shadow-sm",
               isFilterOpen || selectedCategories.size < availableCategories.length 
                 ? "bg-[#F4F5F8] border-[#D4D8EC] text-[#1A1A2E]" 
                 : "bg-white border-[#E8EAF0] text-[#4A5270] hover:bg-[#FAFBFF]"
            )}
          >
            <Filter size={14} className={cn(selectedCategories.size < availableCategories.length ? "text-[#000666]" : "text-[#9BA4C0]")} />
            상세 필터
            {selectedCategories.size < availableCategories.length && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#000666] -ml-0.5" />
            )}
            <ChevronDown size={14} className="ml-1 text-[#9BA4C0]" />
          </button>

          {/* 필터 팝오버 */}
          <AnimatePresence>
             {isFilterOpen && (
               <motion.div 
                 ref={filterRef}
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 5 }}
                 className="absolute top-[100%] right-0 mt-2 w-[240px] bg-white border border-[#E8EAF0] rounded-[10px] shadow-lg z-50 p-4"
               >
                 <h4 className="text-[12px] font-bold text-[#4A5270] mb-3">차종 카테고리</h4>
                 <div className="space-y-2 max-h-[200px] overflow-y-auto">
                   {availableCategories.map(cat => (
                     <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                       <input 
                         type="checkbox" 
                         checked={selectedCategories.has(cat)} 
                         onChange={() => handleToggleCategory(cat)}
                         className="w-4 h-4 rounded text-[#000666] border-[#D4D8EC] focus:ring-[#000666]"
                       />
                       <span className="text-[13px] text-[#1A1A2E] group-hover:text-[#000666] transition-colors">{cat}</span>
                     </label>
                   ))}
                 </div>
                 <div className="mt-4 pt-3 border-t border-[#F0F2F8] flex justify-end">
                   <button 
                     onClick={() => setSelectedCategories(new Set(availableCategories))}
                     className="text-[11px] text-[#9BA4C0] hover:text-[#4A5270] underline w-full text-center"
                   >
                     필터 초기화
                   </button>
                 </div>
               </motion.div>
             )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 선택 액션 바 (체크박스 선택시 노출) ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#E5E5FA] border-b border-[#000666]/10 px-5 py-2.5 flex items-center justify-between shrink-0 overflow-hidden"
          >
            <span className="text-[13px] font-bold text-[#000666]">
              {selectedIds.size}개 차종 선택됨
            </span>
            <div className="flex gap-2">
               <button className="px-3 py-1.5 bg-white text-[#000666] text-[12px] font-bold rounded-[6px] border border-[#D4D8EC] hover:bg-[#F8F9FC] transition-colors shadow-sm">
                 선택 차종 일괄 업데이트
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 테이블 구조 ── */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-[#FAFBFF] sticky top-0 z-10 border-b border-[#F0F2F8]">
            <tr>
              <th className="w-12 py-3 px-5 text-center">
                <button onClick={handleSelectAll} className="text-[#9BA4C0] hover:text-[#000666] transition-colors">
                  {selectedIds.size === filteredData.length && filteredData.length > 0 ? (
                    <CheckSquare size={16} className="text-[#000666]" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="px-3 py-3 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider w-[260px]">차종 정보</th>
              <th className="px-3 py-3 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">기준율 <span className="text-[9px] font-normal text-[#B0B5D0] ml-1">(클릭수정)</span></th>
              <th className="px-3 py-3 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">신차 (1년이하)</th>
              <th className="px-3 py-3 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">최근 업데이트</th>
              <th className="px-3 py-3 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">상태</th>
              <th className="w-16 px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F8]">
            {filteredData.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <Fragment key={item.id}>
                  <tr 
                    className={cn(
                      "hover:bg-[#FAFBFF] transition-colors group cursor-pointer relative",
                      expandedId === item.id ? "bg-[#F8F9FC]" : "",
                      isSelected ? "bg-[#F5F5FC]" : ""
                    )}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <td className="py-4 px-5 text-center align-middle" onClick={(e) => handleSelectRow(item.id, e)}>
                      {isSelected ? (
                        <CheckSquare size={16} className="mx-auto text-[#000666]" />
                      ) : (
                        <Square size={16} className="mx-auto text-[#D4D8EC] group-hover:text-[#9BA4C0] transition-colors" />
                      )}
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[#1A1A2E] leading-tight flex-1">{item.vehicleName}</span>
                          <ChevronRight 
                            size={14} 
                            className={cn("text-[#9BA4C0] transition-transform", expandedId === item.id && "rotate-90")} 
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium text-[#6B7399] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">
                            {item.brand}
                          </span>
                          <span className="text-[10px] font-medium text-[#6B7399] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Inline Editable Cell - Base Rate */}
                    <td className="px-3 py-4 text-center align-middle relative">
                      <div onClick={(e) => e.stopPropagation()} className="inline-flex justify-center flex-1">
                        {editingCell?.id === item.id && editingCell?.field === 'baseRate' ? (
                          <div className="flex items-center justify-center gap-1 relative z-10">
                            <input
                              autoFocus
                              type="number"
                              value={editingCell.value}
                              onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                              className="w-[52px] h-8 text-center bg-white border-2 border-[#000666] shadow-[0_0_0_3px_rgba(0,6,102,0.1)] rounded-[6px] text-[13px] font-bold text-[#000666] outline-none"
                            />
                            <button onClick={handleSaveEdit} className="p-1 text-[#059669] bg-emerald-50 rounded-full hover:bg-emerald-100 transition-colors">
                              <Save size={13} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] hover:bg-[#E5E5FA] transition-colors group/cell cursor-text"
                            onClick={() => handleCellClick(item.id, 'baseRate', item.baseRate)}
                          >
                            <span className="text-[14px] font-bold text-[#000666]">{item.baseRate}%</span>
                            <Edit3 size={11} className="text-[#000666] opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-4 text-center align-middle">
                      <span className="text-[13px] font-semibold text-[#1A1A2E]">
                        {item.vintageRates["1년 이하"]}%
                      </span>
                    </td>

                    <td className="px-3 py-4 text-center align-middle">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-medium text-[#4A5270] bg-[#F4F5F8] px-2 py-0.5 rounded-full">{item.updatedAt}</span>
                        <span className="text-[10px] text-[#9BA4C0]">{item.updatedBy}</span>
                      </div>
                    </td>

                    <td className="px-3 py-4 text-center align-middle">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        정상 점검
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 text-[#B0B5D0] hover:bg-[#E8EAF0] hover:text-[#1A1A2E] rounded-[6px] transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row Detail */}
                  <AnimatePresence>
                    {expandedId === item.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <td colSpan={7} className="p-0 border-b border-[#F0F2F8]">
                          <div className="px-5 py-5 bg-[#FAFBFF] border-t border-[#F0F2F8]/50 overflow-hidden relative">
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-[#D4D8EC] opacity-50" />
                            <div className="ml-8 grid grid-cols-2 gap-8">
                              {/* 연식별 잔존가치 */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Calendar size={13} className="text-[#000666]" />
                                  <h4 className="text-[12px] font-bold text-[#1A1A2E]">연식별 잔존가치율</h4>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {(Object.entries(item.vintageRates) as [VintageRange, number][]).map(([range, rate]) => (
                                    <div key={range} className="flex flex-col gap-0.5 p-2 bg-white border border-[#E8EAF0] rounded-[8px] group/item hover:border-[#000666] transition-colors cursor-pointer">
                                      <span className="text-[10px] font-medium text-[#8890AA]">{range}</span>
                                      <span className="text-[13px] font-bold text-[#1A1A2E] group-hover/item:text-[#000666]">
                                        {rate}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 주행거리별 감가 */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Gauge size={13} className="text-[#000666]" />
                                  <h4 className="text-[12px] font-bold text-[#1A1A2E]">주행거리별 추가 감가율</h4>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {(Object.entries(item.mileageAdjust) as [MileageRange, number][]).map(([range, adj]) => (
                                    <div key={range} className="flex flex-col gap-0.5 p-2 bg-white border border-[#E8EAF0] rounded-[8px] group/item hover:border-[#E11D48] transition-colors cursor-pointer">
                                      <span className="text-[10px] font-medium text-[#8890AA]">{range}</span>
                                      <span className={cn(
                                        "text-[13px] font-bold",
                                        adj < 0 ? "text-[#E11D48]" : "text-[#1A1A2E]"
                                      )}>
                                        {adj > 0 ? `+${adj}` : adj}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        
        {filteredData.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 bg-[#F4F5F8] border border-[#E8EAF0] rounded-full flex items-center justify-center text-[#9BA4C0]">
              <Search size={24} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-bold text-[#1A1A2E]">조회된 데이터가 없습니다.</p>
              <p className="text-[12px] text-[#8890AA] mt-1">선택한 브랜드나 필터 조건에 일치하는 결과가 없습니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
