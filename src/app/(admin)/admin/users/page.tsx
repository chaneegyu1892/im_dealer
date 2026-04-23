'use client';

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserCheck, UserX, Clock, Search, X,
  ChevronRight, Phone, Mail, CalendarDays, TrendingUp,
  FileText, Download, MessageSquare, AlertCircle, CheckCircle2,
  Eye, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── 타입 정의 ────────────────────────────────────────────────
type UserStatus = "정상" | "휴면" | "탈퇴";
type ActiveItemStatus = "상담대기" | "상담중" | "계약완료" | "계약취소";

interface UserActiveItem {
  quoteId: string;
  vehicleName: string;
  status: ActiveItemStatus;
}

interface UserRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;
  lastLoginAt: string;
  status: UserStatus;
  quoteViewCount: number;
  consultationCount: number;
  pdfDownloadCount: number;
  activeItems: UserActiveItem[];
  memo: string;
}

interface UserStats {
  total: number;
  active: number;
  dormant: number;
  withdrawn: number;
  newThisMonth: number;
}

// ─── 상태 색상 매핑 ────────────────────────────────────────────
const USER_STATUS_STYLE: Record<UserStatus, { color: string; bg: string; label: string }> = {
  정상: { color: "#059669", bg: "#ECFDF5", label: "정상" },
  휴면: { color: "#D97706", bg: "#FFFBEB", label: "휴면" },
  탈퇴: { color: "#DC2626", bg: "#FEF2F2", label: "탈퇴" },
};

const ACTIVE_STATUS_STYLE: Record<ActiveItemStatus, { color: string; bg: string }> = {
  상담대기: { color: "#9BA4C0", bg: "#F4F5F8" },
  상담중:   { color: "#000666", bg: "#E5E5FA" },
  계약완료: { color: "#059669", bg: "#ECFDF5" },
  계약취소: { color: "#DC2626", bg: "#FEF2F2" },
};

// ─── 유틸 ─────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

