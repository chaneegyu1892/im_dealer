"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Car,
  Eye,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ToggleRight,
  ToggleLeft,
  Plus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_VEHICLES } from "@/constants/mock-vehicles";

// ─── 대시보드 통계 ────────────────────────────────────────
const STATS = [
  {
    label: "등록 차량",
    value: "12",
    unit: "대",
    icon: Car,
    trend: "+2",
    trendLabel: "이번 달",
    color: "#000666",
    bg: "#E5E5FA",
  },
  {
    label: "노출 중",
    value: "8",
    unit: "대",
    icon: Eye,
    trend: "-1",
    trendLabel: "어제 대비",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    label: "오늘 견적 조회",
    value: "47",
    unit: "회",
    icon: TrendingUp,
    trend: "+12%",
    trendLabel: "어제 대비",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    label: "AI 추천 세션",
    value: "23",
    unit: "회",
    icon: Sparkles,
    trend: "+8%",
    trendLabel: "어제 대비",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
];

// ─── 최근 활동 ───────────────────────────────────────────
const RECENT_ACTIVITY = [
  {
    id: 1,
    type: "update",
    text: "아이오닉6 기준가 업데이트",
    time: "10분 전",
    icon: CheckCircle2,
    color: "#059669",
  },
  {
    id: 2,
    type: "hide",
    text: "투싼 비노출 처리",
    time: "1시간 전",
    icon: AlertCircle,
    color: "#D97706",
  },
  {
    id: 3,
    type: "add",
    text: "K8 신규 등록 완료",
    time: "3시간 전",
    icon: CheckCircle2,
    color: "#059669",
  },
  {
    id: 4,
    type: "update",
    text: "금융사 회수율 일괄 업데이트",
    time: "어제",
    icon: CheckCircle2,
    color: "#059669",
  },
  {
    id: 5,
    type: "update",
    text: "EV6 AI 추천 코멘트 수정",
    time: "어제",
    icon: CheckCircle2,
    color: "#059669",
  },
];

// ─── 페이지 ──────────────────────────────────────────────
export default function AdminDashboard() {
  const [vehicleVisibility, setVehicleVisibility] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, true]))
  );

  const toggleVisibility = (id: string) => {
    setVehicleVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: "easeOut" as const },
  });

  return (
    <div className="p-8 max-w-[1100px]">
      {/* ── 페이지 헤더 ─────────────────────────── */}
      <motion.div {...fadeUp(0)} className="mb-8">
        <p className="text-[12px] text-[#8890AA] mb-1">{today}</p>
        <h1 className="text-[24px] font-semibold text-[#1A1A2E]">대시보드</h1>
        <p className="text-[13px] text-[#6B7399] mt-0.5">
          아임딜러 운영 현황을 한눈에 확인하세요
        </p>
      </motion.div>

      {/* ── 핵심 지표 ────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.06 + i * 0.05 }}
              className="bg-white rounded-[10px] border border-[#E8EAF0] p-5"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <p className="text-[12px] font-medium text-[#6B7399]">{stat.label}</p>
                <span
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{ background: stat.bg }}
                >
                  <Icon size={14} style={{ color: stat.color }} strokeWidth={2} />
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-[#1A1A2E] leading-none">
                  {stat.value}
                </span>
                <span className="text-[13px] text-[#9BA4C0]">{stat.unit}</span>
              </div>
              <p className="text-[11px] text-[#9BA4C0] mt-1.5">
                <span
                  className={cn(
                    "font-medium",
                    stat.trend.startsWith("+") ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  {stat.trend}
                </span>{" "}
                {stat.trendLabel}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── 메인 그리드 ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 차량 노출 빠른 제어 */}
        <motion.section {...fadeUp(0.22)} className="lg:col-span-2">
          <div
            className="bg-white rounded-[10px] border border-[#E8EAF0] overflow-hidden"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2F8]">
              <div>
                <h2 className="text-[14px] font-semibold text-[#1A1A2E]">
                  차량 노출 제어
                </h2>
                <p className="text-[11px] text-[#9BA4C0] mt-0.5">
                  토글로 즉시 노출/비노출 처리
                </p>
              </div>
              <Link
                href="/admin/vehicles"
                className="flex items-center gap-1 text-[12px] font-medium text-[#000666] hover:opacity-70 transition-opacity"
              >
                전체 관리
                <ChevronRight size={12} />
              </Link>
            </div>

            {/* 차량 목록 */}
            <div className="divide-y divide-[#F0F2F8]">
              {MOCK_VEHICLES.slice(0, 6).map((v) => {
                const visible = vehicleVisibility[v.id] ?? true;
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFBFF] transition-colors duration-100"
                  >
                    {/* 브랜드 + 차량명 */}
                    <div
                      className="w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                      style={{
                        background: v.brandColor.includes("gradient")
                          ? "#000666"
                          : v.brandColor,
                      }}
                    >
                      {v.brand[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A2E] truncate">
                        {v.brand} {v.name}
                      </p>
                      <p className="text-[11px] text-[#9BA4C0]">
                        {v.category} · {v.engineType} · 월{" "}
                        {Math.round(v.monthlyFrom / 10000)}만원~
                      </p>
                    </div>

                    {/* 인기 뱃지 */}
                    {v.isPopular && (
                      <span className="text-[10px] font-medium text-[#000666] bg-[#E5E5FA] px-2 py-0.5 rounded-[4px] shrink-0">
                        인기
                      </span>
                    )}

                    {/* 토글 */}
                    <button
                      onClick={() => toggleVisibility(v.id)}
                      className="flex items-center gap-1.5 shrink-0 transition-all duration-150"
                      aria-label={visible ? "비노출 처리" : "노출 처리"}
                    >
                      {visible ? (
                        <ToggleRight size={24} className="text-[#000666]" />
                      ) : (
                        <ToggleLeft size={24} className="text-[#C0C5DC]" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] font-medium w-12",
                          visible ? "text-[#000666]" : "text-[#9BA4C0]"
                        )}
                      >
                        {visible ? "노출 중" : "비노출"}
                      </span>
                    </button>

                    {/* 수정 링크 */}
                    <Link
                      href={`/admin/vehicles?edit=${v.id}`}
                      className="text-[#C0C5DC] hover:text-[#000666] transition-colors duration-150"
                    >
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* 차량 추가 버튼 */}
            <div className="px-5 py-3 border-t border-[#F0F2F8]">
              <Link
                href="/admin/vehicles?action=add"
                className="flex items-center gap-2 text-[13px] font-medium text-[#000666] hover:opacity-70 transition-opacity"
              >
                <Plus size={14} strokeWidth={2.5} />
                차량 추가
              </Link>
            </div>
          </div>
        </motion.section>

        {/* 우측: 빠른 액션 + 최근 활동 */}
        <div className="space-y-4">
          {/* 빠른 액션 */}
          <motion.section {...fadeUp(0.28)}>
            <div
              className="bg-white rounded-[10px] border border-[#E8EAF0] p-5"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">
                빠른 액션
              </h2>
              <div className="space-y-2">
                {[
                  {
                    href: "/admin/vehicles?action=add",
                    label: "차량 추가",
                    icon: Plus,
                    primary: true,
                  },
                  {
                    href: "/admin/rates",
                    label: "회수율 수정",
                    icon: TrendingUp,
                    primary: false,
                  },
                  {
                    href: "/admin/finance",
                    label: "금융사 관리",
                    icon: Car,
                    primary: false,
                  },
                  {
                    href: "/admin/recommend-logs",
                    label: "추천 로그 확인",
                    icon: Sparkles,
                    primary: false,
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium",
                        "transition-all duration-150 w-full",
                        action.primary
                          ? "bg-[#000666] text-white hover:opacity-90"
                          : "bg-[#F4F5F8] text-[#4A5270] hover:bg-[#EAEDF5] hover:text-[#1A1A2E]"
                      )}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* 최근 활동 */}
          <motion.section {...fadeUp(0.34)}>
            <div
              className="bg-white rounded-[10px] border border-[#E8EAF0] p-5"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">
                최근 활동
              </h2>
              <div className="space-y-3">
                {RECENT_ACTIVITY.map((act) => {
                  const Icon = act.icon;
                  return (
                    <div key={act.id} className="flex items-start gap-2.5">
                      <Icon
                        size={13}
                        style={{ color: act.color }}
                        className="shrink-0 mt-0.5"
                        strokeWidth={2}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#3D4470] leading-snug">
                          {act.text}
                        </p>
                        <p className="text-[10px] text-[#9BA4C0] mt-0.5">{act.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
