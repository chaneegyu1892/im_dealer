export const dynamic = 'force-dynamic';
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, XCircle, AlertTriangle,
  Search, X, Phone, Mail, User, ToggleLeft, ToggleRight,
  TrendingUp, FileText, Percent, Star, Shield,
  ChevronRight, Edit2, BarChart2, Car, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_FINANCES,
  type FinanceCompanyRecord,
  type FinanceStatus,
} from "@/constants/mock-data";

// ─── 상태별 스타일 ───────────────────────────────────────────────
const STATUS_STYLE: Record<FinanceStatus, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  활성:   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2, label: "활성" },
  비활성: { bg: "bg-[#F4F5F8]",  text: "text-[#9BA4C0]",   border: "border-[#E8EAF0]",   icon: XCircle,      label: "비활성" },
  점검중: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: AlertTriangle, label: "점검중" },
};

const TABS = ["기본 정보", "정책 설정", "성과 지표"] as const;
type DrawerTab = typeof TABS[number];

function PercentBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 w-full bg-[#F0F2F8] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export default function FinancePage() {
  const [finances, setFinances] = useState<FinanceCompanyRecord[]>(MOCK_FINANCES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FinanceStatus | "전체">("전체");

  const [drawerFC, setDrawerFC] = useState<FinanceCompanyRecord | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("기본 정보");
  const [editMemo, setEditMemo] = useState("");

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const filtered = useMemo(() => finances.filter(fc => {
    const matchSearch = fc.name.includes(search);
    const matchStatus = statusFilter === "전체" || fc.status === statusFilter;
    return matchSearch && matchStatus;
  }), [finances, search, statusFilter]);

  const activeCount   = finances.filter(f => f.status === "활성").length;
  const inactiveCount = finances.filter(f => f.status === "비활성").length;
  const checkCount    = finances.filter(f => f.status === "점검중").length;
  const totalContracts = finances.reduce((s, f) => s + f.totalContracts, 0);

  const openDrawer = (fc: FinanceCompanyRecord) => {
    setDrawerFC(fc);
    setDrawerTab("기본 정보");
    setEditMemo(fc.memo);
  };

  const toggleStatus = (id: string) => {
    setFinances(prev => prev.map(f => {
      if (f.id !== id) return f;
      const next: FinanceStatus = f.status === "활성" ? "비활성" : "활성";
      return { ...f, status: next };
    }));
    if (drawerFC?.id === id) {
      setDrawerFC(prev => prev ? { ...prev, status: prev.status === "활성" ? "비활성" : "활성" } : prev);
    }
  };

  const saveMemo = (id: string) => {
    setFinances(prev => prev.map(f => f.id === id ? { ...f, memo: editMemo } : f));
    if (drawerFC?.id === id) setDrawerFC(prev => prev ? { ...prev, memo: editMemo } : prev);
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 shrink-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-[#8890AA]">{today}</p>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] mt-0.5 flex items-center gap-2">
              <Building2 size={18} className="text-[#000666]" strokeWidth={2} />
              금융사 관리
            </h1>
            <p className="text-[12px] text-[#6B7399] mt-1">제휴 캐피탈사별 정책과 성과를 통합 관리합니다.</p>
          </div>

          {/* KPI 칩 */}
          <div className="flex items-center gap-0 divide-x divide-[#E8EAF0]">
            <KPIChip icon={<Building2 size={14} className="text-[#000666]" />} label="전체 금융사" value={finances.length} unit="개사" bg="bg-[#E5E5FA]" />
            <KPIChip icon={<CheckCircle2 size={14} className="text-emerald-600" />} label="활성" value={activeCount} unit="개사" bg="bg-emerald-50" valueColor="text-emerald-700" />
            <KPIChip icon={<AlertTriangle size={14} className="text-amber-500" />} label="점검중" value={checkCount} unit="개사" bg="bg-amber-50" valueColor="text-amber-700" />
            <KPIChip icon={<FileText size={14} className="text-[#6B7399]" />} label="누적 계약" value={totalContracts} unit="건" bg="bg-[#F4F5F8]" valueColor="text-[#1A1A2E]" />
          </div>
        </div>

        {/* 툴바 */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="금융사명 검색"
              className="w-[200px] pl-9 pr-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E] shadow-sm transition-colors"
            />
          </div>
          <div className="flex bg-white rounded-[6px] border border-[#E8EAF0] p-1 shadow-sm">
            {(["전체", "활성", "점검중", "비활성"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 text-[11px] font-medium rounded-[4px] transition-colors",
                  statusFilter === s ? "bg-[#F4F5F8] text-[#1A1A2E]" : "text-[#9BA4C0] hover:text-[#6B7399]"
                )}>
                {s}
              </button>
            ))}
          </div>
          {(search || statusFilter !== "전체") && (
            <button onClick={() => { setSearch(""); setStatusFilter("전체"); }}
              className="flex items-center gap-1 text-[11px] text-[#9BA4C0] hover:text-[#6B7399] transition-colors">
              <X size={11} /> 초기화
            </button>
          )}
          <span className="ml-auto text-[11px] text-[#9BA4C0]">{filtered.length}개사 표시</span>
        </div>
      </div>

      {/* ── 금융사 카드 그리드 ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-[#9BA4C0]">
            <Building2 size={40} strokeWidth={1} className="mb-3 opacity-40" />
            <p className="text-[13px]">조건에 맞는 금융사가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(fc => {
              const S = STATUS_STYLE[fc.status];
              const SIcon = S.icon;
              return (
                <motion.div
                  key={fc.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group bg-white rounded-[14px] border border-[#E8EAF0] p-5 cursor-pointer hover:border-[#000666]/30 hover:shadow-md transition-all"
                  onClick={() => openDrawer(fc)}
                >
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* 금융사 이니셜 아바타 */}
                      <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-white text-[13px] font-black shrink-0 shadow-sm"
                        style={{ backgroundColor: fc.color }}>
                        {fc.shortName.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-[14px] font-bold text-[#1A1A2E]">{fc.name}</h3>
                        <div className={cn("inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", S.bg, S.text, S.border)}>
                          <SIcon size={10} strokeWidth={2.5} />
                          {S.label}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[#D0D4E8] group-hover:text-[#000666] transition-colors mt-1 shrink-0" />
                  </div>

                  {/* 주요 지표 */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#9BA4C0]">심사 승인율</span>
                        <span className="font-bold text-[#1A1A2E]">{fc.approvalRate}%</span>
                      </div>
                      <PercentBar value={fc.approvalRate} color={fc.color} />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#9BA4C0]">견적 점유율</span>
                        <span className="font-bold text-[#1A1A2E]">{fc.quoteShare}%</span>
                      </div>
                      <PercentBar value={fc.quoteShare} color={fc.color} max={40} />
                    </div>
                  </div>

                  {/* 카드 푸터 */}
                  <div className="mt-4 pt-4 border-t border-[#F0F2F8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-[#1A1A2E]">{fc.totalContracts}</p>
                        <p className="text-[10px] text-[#9BA4C0]">누적 계약</p>
                      </div>
                      <div className="w-px h-7 bg-[#F0F2F8]" />
                      <div className="text-center">
                        <p className="text-[18px] font-bold" style={{ color: fc.color }}>{fc.recentContracts}</p>
                        <p className="text-[10px] text-[#9BA4C0]">최근 30일</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      {fc.policy.rentAvailable && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#E5E5FA] text-[#000666] rounded-[4px]">렌트</span>
                      )}
                      {fc.policy.leaseAvailable && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-[4px]">리스</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 상세 Drawer ─────────────────────────────────────── */}
      <AnimatePresence>
        {drawerFC && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerFC(null)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-[480px] bg-white z-50 flex flex-col border-l border-[#E8EAF0] shadow-[-12px_0_40px_rgba(0,0,0,0.08)]"
            >
              {/* Drawer 헤더 */}
              <div className="px-6 py-5 border-b border-[#E8EAF0] shrink-0"
                style={{ background: `linear-gradient(135deg, ${drawerFC.color}10 0%, white 60%)` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white text-[14px] font-black shadow-md"
                      style={{ backgroundColor: drawerFC.color }}>
                      {drawerFC.shortName.slice(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#1A1A2E]">{drawerFC.name}</h2>
                      <span className="text-[11px] text-[#9BA4C0]">등록일: {drawerFC.registeredAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 상태 토글 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(drawerFC.id); }}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-bold border transition-all",
                        drawerFC.status === "활성"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-[#F4F5F8] text-[#9BA4C0] border-[#E8EAF0]"
                      )}>
                      {drawerFC.status === "활성"
                        ? <ToggleRight size={15} className="text-emerald-600" />
                        : <ToggleLeft size={15} />}
                      {drawerFC.status}
                    </button>
                    <button onClick={() => setDrawerFC(null)} className="p-1.5 text-[#9BA4C0] hover:bg-[#F4F5F8] rounded-[6px] transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* 탭 */}
                <div className="flex gap-1 bg-[#F4F5F8] rounded-[8px] p-1">
                  {TABS.map(tab => (
                    <button key={tab} onClick={() => setDrawerTab(tab)}
                      className={cn("flex-1 py-1.5 text-[12px] font-semibold rounded-[6px] transition-all",
                        drawerTab === tab ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#9BA4C0] hover:text-[#6B7399]"
                      )}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer 콘텐츠 */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <AnimatePresence mode="wait">

                  {/* 탭 1: 기본 정보 */}
                  {drawerTab === "기본 정보" && (
                    <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="space-y-5">
                      {/* 담당자 */}
                      <section>
                        <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <User size={12} /> 담당자 (PIC) 정보
                        </h3>
                        <div className="bg-[#F8F9FC] rounded-[10px] border border-[#E8EAF0] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#9BA4C0]">이름 / 직책</span>
                            <span className="text-[13px] font-bold text-[#1A1A2E]">
                              {drawerFC.pic.name} <span className="text-[11px] font-normal text-[#6B7399]">({drawerFC.pic.role})</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#9BA4C0] flex items-center gap-1"><Phone size={11} /> 연락처</span>
                            <a href={`tel:${drawerFC.pic.phone}`} className="text-[13px] font-medium text-[#000666] hover:underline">{drawerFC.pic.phone}</a>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#9BA4C0] flex items-center gap-1"><Mail size={11} /> 이메일</span>
                            <a href={`mailto:${drawerFC.pic.email}`} className="text-[12px] font-medium text-[#000666] hover:underline">{drawerFC.pic.email}</a>
                          </div>
                        </div>
                      </section>

                      {/* 운영 메모 */}
                      <section>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider flex items-center gap-1.5">
                            <Edit2 size={12} /> 운영 메모
                          </h3>
                        </div>
                        <textarea
                          value={editMemo}
                          onChange={e => setEditMemo(e.target.value)}
                          rows={5}
                          placeholder="이 금융사에 대한 특이사항이나 운영 메모를 기록하세요."
                          className="w-full px-3 py-3 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#C0C5DC] text-[#4A5270] resize-none leading-relaxed"
                        />
                        {editMemo !== drawerFC.memo && (
                          <button onClick={() => saveMemo(drawerFC.id)}
                            className="mt-2 px-4 py-1.5 text-[12px] font-semibold text-white bg-[#000666] rounded-[6px] hover:opacity-90 transition-opacity">
                            메모 저장
                          </button>
                        )}
                      </section>
                    </motion.div>
                  )}

                  {/* 탭 2: 정책 설정 */}
                  {drawerTab === "정책 설정" && (
                    <motion.div key="policy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="space-y-5">
                      {/* 상품 취급 */}
                      <section>
                        <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Shield size={12} /> 취급 상품
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <ProductCard label="장기렌트" available={drawerFC.policy.rentAvailable} color={drawerFC.color} />
                          <ProductCard label="리스" available={drawerFC.policy.leaseAvailable} color={drawerFC.color} />
                        </div>
                      </section>

                      {/* 정책 수치 */}
                      <section>
                        <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Percent size={12} /> 정책 조건
                        </h3>
                        <div className="bg-[#F8F9FC] rounded-[10px] border border-[#E8EAF0] divide-y divide-[#F0F2F8]">
                          {[
                            { label: "딜러 수수료율", value: `${drawerFC.policy.agencyFeeRate}%`, highlight: true },
                            { label: "선호 계약 기간", value: `${drawerFC.policy.preferredTerm}개월` },
                            { label: "선호 선납금", value: `${drawerFC.policy.preferredDeposit}%` },
                            { label: "최대 승인 한도", value: `${drawerFC.policy.maxApprovalAmount.toLocaleString()}만원` },
                          ].map(row => (
                            <div key={row.label} className="flex items-center justify-between px-4 py-3">
                              <span className="text-[12px] text-[#6B7399]">{row.label}</span>
                              <span className={cn("text-[13px] font-bold", row.highlight ? "text-[#000666]" : "text-[#1A1A2E]")}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* 특판 차종 */}
                      {drawerFC.policy.specialVehicles.length > 0 && (
                        <section>
                          <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Star size={12} /> 특판 차종
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {drawerFC.policy.specialVehicles.map(v => (
                              <span key={v} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E5E5FA] text-[#000666] rounded-[6px] text-[12px] font-bold">
                                <Car size={12} /> {v}
                              </span>
                            ))}
                          </div>
                        </section>
                      )}
                    </motion.div>
                  )}

                  {/* 탭 3: 성과 지표 */}
                  {drawerTab === "성과 지표" && (
                    <motion.div key="perf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="space-y-5">

                      <div className="grid grid-cols-2 gap-4">
                        <StatCard label="누적 계약 건수" value={`${drawerFC.totalContracts}건`} sub="서비스 시작 이후" color={drawerFC.color} icon={FileText} />
                        <StatCard label="최근 30일 계약" value={`${drawerFC.recentContracts}건`} sub="활성 상태 기준" color={drawerFC.color} icon={Clock} />
                      </div>

                      <section>
                        <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <TrendingUp size={12} /> 핵심 성과 지표
                        </h3>
                        <div className="space-y-4">
                          <PerformanceRow label="심사 승인율" value={drawerFC.approvalRate} max={100} color={drawerFC.color} unit="%" />
                          <PerformanceRow label="전체 견적 점유율" value={drawerFC.quoteShare} max={40} color={drawerFC.color} unit="%" />
                        </div>
                      </section>

                      <section>
                        <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <BarChart2 size={12} /> 전체 금융사 대비 순위
                        </h3>
                        <div className="space-y-2">
                          {[...MOCK_FINANCES].sort((a, b) => b.approvalRate - a.approvalRate).map((f, idx) => (
                            <div key={f.id} className={cn("flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors",
                              f.id === drawerFC.id ? "bg-[#E5E5FA]" : "hover:bg-[#F8F9FC]"
                            )}>
                              <span className="text-[11px] font-black text-[#9BA4C0] w-4">{idx + 1}</span>
                              <div className="w-5 h-5 rounded-[4px] shrink-0" style={{ backgroundColor: f.color }} />
                              <span className="text-[12px] font-medium text-[#4A5270] flex-1">{f.name}</span>
                              <span className={cn("text-[12px] font-bold", f.id === drawerFC.id ? "text-[#000666]" : "text-[#9BA4C0]")}>{f.approvalRate}%</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────────

function KPIChip({ icon, label, value, unit, bg, valueColor = "text-[#000666]" }: {
  icon: React.ReactNode; label: string; value: number; unit: string; bg: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 first:pl-0 last:pr-0">
      <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0", bg)}>{icon}</div>
      <div>
        <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">{label}</p>
        <p className={cn("text-[20px] font-bold leading-none tracking-tight", valueColor)}>
          {value}<span className="text-[11px] font-normal text-[#9BA4C0] ml-0.5">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function ProductCard({ label, available, color }: { label: string; available: boolean; color: string }) {
  return (
    <div className={cn("rounded-[10px] border p-4 flex items-center gap-3 transition-all",
      available ? "bg-white border-[#E8EAF0]" : "bg-[#F4F5F8] border-[#F0F2F8] opacity-50"
    )}>
      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center"
        style={{ backgroundColor: available ? color + "20" : "#F0F2F8" }}>
        {available
          ? <CheckCircle2 size={16} style={{ color }} />
          : <XCircle size={16} className="text-[#C0C5DC]" />}
      </div>
      <div>
        <p className={cn("text-[13px] font-bold", available ? "text-[#1A1A2E]" : "text-[#9BA4C0]")}>{label}</p>
        <p className="text-[10px]" style={{ color: available ? color : "#9BA4C0" }}>
          {available ? "취급 가능" : "미취급"}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-[#F8F9FC] rounded-[10px] border border-[#E8EAF0] p-4">
      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-3" style={{ backgroundColor: color + "20" }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
      <p className="text-[12px] font-semibold text-[#1A1A2E] mt-0.5">{label}</p>
      <p className="text-[11px] text-[#9BA4C0] mt-0.5">{sub}</p>
    </div>
  );
}

function PerformanceRow({ label, value, max, color, unit }: {
  label: string; value: number; max: number; color: string; unit: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="text-[#6B7399] font-medium">{label}</span>
        <span className="font-bold text-[#1A1A2E]">{value}{unit}</span>
      </div>
      <PercentBar value={value} color={color} max={max} />
    </div>
  );
}
