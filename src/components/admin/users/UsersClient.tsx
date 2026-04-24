'use client';

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserCheck, Clock, Search, X,
  ChevronRight, Phone, CalendarDays,
  FileText, MessageSquare, AlertCircle, CheckCircle2,
  Sparkles, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AdminUserRecord, AdminUsersStats } from "@/lib/admin-queries";

// ─── 상태 매핑 ─────────────────────────────────────────
type UserStatusFilter = "전체" | "정상" | "휴면";
type ActiveFilter = "전체" | "진행중" | "없음";

const USER_STATUS_STYLE: Record<"active" | "dormant", { color: string; bg: string; label: string }> = {
  active:  { color: "#059669", bg: "#ECFDF5", label: "정상" },
  dormant: { color: "#D97706", bg: "#FFFBEB", label: "휴면" },
};

const QUOTE_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  상담대기: { color: "#9BA4C0", bg: "#F4F5F8" },
  상담중:   { color: "#000666", bg: "#E5E5FA" },
  계약완료: { color: "#059669", bg: "#ECFDF5" },
  계약취소: { color: "#DC2626", bg: "#FEF2F2" },
};

// ─── 유틸 ──────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function daysSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

// ─── 견적 상태 배지 ─────────────────────────────────────
function QuoteStatusBadge({ label }: { label: string }) {
  const s = QUOTE_STATUS_STYLE[label] ?? { color: "#9BA4C0", bg: "#F4F5F8" };
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {label}
    </span>
  );
}

