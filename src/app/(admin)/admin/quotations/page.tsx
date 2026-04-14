"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as xlsx from "xlsx";
import {
  FileText, Search, Download, Filter, MoreHorizontal, 
  ChevronRight, X, Phone, User, Calendar, Copy,
  CheckCircle2, Clock, AlertCircle, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES & MOCK DATA ──────────────────────────────────────────
type QuoteStatus = "상담대기" | "상담중" | "계약완료" | "계약취소";

interface Quotation {
  id: string;
  vehicleName: string;
  customerName: string;
  phone: string;
  monthlyPayment: number;
  financeCompany: string;
  status: QuoteStatus;
  createdAt: string;
  // 상세 데이터용
  options: string[];
  color: string;
  promotion: string;
  memo: string;
}

const MOCK_QUOTES: Quotation[] = [
  { id: "Q-2404-001", vehicleName: "아이오닉 6 롱레인지 익스클루시브", customerName: "김대현", phone: "010-1234-5678", monthlyPayment: 654000, financeCompany: "KB캐피탈", status: "상담대기", createdAt: "2026-04-14", options: ["빌트인 캠", "파노라마 선루프"], color: "어비스 블랙 펄", promotion: "EV 특별 프로모션", memo: "" },
  { id: "Q-2404-002", vehicleName: "쏘렌토 하이브리드 시그니처", customerName: "이민수", phone: "010-9876-5432", monthlyPayment: 720000, financeCompany: "현대캐피탈", status: "상담중", createdAt: "2026-04-13", options: ["드라이브 와이즈", "스마트 커넥트"], color: "스노우 화이트 펄", promotion: "봄맞이 페스타", memo: "고객님이 화이트 펄 색상 출고 대기기간 문의하심." },
  { id: "Q-2404-003", vehicleName: "GV80 2.5 가솔린 터보", customerName: "박지훈", phone: "010-5555-4444", monthlyPayment: 1150000, financeCompany: "하나캐피탈", status: "계약완료", createdAt: "2026-04-10", options: ["파퓰러 패키지", "렉시콘 사운드"], color: "우유니 화이트", promotion: "법인 임원 특별할인", memo: "최종 계약 서명 완료. 다음주 목요일 탁송 예정." },
  { id: "Q-2404-004", vehicleName: "투싼 하이브리드 인스퍼레이션", customerName: "최유진", phone: "010-3333-2222", monthlyPayment: 540000, financeCompany: "우리카드", status: "계약취소", createdAt: "2026-04-08", options: ["파노라마 선루프"], color: "아마존 그레이", promotion: "기본할인", memo: "타사 조건이 더 좋아 취소하심." },
  { id: "Q-2404-005", vehicleName: "제로무공해 EV6", customerName: "정수빈", phone: "010-1111-9999", monthlyPayment: 690000, financeCompany: "신한카드", status: "상담대기", createdAt: "2026-04-14", options: ["하이테크", "메리디안 사운드"], color: "문스케이프 매트", promotion: "기본할인", memo: "" },
  { id: "Q-2404-006", vehicleName: "K8 하이브리드 노블레스", customerName: "강성태", phone: "010-8888-7777", monthlyPayment: 610000, financeCompany: "JB우리캐피탈", status: "상담중", createdAt: "2026-04-12", options: ["드라이브 와이즈"], color: "스틸 그레이", promotion: "재고할인 특별전", memo: "금리 인하 가능 여부 확인 필요." },
];

const STATUS_STYLE: Record<QuoteStatus, { bg: string, text: string, icon: any }> = {
  상담대기: { bg: "bg-slate-100", text: "text-slate-600", icon: Clock },
  상담중: { bg: "bg-blue-50", text: "text-blue-600", icon: MessageSquare },
  계약완료: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle2 },
  계약취소: { bg: "bg-red-50", text: "text-red-500", icon: AlertCircle },
};

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quotation[]>(MOCK_QUOTES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "전체">("전체");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Drawer 상태
  const [drawerQuote, setDrawerQuote] = useState<Quotation | null>(null);

  // ─── 로직 ───
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchSearch = q.customerName.includes(search) || q.vehicleName.includes(search);
      const matchStatus = statusFilter === "전체" || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotes, search, statusFilter]);

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
    const dataToExport = filteredQuotes.map(q => ({
      "견적 ID": q.id,
      "고객명": q.customerName,
      "연락처": q.phone,
      "차량명": q.vehicleName,
      "월 납입금(원)": q.monthlyPayment,
      "금융사": q.financeCompany,
      "진행 상태": q.status,
      "생성일": q.createdAt
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "견적데이터");
    xlsx.writeFile(workbook, `견적데이터_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleBulkStatusChange = (newStatus: QuoteStatus) => {
    setQuotes(prev => prev.map(q => selectedIds.has(q.id) ? { ...q, status: newStatus } : q));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if(confirm(`선택한 ${selectedIds.size}개의 견적을 정말 삭제하시겠습니까?`)) {
      setQuotes(prev => prev.filter(q => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    }
  };

  const updateMemo = (id: string, newMemo: string) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, memo: newMemo } : q));
    if(drawerQuote && drawerQuote.id === id) {
      setDrawerQuote({ ...drawerQuote, memo: newMemo });
    }
  };

  // ─── 렌더링 ───
  return (
    <div className="relative flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
      
      {/* 1. 통계 요약 (Top KPI) */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 shrink-0 flex items-center justify-between z-10">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] flex items-center gap-2">
            견적 데이터 실시간 현황
          </h1>
          <p className="text-[12px] text-[#6B7399] mt-1">이번 달 접수된 모든 견적 건의 진행 상태를 파악합니다.</p>
        </div>
        <div className="flex gap-4">
          <KPIMini label="전체 누적" value={quotes.length.toString()} highlight />
          <div className="w-[1px] h-10 bg-[#E8EAF0]" />
          <KPIMini label="상담 대기" value={quotes.filter(q=>q.status==="상담대기").length.toString()} color="text-slate-600" />
          <KPIMini label="상담 진행" value={quotes.filter(q=>q.status==="상담중").length.toString()} color="text-blue-600" />
          <KPIMini label="계약 완료" value={quotes.filter(q=>q.status==="계약완료").length.toString()} color="text-emerald-600" />
        </div>
      </div>

      {/* 2. 툴바 영역 */}
      <div className="px-6 py-3 bg-[#FAFBFF] border-b border-[#E8EAF0] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input 
              type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="고객명 또는 차량명 검색" 
              className="w-[240px] pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E] transition-colors shadow-sm"
            />
          </div>
          <div className="flex bg-white rounded-[6px] border border-[#E8EAF0] p-1 shadow-sm">
            {(["전체", "상담대기", "상담중", "계약완료", "계약취소"] as const).map(st => (
              <button 
                key={st} onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium rounded-[4px] transition-colors",
                  statusFilter === st ? "bg-[#F4F5F8] text-[#1A1A2E]" : "text-[#9BA4C0] hover:text-[#6B7399]"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E8EAF0] shadow-sm rounded-[6px] text-[12px] font-medium text-[#4A5270] hover:bg-[#F8F9FC] transition-colors">
            <Filter size={13} /> 상세 필터
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 bg-[#000666] text-white border border-transparent shadow-sm rounded-[6px] text-[12px] font-medium hover:opacity-90 transition-opacity">
            <Download size={13} /> 엑셀 다운로드 (XLSX)
          </button>
        </div>
      </div>

      {/* 3. 데이터 테이블 */}
      <div className="flex-1 overflow-auto bg-white min-h-0 relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#FAFBFF] sticky top-0 z-10 border-b border-[#E8EAF0] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <tr>
              <th className="py-3 px-4 w-[40px] font-medium text-center">
                <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0} className="w-4 h-4 rounded text-[#000666] cursor-pointer" />
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
            ) : filteredQuotes.map((q) => {
              const isSelected = selectedIds.has(q.id);
              const SStyle = STATUS_STYLE[q.status];
              const SIcon = SStyle.icon;
              return (
                <tr 
                  key={q.id} 
                  onClick={() => setDrawerQuote(q)}
                  className={cn(
                    "group cursor-pointer transition-colors hover:bg-[#F8F9FC]",
                    isSelected && "bg-[#F4F5F8]"
                  )}
                >
                  <td className="py-3 px-4 text-center">
                    <input type="checkbox" checked={isSelected} onClick={(e) => toggleSelect(q.id, e)} onChange={()=>{}} className="w-4 h-4 rounded text-[#000666] cursor-pointer" />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[12px] font-bold text-[#1A1A2E] bg-slate-50 px-2 py-1 rounded-[4px] font-mono group-hover:bg-white">{q.id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[13px] font-bold text-[#1A1A2E]">{q.vehicleName}</p>
                    <p className="text-[11px] text-[#6B7399] mt-0.5 max-w-[200px] truncate">{q.options.join(", ")} | {q.color}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[13px] font-bold text-[#1A1A2E]">{q.customerName}</p>
                    <p className="text-[11px] text-[#6B7399] mt-0.5">{q.phone}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[13px] font-bold text-[#000666] bg-blue-50/50 px-2.5 py-1 rounded-[4px]">{q.monthlyPayment.toLocaleString()} 원</span>
                  </td>
                  <td className="py-3 px-4 text-[12px] font-medium text-[#4A5270]">{q.financeCompany}</td>
                  <td className="py-3 px-4">
                    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold", SStyle.bg, SStyle.text)}>
                      <SIcon size={11} strokeWidth={2.5} /> {q.status}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[12px] text-[#6B7399]">{q.createdAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. 플로팅 액션 바 (벌크 관리) */}
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
                {(["상담대기", "상담중", "계약완료", "계약취소"] as QuoteStatus[]).map(s => (
                  <button key={s} onClick={() => handleBulkStatusChange(s)} className="px-2.5 py-1 text-[11px] font-medium text-[#C0C5DC] bg-[#2A2D4A] hover:bg-[#3D4470] hover:text-white rounded-[4px] transition-colors">{s}</button>
                ))}
              </div>
            </div>
            <div className="w-[1px] h-4 bg-[#3D4470]" />
            <button onClick={handleBulkDelete} className="text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors">
              일괄 삭제
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 우측 상담 상세 Drawer */}
      <AnimatePresence>
        {drawerQuote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerQuote(null)} className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-40" />
            <motion.div 
              initial={{ x: "100%", boxShadow: "-10px 0 30px rgba(0,0,0,0)" }} animate={{ x: 0, boxShadow: "-10px 0 30px rgba(0,0,0,0.1)" }} exit={{ x: "100%", boxShadow: "-10px 0 30px rgba(0,0,0,0)" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-[420px] bg-white z-50 flex flex-col border-l border-[#E8EAF0]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8EAF0] bg-[#FAFBFF]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[#6B7399] uppercase">상담 상세 정보</span>
                    <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-[#E8EAF0] text-[#1A1A2E]">{drawerQuote.id}</span>
                  </div>
                  <h3 className="text-[18px] font-bold text-[#1A1A2E]">{drawerQuote.customerName} 고객님</h3>
                </div>
                <button onClick={() => setDrawerQuote(null)} className="p-1.5 hover:bg-[#E8EAF0] rounded-[6px] text-[#6B7399] transition-colors"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                
                {/* 섹션 1: 고객 및 상태 */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[13px] font-bold text-[#1A1A2E] flex items-center gap-1.5"><User size={14} className="text-[#000666]"/> 고객 & 진행</h4>
                    <select 
                      value={drawerQuote.status} 
                      onChange={(e) => {
                        const s = e.target.value as QuoteStatus;
                        setQuotes(prev => prev.map(q => q.id === drawerQuote.id ? { ...q, status: s } : q));
                        setDrawerQuote({ ...drawerQuote, status: s });
                      }}
                      className={cn("px-2 py-1 text-[11px] font-bold rounded-[4px] outline-none cursor-pointer border", STATUS_STYLE[drawerQuote.status].bg, STATUS_STYLE[drawerQuote.status].text, "border-transparent focus:border-[#C0C5DC]")}
                    >
                      {(["상담대기", "상담중", "계약완료", "계약취소"] as QuoteStatus[]).map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div className="bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] p-3 py-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-[#6B7399] mb-0.5">연락처</p>
                      <p className="text-[12px] font-medium text-[#1A1A2E] flex items-center gap-1"><Phone size={10} className="text-[#9BA4C0]"/> {drawerQuote.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6B7399] mb-0.5">접수 일자</p>
                      <p className="text-[12px] font-medium text-[#1A1A2E] flex items-center gap-1"><Calendar size={10} className="text-[#9BA4C0]"/> {drawerQuote.createdAt}</p>
                    </div>
                  </div>
                </section>

                {/* 섹션 2: 차량 스펙 */}
                <section>
                  <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-1.5"><FileText size={14} className="text-[#000666]"/> 차량 스펙 정보</h4>
                  <div className="space-y-2 border-t border-b border-[#F0F2F8] py-3">
                    <div className="flex justify-between">
                      <span className="text-[12px] text-[#6B7399]">모델</span>
                      <span className="text-[13px] font-bold text-[#1A1A2E] text-right">{drawerQuote.vehicleName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[12px] text-[#6B7399]">외장 색상</span>
                      <span className="text-[12px] font-medium text-[#4A5270]">{drawerQuote.color}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[12px] text-[#6B7399]">선택 옵션</span>
                      <span className="text-[12px] font-medium text-[#4A5270] text-right max-w-[200px] leading-tight">{drawerQuote.options.join(", ")}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[12px] font-semibold text-[#000666]">적용 프로모션</span>
                      <span className="text-[11px] font-bold text-white bg-[#6066EE] px-1.5 py-0.5 rounded-[4px]">{drawerQuote.promotion}</span>
                    </div>
                  </div>
                </section>

                {/* 섹션 3: 계약 조건 조건방 (월 납입금) */}
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

                {/* 섹션 4: 딜러 상담 노트 */}
                <section className="flex flex-col flex-1 h-full min-h-[150px]">
                  <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-2 flex items-center gap-1.5">상담 일지 (Dealer Note)</h4>
                  <textarea 
                    value={drawerQuote.memo}
                    onChange={(e) => updateMemo(drawerQuote.id, e.target.value)}
                    placeholder="고객과의 상담 내역이나 특이사항을 기록하세요. (자동 저장됨)" 
                    className="w-full flex-1 p-3 text-[12px] bg-[#FAFBFF] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#C0C5DC] text-[#4A5270] resize-none transition-colors"
                  />
                  <p className="text-[10px] text-[#9BA4C0] mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> 작성 시 로컬 시스템에 실시간 반영됩니다.</p>
                </section>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

function KPIMini({ label, value, highlight, color }: any) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold text-[#9BA4C0] mb-0.5">{label}</span>
      <span className={cn("text-[20px] font-bold tracking-tight", highlight ? "text-[#000666]" : color || "text-[#1A1A2E]")}>{value}<span className="text-[12px] font-normal ml-0.5 opacity-60">건</span></span>
    </div>
  );
}
