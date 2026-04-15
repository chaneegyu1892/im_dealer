"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserCheck, UserX, Clock, Search, Filter, X,
  ChevronRight, Phone, Mail, CalendarDays, TrendingUp,
  FileText, Download, MessageSquare, AlertCircle, CheckCircle2,
  Eye, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_USERS,
  USER_STATS,
  type UserRecord,
  type UserStatus,
  type QuoteStatus,
} from "@/constants/mock-data";

// ─── 상태 색상 매핑 ────────────────────────────────────────────
const USER_STATUS_STYLE: Record<UserStatus, { color: string; bg: string; label: string }> = {
  정상: { color: "#059669", bg: "#ECFDF5", label: "정상" },
  휴면: { color: "#D97706", bg: "#FFFBEB", label: "휴면" },
  탈퇴: { color: "#DC2626", bg: "#FEF2F2", label: "탈퇴" },
};

const QUOTE_STATUS_STYLE: Record<QuoteStatus, { color: string; bg: string }> = {
  상담대기: { color: "#9BA4C0", bg: "#F4F5F8" },
  상담중:   { color: "#000666", bg: "#E5E5FA" },
  계약완료: { color: "#059669", bg: "#ECFDF5" },
  계약취소: { color: "#DC2626", bg: "#FEF2F2" },
};

// ─── KPI 통계 카드 데이터 ──────────────────────────────────────
const KPI_LIST = [
  { label: "전체 사용자",   value: USER_STATS.total,       unit: "명", icon: Users,      color: "#000666", bg: "#E5E5FA" },
  { label: "활성 사용자",   value: USER_STATS.active,      unit: "명", icon: UserCheck,  color: "#059669", bg: "#ECFDF5" },
  { label: "휴면 사용자",   value: USER_STATS.dormant,     unit: "명", icon: Clock,      color: "#D97706", bg: "#FFFBEB" },
  { label: "탈퇴 사용자",   value: USER_STATS.withdrawn,   unit: "명", icon: UserX,      color: "#DC2626", bg: "#FEF2F2" },
  { label: "이번 달 신규",  value: USER_STATS.newThisMonth,unit: "명", icon: Sparkles,   color: "#7C3AED", bg: "#F5F3FF" },
];

// ─── 유틸 ─────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

// ─── 활성 항목 상태 배지 ──────────────────────────────────────
function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const s = QUOTE_STATUS_STYLE[status];
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  );
}

