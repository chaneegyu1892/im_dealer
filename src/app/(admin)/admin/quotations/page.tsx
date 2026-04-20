'use client';
export const dynamic = 'force-dynamic';
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as xlsx from "xlsx";
import {
  FileText, Search, Download, Filter, X, Phone, User,
  Calendar, Copy, CheckCircle2, Clock, AlertCircle,
  MessageSquare, ChevronDown, SlidersHorizontal, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_QUOTES, FINANCE_COMPANIES,
  type QuoteStatus, type Quotation,
} from "@/constants/mock-data";
import { logActivity } from "@/lib/activity-store";

const STATUS_STYLE: Record<QuoteStatus, { bg: string; text: string; icon: React.ElementType }> = {
  상담대기: { bg: "bg-slate-100", text: "text-slate-600", icon: Clock },
  상담중:   { bg: "bg-blue-50",   text: "text-blue-600",  icon: MessageSquare },
  계약완료: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle2 },
  계약취소: { bg: "bg-red-50",    text: "text-red-500",   icon: AlertCircle },
};

const STATUS_LIST: QuoteStatus[] = ["상담대기", "상담중", "계약완료", "계약취소"];

function QuotationsContent() {
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<Quotation[]>(MOCK_QUOTES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "전체">("전체");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 상세 필터 상태
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterFC, setFilterFC] = useState<string>("전체");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPaymentMin, setFilterPaymentMin] = useState("");
  const [filterPaymentMax, setFilterPaymentMax] = useState("");

  const [drawerQuote, setDrawerQuote] = useState<Quotation | null>(null);

  // URL 파라미터(?id=... 또는 ?search=...) 연동
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const target = quotes.find(q => q.id === id);
      if (target) {
        setDrawerQuote(target);
      }
    }
    
    // 검색어 파라미터 처리
    const s = searchParams.get("search");
    if (s) {
      setSearch(s);
    }
  }, [searchParams, quotes]);

  const activeFilterCount =
    (filterFC !== "전체" ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0) +
    (filterPaymentMin ? 1 : 0) +
    (filterPaymentMax ? 1 : 0);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchSearch = q.customerName.includes(search) || q.vehicleName.includes(search) || q.phone.includes(search);
      const matchStatus = statusFilter === "전체" || q.status === statusFilter;
      const matchFC = filterFC === "전체" || q.financeCompany === filterFC;
      const matchDateFrom = !filterDateFrom || q.createdAt >= filterDateFrom;
      const matchDateTo = !filterDateTo || q.createdAt <= filterDateTo;
      const min = filterPaymentMin ? Number(filterPaymentMin) * 10000 : 0;
      const max = filterPaymentMax ? Number(filterPaymentMax) * 10000 : Infinity;
      const matchPayment = q.monthlyPayment >= min && q.monthlyPayment <= max;
      return matchSearch && matchStatus && matchFC && matchDateFrom && matchDateTo && matchPayment;
    });
  }, [quotes, search, statusFilter, filterFC, filterDateFrom, filterDateTo, filterPaymentMin, filterPaymentMax]);

  const resetDetailFilters = () => {
    setFilterFC("전체");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterPaymentMin("");
    setFilterPaymentMax("");
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuotes.map(q => q.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleExportExcel = () => {
    const target = selectedIds.size > 0
      ? filteredQuotes.filter(q => selectedIds.has(q.id))
      : filteredQuotes;

    const dataToExport = target.map(q => ({
      "견적 ID": q.id,
      "고객명": q.customerName,
      "연락처": q.phone,
      "차량명": q.vehicleName,
      "차량 (짧은명)": q.vehicleShort,
      "선택 색상": q.color,
      "선택 옵션": q.options.join(", "),
      "월 납입금 (원)": q.monthlyPayment,
      "금융사": q.financeCompany,
      "프로모션": q.promotion,
      "진행 상태": q.status,
      "접수일": q.createdAt,
      "메모": q.memo,
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);

    // 컬럼 너비 설정
    worksheet["!cols"] = [
      { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 12 },
      { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
      { wch: 10 }, { wch: 12 }, { wch: 30 },
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "견적데이터");
    xlsx.writeFile(workbook, `아임딜러_견적데이터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleBulkStatusChange = (newStatus: QuoteStatus) => {
    logActivity(`[견적 일괄 변경] 선택된 ${selectedIds.size}건의 상태를 '${newStatus}'로 변경했습니다.`, 'update');
    setQuotes(prev => prev.map(q => selectedIds.has(q.id) ? { ...q, status: newStatus } : q));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (confirm(`선택한 ${selectedIds.size}개의 견적을 정말 삭제하시겠습니까?`)) {
      logActivity(`[견적 일괄 삭제] 선택된 ${selectedIds.size}건의 견적 데이터를 삭제했습니다.`, 'delete');
      setQuotes(prev => prev.filter(q => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    }
  };

  const updateMemo = (id: string, newMemo: string) => {
    const quote = quotes.find(q => q.id === id);
    if (quote && quote.memo !== newMemo && newMemo.length > 0) {
        // 너무 잦은 로그 방지 (선택적)
    }
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, memo: newMemo } : q));
    if (drawerQuote?.id === id) setDrawerQuote({ ...drawerQuote, memo: newMemo });
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">

      {/* 1. 상단 KPI & 헤더 */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 shrink-0 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F4F5F8] rounded-[8px] text-[#000666]">
            <MessageSquare size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E]">견적 데이터 실시간 현황</h1>
            <p className="text-[12px] text-[#6B7399] mt-1">이번 달 접수된 모든 견적 건의 진행 상태 및 히스토리 요약</p>
          </div>
        </div>
        <div className="flex gap-4">
          <KPIMini label="전체 누적" value={quotes.length.toString()} highlight />
          <div className="w-[1px] h-10 bg-[#E8EAF0]" />
          <KPIMini label="상담 대기" value={quotes.filter(q => q.status === "상담대기").length.toString()} color="text-slate-600" />
          <KPIMini label="상담 진행" value={quotes.filter(q => q.status === "상담중").length.toString()} color="text-blue-600" />
          <KPIMini label="계약 완료" value={quotes.filter(q => q.status === "계약완료").length.toString()} color="text-emerald-600" />
        </div>
      </div>

      {/* 2. 툴바 */}
      <div className="px-6 py-3 bg-[#FAFBFF] border-b border-[#E8EAF0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="고객명, 차량명, 전화번호 검색"
              className="w-[240px] pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E] transition-colors shadow-sm"
            />
          </div>
          {/* 상태 탭 필터 */}
          <div className="flex bg-white rounded-[6px] border border-[#E8EAF0] p-1 shadow-sm">
            {(["전체", ...STATUS_LIST] as const).map(st => (
              <button
                key={st} onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium rounded-[4px] transition-colors",
                  statusFilter === st ? "bg-[#F4F5F8] text-[#1A1A2E]" : "text-[#9BA4C0] hover:text-[#6B7399]"
                )}
              >{st}</button>
            ))}
          </div>

          {/* 상세 필터 버튼 */}
          <button
            onClick={() => setFilterPanelOpen(o => !o)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border shadow-sm rounded-[6px] text-[12px] font-medium transition-colors",
              filterPanelOpen || activeFilterCount > 0
                ? "bg-[#000666] text-white border-[#000666]"
                : "bg-white border-[#E8EAF0] text-[#4A5270] hover:bg-[#F8F9FC]"
            )}
          >
            <SlidersHorizontal size={13} />
            상세 필터
            {activeFilterCount > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-white text-[#000666] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-[11px] text-[#9BA4C0]">
            {filteredQuotes.length}/{quotes.length}건
            {selectedIds.size > 0 && ` · ${selectedIds.size}건 선택`}
          </span>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#000666] text-white border border-transparent shadow-sm rounded-[6px] text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <Download size={13} />
            {selectedIds.size > 0 ? `선택 ${selectedIds.size}건 엑셀` : "전체 엑셀"} 다운로드
          </button>
        </div>
      </div>

      {/* 3. 상세 필터 패널 */}
      <AnimatePresence>
        {filterPanelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-[#F0F2F8] border-b border-[#E8EAF0] px-6 py-4 flex items-end gap-6 flex-wrap">
              {/* 금융사 */}
              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <label className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider">금융사</label>
                <div className="relative">
                  <select
                    value={filterFC}
                    onChange={e => setFilterFC(e.target.value)}
                    className="appearance-none w-full pl-3 pr-8 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] shadow-sm cursor-pointer"
                  >
                    <option value="전체">전체 금융사</option>
                    {FINANCE_COMPANIES.map(fc => <option key={fc} value={fc}>{fc}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                </div>
              </div>

              {/* 접수일 범위 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider">접수일 범위</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                    className="px-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] shadow-sm"
                  />
                  <span className="text-[12px] text-[#9BA4C0]">~</span>
                  <input
                    type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    className="px-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] shadow-sm"
                  />
                </div>
              </div>

              {/* 월 납입금 범위 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider">월 납입금 (만원)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" value={filterPaymentMin} onChange={e => setFilterPaymentMin(e.target.value)}
                    placeholder="최소 (만원)"
                    className="w-[100px] px-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] shadow-sm"
                  />
                  <span className="text-[12px] text-[#9BA4C0]">~</span>
                  <input
                    type="number" value={filterPaymentMax} onChange={e => setFilterPaymentMax(e.target.value)}
                    placeholder="최대 (만원)"
                    className="w-[100px] px-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] shadow-sm"
                  />
                </div>
              </div>

              {/* 초기화 */}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetDetailFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#DC2626] bg-red-50 border border-red-200 rounded-[6px] hover:bg-red-100 transition-colors self-end"
                >
                  <X size={13} /> 필터 초기화
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 테이블 */}
      <div className="flex-1 overflow-auto bg-white min-h-0 relative scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#FAFBFF] sticky top-0 z-10 border-b border-[#E8EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <tr>
              <th className="py-3 px-4 w-[40px] font-medium text-center">
                <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0} className="w-4 h-4 rounded cursor-pointer" />
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">견적 ID</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">차량 정보</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">고객 (연락처)</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">월 납입금</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">금융사</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">상태</th>
              <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">접수일자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F8]">
            {filteredQuotes.length === 0 ? (
              <tr><td colSpan={8} className="py-20 text-center text-[13px] text-[#9BA4C0]">해당하는 견적 데이터가 없습니다.</td></tr>
            ) : filteredQuotes.map(q => {
              const isSelected = selectedIds.has(q.id);
              const SStyle = STATUS_STYLE[q.status];
              const SIcon = SStyle.icon;
              return (
                <tr
                  key={q.id}
                  onClick={() => setDrawerQuote(q)}
                  className={cn("group cursor-pointer transition-colors hover:bg-[#F8F9FC]", isSelected && "bg-[#F4F5F8]")}
                >
                  <td className="py-4 px-4 text-center">
                    <input type="checkbox" checked={isSelected} onClick={e => toggleSelect(q.id, e)} onChange={() => {}} className="w-4 h-4 rounded cursor-pointer" />
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[12px] font-bold text-[#1A1A2E] bg-slate-50 px-2 py-1 rounded-[4px] font-mono group-hover:bg-white">{q.id}</span>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-[13px] font-bold text-[#1A1A2E]">{q.vehicleName}</p>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <p className="text-[11px] text-[#6B7399] font-medium">{q.lineup} | {q.trim}</p>
                      <p className="text-[10px] text-[#9BA4C0] truncate max-w-[200px]">{q.options.join(", ")} | {q.color}</p>
                    </div>
                  </td>
                   <td className="py-4 px-4 group/user">
                    <Link 
                      href={`/admin/users?search=${encodeURIComponent(q.customerName)}`}
                      className="inline-flex items-center gap-1 group/link"
                    >
                      <div>
                        <p className="text-[13px] font-bold text-[#1A1A2E] group-hover/link:text-[#000666] transition-colors">{q.customerName}</p>
                        <p className="text-[11px] text-[#6B7399] mt-0.5">{q.phone}</p>
                      </div>
                      <ChevronRight size={12} className="text-[#9BA4C0] opacity-0 group-hover/link:opacity-100 -translate-x-1 group-hover/link:translate-x-0 transition-all" />
                    </Link>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[13px] font-bold text-[#000666] bg-blue-50/50 px-2.5 py-1 rounded-[4px]">{q.monthlyPayment.toLocaleString()} 원</span>
                  </td>
                  <td className="py-4 px-4 text-[12px] font-medium text-[#4A5270]">{q.financeCompany}</td>
                  <td className="py-4 px-4">
                    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold", SStyle.bg, SStyle.text)}>
                      <SIcon size={11} strokeWidth={2.5} /> {q.status}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[12px] text-[#6B7399]">{q.createdAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="h-20 shrink-0" /> {/* 리스트 끝 여백 */}
      </div>
      {/* 하단 페이드 오버레이 */}
      <div className="absolute bottom-[48px] left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10 opacity-90" />

      {/* 하단 상태 바 (페이지네이션 버튼 제거) */}
      <div className="px-6 py-4 bg-[#FAFBFF] border-t border-[#E8EAF0] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#6B7399]">전체 <strong className="text-[#1A1A2E]">{filteredQuotes.length}</strong>개의 견적이 접수되었습니다.</span>
        </div>
        <div className="text-[11px] text-[#B0B5CC] font-medium">최종 업데이트: 2026-04-16</div>
      </div>

      {/* 5. 플로팅 액션바 */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0, x: "-50%" }} animate={{ y: 0, opacity: 1, x: "-50%" }} exit={{ y: 50, opacity: 0, x: "-50%" }}
            className="absolute bottom-8 left-1/2 flex items-center gap-4 px-5 py-3 bg-[#1A1A2E] rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-[#3D4470] z-30"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#6066EE] text-white flex items-center justify-center text-[10px] font-bold">{selectedIds.size}</div>
              <span className="text-[13px] font-medium text-white tracking-wide">건 선택됨</span>
            </div>
            <div className="w-[1px] h-4 bg-[#3D4470]" />
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#9BA4C0]">상태 변경:</span>
              <div className="flex gap-1.5">
                {STATUS_LIST.map(s => (
                  <button key={s} onClick={() => handleBulkStatusChange(s)} className="px-2.5 py-1 text-[11px] font-medium text-[#C0C5DC] bg-[#2A2D4A] hover:bg-[#3D4470] hover:text-white rounded-[4px] transition-colors">{s}</button>
                ))}
              </div>
            </div>
            <div className="w-[1px] h-4 bg-[#3D4470]" />
            <button onClick={handleBulkDelete} className="text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors">일괄 삭제</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. 상세 Drawer */}
      <AnimatePresence>
        {drawerQuote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerQuote(null)} className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-40" />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-[420px] bg-white z-50 flex flex-col border-l border-[#E8EAF0] shadow-[-10px_0_30px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8EAF0] bg-[#FAFBFF]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[#6B7399] uppercase">상담 상세 정보</span>
                    <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-[#E8EAF0] text-[#1A1A2E]">{drawerQuote.id}</span>
                  </div>
                   <Link 
                    href={`/admin/users?search=${encodeURIComponent(drawerQuote.customerName)}`}
                    className="group/name inline-flex items-center gap-1.5"
                  >
                    <h3 className="text-[18px] font-bold text-[#1A1A2E] group-hover/name:text-[#000666] transition-colors">{drawerQuote.customerName} 고객님</h3>
                    <ChevronRight size={16} className="text-[#9BA4C0] group-hover/name:text-[#000666] transition-colors" />
                  </Link>
                </div>
                <button onClick={() => setDrawerQuote(null)} className="p-1.5 hover:bg-[#E8EAF0] rounded-[6px] text-[#6B7399] transition-colors"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[13px] font-bold text-[#1A1A2E] flex items-center gap-1.5"><User size={14} className="text-[#000666]" /> 고객 & 진행</h4>
                    <select
                      value={drawerQuote.status}
                      onChange={e => {
                        const s = e.target.value as QuoteStatus;
                        logActivity(`[상담 상태 변경] ${drawerQuote.customerName} 고객님의 상태를 '${s}'(으)로 변경했습니다.`, 'update');
                        setQuotes(prev => prev.map(q => q.id === drawerQuote.id ? { ...q, status: s } : q));
                        setDrawerQuote({ ...drawerQuote, status: s });
                      }}
                      className={cn("px-2 py-1 text-[11px] font-bold rounded-[4px] outline-none cursor-pointer border", STATUS_STYLE[drawerQuote.status].bg, STATUS_STYLE[drawerQuote.status].text, "border-transparent")}
                    >
                      {STATUS_LIST.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div className="bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] p-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-[#6B7399] mb-0.5">연락처</p>
                      <p className="text-[12px] font-medium text-[#1A1A2E] flex items-center gap-1"><Phone size={10} className="text-[#9BA4C0]" /> {drawerQuote.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6B7399] mb-0.5">접수 일자</p>
                      <p className="text-[12px] font-medium text-[#1A1A2E] flex items-center gap-1"><Calendar size={10} className="text-[#9BA4C0]" /> {drawerQuote.createdAt}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-1.5"><FileText size={14} className="text-[#000666]" /> 차량 스펙 정보</h4>
                  <div className="space-y-2 border-t border-b border-[#F0F2F8] py-3">
                    {[
                      ["모델명", drawerQuote.vehicleName],
                      ["라인업", drawerQuote.lineup],
                      ["트림", drawerQuote.trim],
                      ["외장 색상", drawerQuote.color],
                      ["선택 옵션", drawerQuote.options.join(", ")],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-[12px] text-[#6B7399]">{label}</span>
                        <span className="text-[12px] font-medium text-[#4A5270] text-right max-w-[220px]">{val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2">
                      <span className="text-[12px] font-semibold text-[#000666]">적용 프로모션</span>
                      <span className="text-[11px] font-bold text-white bg-[#6066EE] px-1.5 py-0.5 rounded-[4px]">{drawerQuote.promotion}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="bg-[#0D0D1F] rounded-[10px] p-4 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><FileText size={60} /></div>
                    <p className="text-[11px] text-[#9BA4C0] font-medium mb-1 relative z-10">최종 렌트/리스 조건 요약</p>
                    <div className="flex justify-between items-end relative z-10">
                      <div>
                        <p className="text-[18px] font-bold mt-1 text-white">{drawerQuote.monthlyPayment.toLocaleString()} <span className="text-[12px] font-medium text-[#C0C5DC]">원 / 월</span></p>
                        <p className="text-[11px] text-[#6B7399] mt-1">{drawerQuote.financeCompany} · 48개월 · 선납 30%</p>
                      </div>
                      <button className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium px-2 py-1.5 rounded-[4px] flex items-center gap-1 transition-colors">
                        <Copy size={10} /> 견적 복사
                      </button>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col flex-1 min-h-[150px]">
                  <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-2">상담 일지 (Dealer Note)</h4>
                  <textarea
                    value={drawerQuote.memo}
                    onChange={e => updateMemo(drawerQuote.id, e.target.value)}
                    placeholder="고객과의 상담 내역이나 특이사항을 기록하세요."
                    className="w-full flex-1 p-3 text-[12px] bg-[#FAFBFF] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#C0C5DC] text-[#4A5270] resize-none transition-colors"
                    rows={6}
                  />
                  <p className="text-[10px] text-[#9BA4C0] mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> 로컬 시스템에 실시간 반영됩니다.</p>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function KPIMini({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold text-[#9BA4C0] mb-0.5">{label}</span>
      <span className={cn("text-[20px] font-bold tracking-tight", highlight ? "text-[#000666]" : color || "text-[#1A1A2E]")}>
        {value}<span className="text-[12px] font-normal ml-0.5 opacity-60">건</span>
      </span>
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-2">
          <Clock className="w-8 h-8 text-[#000666] animate-spin" />
          <p className="text-[14px] text-[#6B7399]">견적 현황 데이터를 불러오는 중...</p>
        </div>
      </div>
    }>
      <QuotationsContent />
    </Suspense>
  );
}
