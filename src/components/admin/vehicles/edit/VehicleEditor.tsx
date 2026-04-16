"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ChevronRight, 
  Info, 
  Layers, 
  GitCommit, 
  Settings2, 
  FileCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail } from "@/types/admin";
import { BasicInfoTab } from "./tabs/BasicInfoTab";
import { LineupTab } from "./tabs/LineupTab";
import { TrimTab } from "./tabs/TrimTab";
import { OptionTab } from "./tabs/OptionTab";
import { RuleTab } from "./tabs/RuleTab";

interface VehicleEditorProps {
  vehicle: AdminVehicleDetail;
}

type TabKey = "basic" | "lineup" | "trim" | "option" | "rule";

const TABS = [
  { key: "basic", label: "기본정보", icon: Info },
  { key: "lineup", label: "라인업", icon: Layers },
  { key: "trim", label: "트림", icon: GitCommit },
  { key: "option", label: "옵션", icon: Settings2 },
  { key: "rule", label: "규칙", icon: FileCheck },
] as const;

export function VehicleEditor({ vehicle }: VehicleEditorProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  return (
    <div className="p-5 min-h-screen bg-[#FBFBFE]">
      {/* 1. Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 text-[13px] font-medium text-[#9BA4C0]">
        <Link href="/admin/vehicles" className="hover:text-[#000666] transition-colors">
          차량 관리
        </Link>
        <ChevronRight size={14} />
        <span className="text-[#4A5270]">{vehicle.brand}</span>
        <ChevronRight size={14} />
        <span className="text-[#4A5270]">{vehicle.name}</span>
        <ChevronRight size={14} />
        <span className="text-[#000666] font-bold">차량 상세 구성</span>
      </nav>

      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* 2. Page Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-[16px] border border-[#E8EAF0] shadow-sm">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/vehicles?selected=${vehicle.id}`}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0] transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-[24px] font-black text-[#1A1A2E] leading-tight">
                {vehicle.name} <span className="text-[#9BA4C0] font-normal text-[18px]">상세 관리</span>
              </h1>
              <p className="text-[13px] text-[#6B7399] mt-0.5">
                {vehicle.brand} / {vehicle.category} / {vehicle.lineups.length}개 라인업 / {vehicle.trims.length}개 트림
              </p>
            </div>
          </div>
        </div>

        {/* 3. Tab Navigation */}
        <div className="flex gap-1 p-1 bg-[#F0F2F8] rounded-[12px] w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-[10px] text-[14px] font-bold transition-all",
                  isActive
                    ? "bg-white text-[#000666] shadow-md shadow-indigo-100/50"
                    : "text-[#6B7399] hover:bg-white/50"
                )}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 4. Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === "basic" && <BasicInfoTab vehicle={vehicle} />}
          {activeTab === "lineup" && <LineupTab vehicle={vehicle} />}
          {activeTab === "trim" && <TrimTab vehicle={vehicle} />}
          {activeTab === "option" && <OptionTab vehicle={vehicle} />}
          {activeTab === "rule" && <RuleTab vehicle={vehicle} />}
        </div>
      </div>
    </div>
  );
}