// ─── 사용자 상세 슬라이드오버 ─────────────────────────────────
function UserDetailPanel({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const statusStyle = USER_STATUS_STYLE[user.status];

  return (
    <>
      {/* 백드롭 */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      {/* 패널 */}
      <motion.div
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2F8]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #000666, #6066EE)" }}
            >
              {user.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-[#1A1A2E]">{user.name}</p>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                  style={{ color: statusStyle.color, background: statusStyle.bg }}
                >
                  {statusStyle.label}
                </span>
              </div>
              <p className="text-[11px] text-[#9BA4C0] mt-0.5">{user.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9BA4C0] hover:bg-[#F4F5F8] hover:text-[#1A1A2E] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* 스크롤 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 연락처 정보 */}
          <div className="px-5 py-4 border-b border-[#F8F9FC]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-3">연락처 정보</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[6px] bg-[#F4F5F8] flex items-center justify-center shrink-0">
                  <Phone size={12} className="text-[#6B7399]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#9BA4C0]">휴대폰</p>
                  <p className="text-[13px] font-medium text-[#1A1A2E]">{user.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[6px] bg-[#F4F5F8] flex items-center justify-center shrink-0">
                  <Mail size={12} className="text-[#6B7399]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#9BA4C0]">이메일</p>
                  <p className="text-[13px] font-medium text-[#1A1A2E]">
                    {user.email || <span className="text-[#C0C5D8]">미등록</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[6px] bg-[#F4F5F8] flex items-center justify-center shrink-0">
                  <CalendarDays size={12} className="text-[#6B7399]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#9BA4C0]">가입일 / 마지막 로그인</p>
                  <p className="text-[13px] font-medium text-[#1A1A2E]">
                    {formatDate(user.joinedAt)}
                    <span className="text-[#C0C5D8] mx-1.5">·</span>
                    <span className="text-[#6B7399]">{daysSince(user.lastLoginAt)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 활동 통계 */}
          <div className="px-5 py-4 border-b border-[#F8F9FC]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-3">활동 통계</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: "견적 조회", value: user.quoteViewCount, unit: "회", icon: Eye, color: "#D97706", bg: "#FFFBEB" },
                { label: "상담 신청", value: user.consultationCount, unit: "건", icon: MessageSquare, color: "#000666", bg: "#E5E5FA" },
                { label: "PDF 저장", value: user.pdfDownloadCount, unit: "건", icon: Download, color: "#7C3AED", bg: "#F5F3FF" },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-[10px] p-3 flex flex-col gap-1.5"
                  style={{ background: stat.bg }}
                >
                  <stat.icon size={13} style={{ color: stat.color }} strokeWidth={2} />
                  <p className="text-[20px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[10px] text-[#9BA4C0]">{stat.label} ({stat.unit})</p>
                </div>
              ))}
            </div>
          </div>

          {/* 진행 중인 항목 */}
          <div className="px-5 py-4 border-b border-[#F8F9FC]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-3">
              진행 중인 상담 / 계약
            </p>
            {user.activeItems.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-[#C0C5D8]">
                <CheckCircle2 size={14} className="text-[#D4D8EC]" />
                진행 중인 항목 없음
              </div>
            ) : (
              <div className="space-y-2">
                {user.activeItems.map(item => (
                  <div
                    key={item.quoteId}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-[8px] bg-[#FAFBFF] border border-[#F0F2F8]"
                  >
                    <FileText size={12} className="text-[#9BA4C0] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#1A1A2E] truncate">{item.vehicleName}</p>
                      <p className="text-[10px] text-[#9BA4C0]">{item.quoteId}</p>
                    </div>
                    <QuoteStatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 관리자 메모 */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-2">관리자 메모</p>
            {user.memo ? (
              <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A]">
                <AlertCircle size={12} className="text-[#D97706] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#78350F] leading-relaxed">{user.memo}</p>
              </div>
            ) : (
              <p className="text-[12px] text-[#C0C5D8]">메모 없음</p>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="px-5 py-3.5 border-t border-[#F0F2F8] flex gap-2">
          <button className="flex-1 py-2 rounded-[8px] text-[12px] font-medium bg-[#000666] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
            <MessageSquare size={12} />
            상담 이동
          </button>
          <button className="py-2 px-3.5 rounded-[8px] text-[12px] font-medium bg-[#F4F5F8] text-[#4A5270] hover:bg-[#EAEDF5] transition-colors flex items-center gap-1.5">
            <TrendingUp size={12} />
            기록 보기
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "전체">("전체");
  const [activeFilter, setActiveFilter] = useState<"전체" | "진행중" | "없음">("전체");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const filtered = useMemo(() => {
    return MOCK_USERS.filter(u => {
      const q = search.trim().toLowerCase();
      if (q && !u.name.includes(q) && !u.phone.replace(/-/g, "").includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (statusFilter !== "전체" && u.status !== statusFilter) return false;
      if (activeFilter === "진행중" && u.activeItems.length === 0) return false;
      if (activeFilter === "없음" && u.activeItems.length > 0) return false;
      return true;
    });
  }, [search, statusFilter, activeFilter]);

  return (
    <div className="p-5 flex flex-col gap-3.5" style={{ minHeight: "100vh" }}>

      {/* ── 헤더 ──────────────────────────────────────── */}
      <div>
        <p className="text-[11px] text-[#8890AA]">{today}</p>
        <h1 className="text-[20px] font-semibold text-[#1A1A2E] leading-tight">사용자 관리</h1>
      </div>

      {/* ── KPI 카드 ────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {KPI_LIST.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-[12px] border border-[#E8EAF0] px-4 py-3.5"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-[#6B7399] truncate pr-1">{kpi.label}</p>
                <span className="w-6 h-6 rounded-[5px] flex items-center justify-center shrink-0" style={{ background: kpi.bg }}>
                  <Icon size={12} style={{ color: kpi.color }} strokeWidth={2} />
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[22px] font-bold text-[#1A1A2E] leading-none">{kpi.value}</span>
                <span className="text-[11px] text-[#9BA4C0] ml-0.5">{kpi.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 필터 & 검색 바 ────────────────────────────── */}
      <div
        className="bg-white rounded-[12px] border border-[#E8EAF0] px-4 py-3 flex items-center gap-3"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* 검색 */}
        <div className="relative flex-1 max-w-[280px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 전화번호, 이메일 검색"
            className="w-full pl-8 pr-3 py-1.5 rounded-[7px] bg-[#F4F5F8] text-[12px] text-[#1A1A2E] placeholder-[#B0B5CC] border border-transparent focus:border-[#000666] focus:outline-none transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B0B5CC] hover:text-[#6B7399]">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-[#E8EAF0]" />

        {/* 계정 상태 필터 */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={12} className="text-[#9BA4C0]" />
          <span className="text-[11px] text-[#9BA4C0]">상태</span>
          {(["전체", "정상", "휴면", "탈퇴"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all duration-150",
                statusFilter === s
                  ? "bg-[#000666] text-white"
                  : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#EAEDF5]"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E8EAF0]" />

        {/* 진행중 여부 필터 */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-[#9BA4C0]" />
          <span className="text-[11px] text-[#9BA4C0]">상담</span>
          {(["전체", "진행중", "없음"] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all duration-150",
                activeFilter === f
                  ? "bg-[#000666] text-white"
                  : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#EAEDF5]"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="ml-auto text-[11px] text-[#9BA4C0] shrink-0">
          {filtered.length}명 표시 중
        </p>
      </div>

      {/* ── 사용자 목록 테이블 ────────────────────────── */}
      <div
        className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* 테이블 헤더 */}
        <div className="grid border-b border-[#F0F2F8] px-4 py-2.5 bg-[#FAFBFF]"
          style={{ gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1.5fr 1fr" }}
        >
          {["사용자", "연락처", "상태", "견적 조회", "상담", "PDF", "진행 항목", "마지막 접속"].map(col => (
            <span key={col} className="text-[10px] font-semibold text-[#9BA4C0] uppercase tracking-wide">{col}</span>
          ))}
        </div>

        {/* 테이블 바디 */}
        <div className="divide-y divide-[#F8F9FC]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#C0C5D8]">
              <Users size={28} strokeWidth={1.5} className="mb-2" />
              <p className="text-[13px]">검색 결과가 없습니다</p>
            </div>
          ) : (
            filtered.map((user, idx) => {
              const statusStyle = USER_STATUS_STYLE[user.status];
              const hasActive = user.activeItems.length > 0;
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.03 }}
                  onClick={() => setSelectedUser(user)}
                  className="grid items-center px-4 py-3 cursor-pointer hover:bg-[#FAFBFF] transition-colors group"
                  style={{ gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1.5fr 1fr" }}
                >
                  {/* 사용자 */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #000666, #6066EE)" }}
                    >
                      {user.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#1A1A2E] truncate">{user.name}</p>
                      <p className="text-[10px] text-[#9BA4C0] truncate">{user.id}</p>
                    </div>
                  </div>

                  {/* 연락처 */}
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#3D4470] truncate">{user.phone}</p>
                    <p className="text-[10px] text-[#B0B5CC] truncate">{user.email || "-"}</p>
                  </div>

                  {/* 상태 */}
                  <div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                      style={{ color: statusStyle.color, background: statusStyle.bg }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  {/* 견적 조회 */}
                  <div className="flex items-center gap-1">
                    <Eye size={10} className="text-[#D97706]" />
                    <span className="text-[12px] font-semibold text-[#1A1A2E]">{user.quoteViewCount}</span>
                    <span className="text-[10px] text-[#9BA4C0]">회</span>
                  </div>

                  {/* 상담 */}
                  <div className="flex items-center gap-1">
                    <MessageSquare size={10} className="text-[#000666]" />
                    <span className="text-[12px] font-semibold text-[#1A1A2E]">{user.consultationCount}</span>
                    <span className="text-[10px] text-[#9BA4C0]">건</span>
                  </div>

                  {/* PDF */}
                  <div className="flex items-center gap-1">
                    <Download size={10} className="text-[#7C3AED]" />
                    <span className="text-[12px] font-semibold text-[#1A1A2E]">{user.pdfDownloadCount}</span>
                    <span className="text-[10px] text-[#9BA4C0]">건</span>
                  </div>

                  {/* 진행 항목 */}
                  <div className="min-w-0">
                    {hasActive ? (
                      <div className="space-y-0.5">
                        {user.activeItems.map(item => (
                          <div key={item.quoteId} className="flex items-center gap-1.5">
                            <QuoteStatusBadge status={item.status} />
                            <span className="text-[10px] text-[#6B7399] truncate">{item.vehicleName.split(" ").slice(0, 3).join(" ")}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#D4D8EC]">-</span>
                    )}
                  </div>

                  {/* 마지막 접속 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#9BA4C0]">{daysSince(user.lastLoginAt)}</span>
                    <ChevronRight
                      size={12}
                      className="text-[#D4D8EC] group-hover:text-[#000666] transition-colors"
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 사용자 상세 슬라이드오버 ─────────────────── */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
