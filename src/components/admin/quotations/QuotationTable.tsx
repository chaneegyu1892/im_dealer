"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan, formatDateKR, formatDateTimeKR } from "@/lib/format";
import type { AdminSavedQuote } from "@/types/admin";

interface QuotationTableProps {
  initialQuotes: AdminSavedQuote[];
  total: number;
}

export function QuotationTable({ initialQuotes, total }: QuotationTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedQuote = initialQuotes.find((q) => q.id === selectedId);

  const filtered = search
    ? initialQuotes.filter(
        (q) =>
          q.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
          q.trimName.toLowerCase().includes(search.toLowerCase())
      )
    : initialQuotes;

  // ESC 키 + backdrop 클릭으로 Drawer 닫기
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, closeDrawer]);

  return (
    <div className="p-5 space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="text-[22px] font-bold text-[#1A1A2E]">견적 데이터</h1>
        <p className="text-[13px] text-[#9BA4C0] mt-0.5">총 {total}건</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <p className="text-[11px] text-[#6B7399] mb-1">전체 누적</p>
          <p className="text-[24px] font-bold text-[#1A1A2E]">
            {total}<span className="text-[13px] text-[#9BA4C0] ml-1">건</span>
          </p>
        </div>
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <p className="text-[11px] text-[#6B7399] mb-1">장기렌트</p>
          <p className="text-[24px] font-bold text-[#000666]">
            {filtered.filter((q) => q.contractType === "반납형").length}
            <span className="text-[13px] text-[#9BA4C0] ml-1">건</span>
          </p>
        </div>
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <p className="text-[11px] text-[#6B7399] mb-1">인수형</p>
          <p className="text-[24px] font-bold text-[#7C3AED]">
            {filtered.filter((q) => q.contractType === "인수형").length}
            <span className="text-[13px] text-[#9BA4C0] ml-1">건</span>
          </p>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative w-[300px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8D0]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="차량명 또는 트림으로 검색"
          className="w-full pl-8 pr-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] transition-colors placeholder:text-[#B0B8D0]"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-[14px] border border-[#E8EAF0] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F2F8] bg-[#FAFBFF]">
              {["차량", "트림", "계약조건", "월 납입금", "계약유형", "접수일"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold text-[#6B7399] uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2F8]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#9BA4C0]">
                  견적 데이터가 없습니다
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className={cn(
                    "cursor-pointer hover:bg-[#FAFBFF] transition-colors",
                    selectedId === q.id && "bg-[#F0F2FF]"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-[#1A1A2E]">
                      {q.vehicleBrand} {q.vehicleName}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4A5270]">{q.trimName}</td>
                  <td className="px-4 py-3 text-[12px] text-[#6B7399]">
                    {q.contractMonths}개월 / {(q.annualMileage / 10000).toFixed(0)}만km
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[14px] font-bold text-[#000666]">
                      {formatKRWMan(q.monthlyPayment)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-1 rounded-[4px]",
                        q.contractType === "인수형"
                          ? "bg-purple-50 text-purple-600"
                          : "bg-blue-50 text-blue-600"
                      )}
                    >
                      {q.contractType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#9BA4C0]">
                    {formatDateKR(q.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Backdrop */}
      {selectedQuote && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* 상세 Drawer */}
      {selectedQuote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="견적 상세"
          className="fixed top-0 right-0 w-[400px] h-full bg-white border-l border-[#E8EAF0] shadow-xl z-50 overflow-y-auto"
        >
          <div className="p-5 border-b border-[#E8EAF0] flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[#1A1A2E]">견적 상세</h3>
            <button
              onClick={closeDrawer}
              className="p-1 rounded hover:bg-[#F4F5F8] text-[#9BA4C0]"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-[#F8F9FC] rounded-[10px] p-4 space-y-2">
              <DetailRow label="차량" value={`${selectedQuote.vehicleBrand} ${selectedQuote.vehicleName}`} />
              <DetailRow label="트림" value={selectedQuote.trimName} />
              <DetailRow label="계약 기간" value={`${selectedQuote.contractMonths}개월`} />
              <DetailRow label="연간 주행거리" value={`${selectedQuote.annualMileage.toLocaleString()}km`} />
              <DetailRow label="보증금" value={`${selectedQuote.depositRate}%`} />
              <DetailRow label="선납금" value={`${selectedQuote.prepayRate}%`} />
              <DetailRow label="계약 유형" value={selectedQuote.contractType} />
            </div>
            <div className="bg-[#000666] rounded-[10px] p-4 text-center">
              <p className="text-[11px] text-white/60 mb-1">월 납입금</p>
              <p className="text-[28px] font-bold text-white">
                {Math.round(selectedQuote.monthlyPayment / 10000).toLocaleString()}
                <span className="text-[14px] text-white/70 ml-1">만원</span>
              </p>
            </div>
            <DetailRow label="총 비용" value={formatKRWMan(selectedQuote.totalCost)} />
            <DetailRow label="세션 ID" value={selectedQuote.sessionId} />
            <DetailRow label="접수일" value={formatDateTimeKR(selectedQuote.createdAt)} />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[12px] text-[#6B7399]">{label}</span>
      <span className="text-[12px] font-medium text-[#1A1A2E]">{value}</span>
    </div>
  );
}