function daysSince(dateStr: string) {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

// ─── 활성 항목 상태 배지 ──────────────────────────────────────
function ActiveStatusBadge({ status }: { status: ActiveItemStatus }) {
  const s = ACTIVE_STATUS_STYLE[status];
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
              <p className="text-[11px] text-[#9BA4C0] mt-0.5">{user.id.slice(0, 8)}…</p>
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
                { label: "저장 견적", value: user.quoteViewCount, unit: "건", icon: Eye, color: "#D97706", bg: "#FFFBEB" },
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
              최근 저장 견적
            </p>
            {user.activeItems.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-[#C0C5D8]">
                <CheckCircle2 size={14} className="text-[#D4D8EC]" />
                저장된 견적 없음
              </div>
            ) : (
              <div className="space-y-2">
                {user.activeItems.map(item => (
                  <Link
                    key={item.quoteId}
                    href={`/admin/quotations?id=${item.quoteId}`}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-[8px] bg-[#FAFBFF] border border-[#F0F2F8] hover:border-[#000666] hover:bg-white transition-all group/item"
                  >
                    <FileText size={12} className="text-[#9BA4C0] shrink-0 group-hover/item:text-[#000666]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#1A1A2E] truncate group-hover/item:text-[#000666]">{item.vehicleName}</p>
                      <p className="text-[10px] text-[#9BA4C0]">{item.quoteId.slice(0, 12)}…</p>
                    </div>
                    <ActiveStatusBadge status={item.status} />
                    <ChevronRight size={10} className="text-[#D4D8EC] group-hover/item:text-[#000666] ml-1" />
                  </Link>
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
          <Link
            href={`/admin/quotations?search=${encodeURIComponent(user.email)}`}
            className="flex-1 py-2 rounded-[8px] text-[12px] font-medium bg-[#000666] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <MessageSquare size={12} />
            견적 이력 이동
          </Link>
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
function UsersContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, dormant: 0, withdrawn: 0, newThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<UserStatus | "전체">("전체");
  const [activeFilter, setActiveFilter] = useState<"전체" | "견적있음" | "없음">("전체");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setUsers(json.data.users);
          setStats(json.data.stats);
          if (initialSearch) {
            const found = (json.data.users as UserRecord[]).find(u => u.name === initialSearch || u.email === initialSearch);
            if (found) setSelectedUser(found);
          }
        }
      })
      .catch(err => console.error("[users page] fetch error:", err))
      .finally(() => setLoading(false));
  }, [initialSearch]);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const kpiList = [
    { label: "전체 사용자",  value: stats.total,        unit: "명", icon: Users,     color: "#000666", bg: "#E5E5FA" },
    { label: "활성 사용자",  value: stats.active,       unit: "명", icon: UserCheck, color: "#059669", bg: "#ECFDF5" },
    { label: "휴면 사용자",  value: stats.dormant,      unit: "명", icon: Clock,     color: "#D97706", bg: "#FFFBEB" },
    { label: "탈퇴 사용자",  value: stats.withdrawn,    unit: "명", icon: UserX,     color: "#DC2626", bg: "#FEF2F2" },
    { label: "이번 달 신규", value: stats.newThisMonth, unit: "명", icon: Sparkles,  color: "#7C3AED", bg: "#F5F3FF" },
  ];

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.trim().toLowerCase();
      if (q && !u.name.toLowerCase().includes(q) && !u.phone.replace(/-/g, "").includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (statusFilter !== "전체" && u.status !== statusFilter) return false;
      if (activeFilter === "견적있음" && u.quoteViewCount === 0) return false;
      if (activeFilter === "없음" && u.quoteViewCount > 0) return false;
      return true;
    });
  }, [users, search, statusFilter, activeFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F4F5F8] rounded-[8px] text-[#000666]">
            <Users size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E]">사용자 관리</h1>
            <p className="text-[12px] text-[#6B7399] mt-1">{today} · 플랫폼 가입 사용자 관리 및 활동 추적</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-5 scrollbar-hide">
        {/* ── KPI 5개 ── */}
        <div className="grid grid-cols-5 gap-4 shrink-0">
          {kpiList.map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-[12px] border border-[#E8EAF0] px-5 py-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#6B7399] mb-1">{kpi.label}</p>
                  <p className="text-[22px] font-bold text-[#1A1A2E] leading-none">
                    {loading ? <span className="text-[#C0C5D8]">…</span> : kpi.value}
                    <span className="text-[12px] font-normal text-[#9BA4C0] ml-0.5">{kpi.unit}</span>
                  </p>
                </div>
                <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: kpi.bg }}>
                  <Icon size={16} style={{ color: kpi.color }} strokeWidth={2.5} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 필터 & 검색 바 ── */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] px-5 py-3.5 flex items-center gap-4 shadow-sm shrink-0">
          <div className="relative flex-1 max-w-[320px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 연락처, 이메일로 검색"
              className="w-full pl-10 pr-4 py-2 text-[12px] bg-[#F4F5F8] border border-transparent rounded-[8px] focus:bg-white focus:border-[#000666] outline-none transition-all"
            />
          </div>

          <div className="w-px h-6 bg-[#E8EAF0]" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#9BA4C0] uppercase tracking-wider mr-1">계정 상태</span>
            {(["전체", "정상", "휴면", "탈퇴"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-[6px] text-[11px] font-bold transition-all",
                  statusFilter === s ? "bg-[#000666] text-white shadow-md shadow-blue-900/10" : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-[#E8EAF0]" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#9BA4C0] uppercase tracking-wider mr-1">견적</span>
            {(["전체", "견적있음", "없음"] as const).map(a => (
              <button
                key={a}
                onClick={() => setActiveFilter(a)}
                className={cn(
                  "px-3 py-1.5 rounded-[6px] text-[11px] font-bold transition-all",
                  activeFilter === a ? "bg-[#000666] text-white shadow-md shadow-blue-900/10" : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                )}
              >
                {a}
              </button>
            ))}
          </div>

          <p className="ml-auto text-[11px] font-bold text-[#9BA4C0]">{filtered.length}명의 데이터 검색됨</p>
        </div>

        {/* ── 사용자 목록 테이블 ── */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm flex flex-col flex-1 min-h-0 relative">
          <div className="grid border-b border-[#F0F2F8] px-6 py-3.5 bg-[#FAFBFF] sticky top-0 z-10"
            style={{ gridTemplateColumns: "1.8fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1.8fr 1.2fr" }}
          >
            {["사용자", "연락처", "상태", "저장견적", "상담", "PDF", "최근 견적", "마지막 접속"].map(col => (
              <span key={col} className="text-[10px] font-black text-[#9BA4C0] uppercase tracking-widest">{col}</span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#F8F9FC]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#C0C5D8]">
                <div className="w-8 h-8 border-2 border-[#E8EAF0] border-t-[#000666] rounded-full animate-spin mb-3" />
                <p className="text-[13px] font-bold">사용자 목록 로딩 중…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#C0C5D8]">
                <Users size={32} strokeWidth={1} className="mb-3 opacity-40" />
                <p className="text-[13px] font-bold">검색 결과가 없습니다</p>
                <p className="text-[11px] mt-1">필터 조건을 변경하거나 검색어를 다시 확인해 주세요.</p>
              </div>
            ) : (
              filtered.map((user, idx) => {
                const statusStyle = USER_STATUS_STYLE[user.status];
                const hasQuotes = user.quoteViewCount > 0;
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedUser(user)}
                    className="grid items-center px-6 py-4 hover:bg-[#FAFBFF] transition-all cursor-pointer group relative"
                    style={{ gridTemplateColumns: "1.8fr 1.5fr 1fr 0.8fr 0.8fr 0.8fr 1.8fr 1.2fr" }}
                  >
                    <div className="flex items-center gap-3 pr-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#F4F5F8] flex items-center justify-center shrink-0 border border-[#E8EAF0] group-hover:border-[#000666] transition-colors">
                        <span className="text-[12px] font-black text-[#6B7399] group-hover:text-[#000666]">{user.name[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1A1A2E] truncate">{user.name}</p>
                        <p className="text-[10px] text-[#9BA4C0] truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="text-[12px] font-medium text-[#4A5270] tabular-nums">{user.phone}</div>

                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ color: statusStyle.color, background: statusStyle.bg }}>
                        <div className="w-1 h-1 rounded-full" style={{ background: statusStyle.color }} />
                        {statusStyle.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-[#1A1A2E] tabular-nums">{user.quoteViewCount}</span>
                      <span className="text-[10px] text-[#9BA4C0]">건</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-[#1A1A2E] tabular-nums">{user.consultationCount}</span>
                      <span className="text-[10px] text-[#9BA4C0]">건</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-[#1A1A2E] tabular-nums">{user.pdfDownloadCount}</span>
                      <span className="text-[10px] text-[#9BA4C0]">건</span>
                    </div>

                    <div className="min-w-0 pr-4">
                      {hasQuotes ? (
                        <div className="flex flex-col gap-1">
                          {user.activeItems.slice(0, 2).map(item => (
                            <div key={item.quoteId} className="flex items-center gap-1.5 min-w-0">
                              <ActiveStatusBadge status={item.status} />
                              <span className="text-[10px] text-[#6B7399] truncate font-medium">{item.vehicleName.split(" ").slice(0, 3).join(" ")}</span>
                            </div>
                          ))}
                          {user.activeItems.length > 2 && <p className="text-[9px] text-[#B0B5CC] pl-1">+ {user.activeItems.length - 2}건 더 있음</p>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#D4D8EC]">-</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[#9BA4C0] tabular-nums">{daysSince(user.lastLoginAt)}</span>
                      <ChevronRight size={14} className="text-[#D4D8EC] group-hover:text-[#000666] transition-all group-hover:translate-x-1" />
                    </div>
                  </motion.div>
                );
              })
            )}
            <div className="h-12 shrink-0" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 opacity-70" />
        </div>
      </div>

      {/* ── 하단 상태 바 ── */}
      <div className="bg-[#FAFBFF] border-t border-[#E8EAF0] px-6 py-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] text-[#6B7399]">전체 사용자: <strong className="text-[#1A1A2E]">{stats.total}명</strong></span>
          </div>
          <div className="w-px h-3 bg-[#E8EAF0]" />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#6B7399]">이번 달 가입: <strong className="text-[#7C3AED]">{stats.newThisMonth}명</strong></span>
          </div>
        </div>
        <div className="text-[11px] font-bold text-[#B0B5CC] tracking-widest uppercase">
          Supabase Auth · {loading ? "로딩 중" : "실데이터"} · {today.split(" ")[0]}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]"></div>
      </div>
    }>
      <UsersContent />
    </Suspense>
  );
}