// ─── 사용자 상세 패널 ────────────────────────────────────
function UserDetailPanel({
  user,
  onClose,
}: {
  user: AdminUserRecord;
  onClose: () => void;
}) {
  const statusStyle = USER_STATUS_STYLE[user.userStatus];

  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
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
              <p className="text-[11px] text-[#9BA4C0] mt-0.5">{user.phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9BA4C0] hover:bg-[#F4F5F8] hover:text-[#1A1A2E] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

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
                  <CalendarDays size={12} className="text-[#6B7399]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#9BA4C0]">최초 접수 / 최근 접수</p>
                  <p className="text-[13px] font-medium text-[#1A1A2E]">
                    {formatDate(user.firstContactAt)}
                    <span className="text-[#C0C5D8] mx-1.5">·</span>
                    <span className="text-[#6B7399]">{daysSince(user.lastContactAt)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 활동 통계 */}
          <div className="px-5 py-4 border-b border-[#F8F9FC]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-3">활동 통계</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "총 견적 건수",  value: user.consultationCount,           unit: "건", icon: FileText,      color: "#000666", bg: "#E5E5FA" },
                { label: "진행 중 항목",  value: user.activeItems.filter(i => i.statusRaw !== "CONVERTED").length, unit: "건", icon: TrendingUp, color: "#059669", bg: "#ECFDF5" },
              ].map((stat) => (
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

          {/* 견적 항목 */}
          <div className="px-5 py-4 border-b border-[#F8F9FC]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-3">
              견적 / 상담 이력
            </p>
            {user.activeItems.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-[#C0C5D8]">
                <CheckCircle2 size={14} className="text-[#D4D8EC]" />
                진행 항목 없음
              </div>
            ) : (
              <div className="space-y-2">
                {user.activeItems.map((item) => (
                  <Link
                    key={item.quoteId}
                    href={`/admin/quotations?id=${item.quoteId}`}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-[8px] bg-[#FAFBFF] border border-[#F0F2F8] hover:border-[#000666] hover:bg-white transition-all group/item"
                  >
                    <FileText size={12} className="text-[#9BA4C0] shrink-0 group-hover/item:text-[#000666]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#1A1A2E] truncate group-hover/item:text-[#000666]">
                        {item.vehicleName}
                      </p>
                      <p className="text-[10px] text-[#9BA4C0]">{item.quoteId}</p>
                    </div>
                    <QuoteStatusBadge label={item.statusLabel} />
                    <ChevronRight size={10} className="text-[#D4D8EC] group-hover/item:text-[#000666] ml-1" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 관리자 메모 */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9BA4C0] mb-2">관리자 메모</p>
            {user.internalMemo ? (
              <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A]">
                <AlertCircle size={12} className="text-[#D97706] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#78350F] leading-relaxed">{user.internalMemo}</p>
              </div>
            ) : (
              <p className="text-[12px] text-[#C0C5D8]">메모 없음</p>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div className="px-5 py-3.5 border-t border-[#F0F2F8] flex gap-2">
          <Link
            href={`/admin/quotations?search=${encodeURIComponent(user.name)}`}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-medium bg-[#000666] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <MessageSquare size={12} />
            상담 이력 이동
          </Link>
        </div>
      </motion.div>
    </>
  );
}

// ─── 메인 클라이언트 컴포넌트 ────────────────────────────
export default function UsersClient({
  users,
  stats,
}: {
  users: AdminUserRecord[];
  stats: AdminUsersStats;
}) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("전체");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("전체");
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);

  // URL ?search= 파라미터 연동
  useEffect(() => {
    const s = searchParams.get("search");
    if (s) {
      setSearch(s);
      const match = users.find((u) => u.name === s);
      if (match) setSelectedUser(match);
    }
  }, [searchParams, users]);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const KPI_LIST = [
    { label: "전체 고객",     value: stats.total,        unit: "명", icon: Users,     color: "#000666", bg: "#E5E5FA" },
    { label: "활성 고객",     value: stats.active,       unit: "명", icon: UserCheck, color: "#059669", bg: "#ECFDF5" },
    { label: "휴면 고객",     value: stats.dormant,      unit: "명", icon: Clock,     color: "#D97706", bg: "#FFFBEB" },
    { label: "이번 달 신규",  value: stats.newThisMonth, unit: "명", icon: Sparkles,  color: "#7C3AED", bg: "#F5F3FF" },
  ];

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      if (q && !u.name.includes(q) && !u.phone.replace(/-/g, "").includes(q)) return false;
      if (statusFilter === "정상" && u.userStatus !== "active") return false;
      if (statusFilter === "휴면" && u.userStatus !== "dormant") return false;
      const hasActive = u.activeItems.some((i) => i.statusRaw !== "CONVERTED");
      if (activeFilter === "진행중" && !hasActive) return false;
      if (activeFilter === "없음" && hasActive) return false;
      return true;
    });
  }, [users, search, statusFilter, activeFilter]);

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm rounded-[16px]">

      {/* 헤더 */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F4F5F8] rounded-[8px] text-[#000666]">
            <Users size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E]">사용자 관리</h1>
            <p className="text-[12px] text-[#6B7399] mt-1">{today} · 플랫폼 접수 고객 관리 및 상담 추적</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-5 scrollbar-hide">

        {/* KPI 카드 */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          {KPI_LIST.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-[12px] border border-[#E8EAF0] px-5 py-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#6B7399] mb-1">{kpi.label}</p>
                  <p className="text-[22px] font-bold text-[#1A1A2E] leading-none">
                    {kpi.value}
                    <span className="text-[12px] font-normal text-[#9BA4C0] ml-0.5">{kpi.unit}</span>
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ background: kpi.bg }}
                >
                  <Icon size={16} style={{ color: kpi.color }} strokeWidth={2.5} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 필터 & 검색 바 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] px-5 py-3.5 flex items-center gap-4 shadow-sm shrink-0">
          <div className="relative flex-1 max-w-[300px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 연락처로 검색"
              className="w-full pl-10 pr-4 py-2 text-[12px] bg-[#F4F5F8] border border-transparent rounded-[8px] focus:bg-white focus:border-[#000666] outline-none transition-all"
            />
          </div>

          <div className="w-px h-6 bg-[#E8EAF0]" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#9BA4C0] uppercase tracking-wider mr-1">계정 상태</span>
            {(["전체", "정상", "휴면"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-[6px] text-[11px] font-bold transition-all",
                  statusFilter === s
                    ? "bg-[#000666] text-white shadow-md shadow-blue-900/10"
                    : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-[#E8EAF0]" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#9BA4C0] uppercase tracking-wider mr-1">상담 진행</span>
            {(["전체", "진행중", "없음"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setActiveFilter(a)}
                className={cn(
                  "px-3 py-1.5 rounded-[6px] text-[11px] font-bold transition-all",
                  activeFilter === a
                    ? "bg-[#000666] text-white shadow-md shadow-blue-900/10"
                    : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                )}
              >
                {a}
              </button>
            ))}
          </div>

          <p className="ml-auto text-[11px] font-bold text-[#9BA4C0]">{filtered.length}명의 데이터 검색됨</p>
        </div>

        {/* 사용자 목록 테이블 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm flex flex-col flex-1 min-h-0 relative">
          {/* 헤더 */}
          <div
            className="grid border-b border-[#F0F2F8] px-6 py-3.5 bg-[#FAFBFF] sticky top-0 z-10"
            style={{ gridTemplateColumns: "1.8fr 1.5fr 1fr 0.8fr 1fr 1.8fr 1.2fr" }}
          >
            {["고객", "연락처", "상태", "견적 건수", "최초 접수", "진행 항목", "최근 접수"].map((col) => (
              <span key={col} className="text-[10px] font-black text-[#9BA4C0] uppercase tracking-widest">{col}</span>
            ))}
          </div>

          {/* 바디 */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F8F9FC]">
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#C0C5D8]">
                <Users size={32} strokeWidth={1} className="mb-3 opacity-40" />
                <p className="text-[13px] font-bold">아직 접수된 고객이 없습니다</p>
                <p className="text-[11px] mt-1">견적 신청 시 자동으로 등록됩니다.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#C0C5D8]">
                <Search size={32} strokeWidth={1} className="mb-3 opacity-40" />
                <p className="text-[13px] font-bold">검색 결과가 없습니다</p>
                <p className="text-[11px] mt-1">필터 조건을 변경하거나 검색어를 다시 확인해 주세요.</p>
              </div>
            ) : (
              filtered.map((user, idx) => {
                const statusStyle = USER_STATUS_STYLE[user.userStatus];
                const hasActive = user.activeItems.some((i) => i.statusRaw !== "CONVERTED");

                return (
                  <motion.div
                    key={user.phone}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedUser(user)}
                    className="grid items-center px-6 py-4 hover:bg-[#FAFBFF] transition-all cursor-pointer group relative"
                    style={{ gridTemplateColumns: "1.8fr 1.5fr 1fr 0.8fr 1fr 1.8fr 1.2fr" }}
                  >
                    {/* 고객 */}
                    <div className="flex items-center gap-3 pr-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#F4F5F8] flex items-center justify-center shrink-0 border border-[#E8EAF0] group-hover:border-[#000666] transition-colors">
                        <span className="text-[12px] font-black text-[#6B7399] group-hover:text-[#000666]">
                          {user.name[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1A1A2E] truncate">{user.name}</p>
                        <p className="text-[10px] text-[#9BA4C0]">{user.id.slice(0, 12)}…</p>
                      </div>
                    </div>

                    {/* 연락처 */}
                    <div className="text-[12px] font-medium text-[#4A5270] tabular-nums">{user.phone}</div>

                    {/* 상태 */}
                    <div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ color: statusStyle.color, background: statusStyle.bg }}
                      >
                        <div className="w-1 h-1 rounded-full" style={{ background: statusStyle.color }} />
                        {statusStyle.label}
                      </span>
                    </div>

                    {/* 견적 건수 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-[#1A1A2E] tabular-nums">{user.consultationCount}</span>
                      <span className="text-[10px] text-[#9BA4C0]">건</span>
                    </div>

                    {/* 최초 접수 */}
                    <div className="text-[11px] font-medium text-[#9BA4C0] tabular-nums">
                      {formatDate(user.firstContactAt)}
                    </div>

                    {/* 진행 항목 */}
                    <div className="min-w-0 pr-4">
                      {hasActive ? (
                        <div className="flex flex-col gap-1">
                          {user.activeItems
                            .filter((i) => i.statusRaw !== "CONVERTED")
                            .slice(0, 2)
                            .map((item) => (
                              <div key={item.quoteId} className="flex items-center gap-1.5 min-w-0">
                                <QuoteStatusBadge label={item.statusLabel} />
                                <span className="text-[10px] text-[#6B7399] truncate font-medium">
                                  {item.vehicleName.split(" ").slice(0, 3).join(" ")}
                                </span>
                              </div>
                            ))}
                          {user.activeItems.filter((i) => i.statusRaw !== "CONVERTED").length > 2 && (
                            <p className="text-[9px] text-[#B0B5CC] pl-1">
                              + {user.activeItems.filter((i) => i.statusRaw !== "CONVERTED").length - 2}건 더 있음
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#D4D8EC]">-</span>
                      )}
                    </div>

                    {/* 최근 접수 */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[#9BA4C0] tabular-nums">
                        {daysSince(user.lastContactAt)}
                      </span>
                      <ChevronRight size={14} className="text-[#D4D8EC] group-hover:text-[#000666] transition-all group-hover:translate-x-1" />
                    </div>
                  </motion.div>
                );
              })
            )}
            <div className="h-12 shrink-0" />
          </div>

          {/* 하단 페이드 */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 opacity-70" />
        </div>
      </div>

      {/* 하단 상태 바 */}
      <div className="bg-[#FAFBFF] border-t border-[#E8EAF0] px-6 py-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] text-[#6B7399]">
              전체 고객: <strong className="text-[#1A1A2E]">{stats.total}명</strong>
            </span>
          </div>
          <div className="w-px h-3 bg-[#E8EAF0]" />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#6B7399]">
              이번 달 신규: <strong className="text-[#7C3AED]">{stats.newThisMonth}명</strong>
            </span>
          </div>
        </div>
        <div className="text-[11px] font-bold text-[#B0B5CC] tracking-widest uppercase">
          실시간 DB · <span className="text-emerald-500">Live</span>
        </div>
      </div>

      {/* 상세 패널 */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
