"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Info,
  Layers,
  GitCommit,
  Settings2,
  FileCheck,
  Star,
  BarChart2,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail } from "@/types/admin";
import { BasicInfoTab } from "./tabs/BasicInfoTab";
import { LineupTab } from "./tabs/LineupTab";
import { TrimTab } from "./tabs/TrimTab";
import { OptionTab } from "./tabs/OptionTab";
import { RuleTab } from "./tabs/RuleTab";
import { PopularConfigTab } from "./tabs/PopularConfigTab";
import { StatsTab } from "./tabs/StatsTab";
import { ColorTab } from "./tabs/ColorTab";
import { ImageTab, type VehicleImageSnapshot } from "./images/ImageTab";
import {
  initialSnapshotState,
  publishLocalSnapshot,
  reconcileServerSnapshot,
} from "./vehicle-image-snapshot";

interface VehicleEditorProps {
  readonly vehicle: AdminVehicleDetail;
  readonly canPurgeImages?: boolean;
}

type TabKey =
  | "basic"
  | "lineup"
  | "trim"
  | "option"
  | "color"
  | "images"
  | "rule"
  | "popular"
  | "stats";

const TABS = [
  { key: "basic", label: "기본정보", icon: Info },
  { key: "lineup", label: "라인업", icon: Layers },
  { key: "trim", label: "트림", icon: GitCommit },
  { key: "option", label: "옵션", icon: Settings2 },
  { key: "color", label: "색상", icon: Palette },
  { key: "images", label: "이미지", icon: ImageIcon },
  { key: "rule", label: "규칙", icon: FileCheck },
  { key: "popular", label: "추천 구성", icon: Star },
  { key: "stats", label: "조회 분석", icon: BarChart2 },
] as const;

export function VehicleEditor({ vehicle, canPurgeImages = false }: VehicleEditorProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [imageSnapshotState, setImageSnapshotState] = useState(() => initialSnapshotState(vehicle));
  const imageTabRef = useRef<HTMLButtonElement>(null);
  const imageHandoffPending = useRef(false);
  const reconciledImageState = reconcileServerSnapshot(imageSnapshotState, vehicle);
  if (reconciledImageState !== imageSnapshotState) setImageSnapshotState(reconciledImageState);
  const publicationEpoch = reconciledImageState.epoch;
  const setImageSnapshot = (snapshot: VehicleImageSnapshot) => {
    setImageSnapshotState((current) => publishLocalSnapshot(
      current,
      vehicle.id,
      publicationEpoch,
      snapshot
    ));
  };
  const currentVehicle: AdminVehicleDetail = { ...vehicle, ...reconciledImageState.snapshot };

  useEffect(() => {
    if (activeTab !== "images" || !imageHandoffPending.current) return;
    imageHandoffPending.current = false;
    imageTabRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
    imageTabRef.current?.focus();
  }, [activeTab]);

  const openImages = () => {
    imageHandoffPending.current = true;
    setActiveTab("images");
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const tabs = Array.from(event.currentTarget.closest("[role='tablist']")?.querySelectorAll<HTMLButtonElement>("[role='tab']") ?? []);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.key);
    tabs[nextIndex]?.focus();
  };

  return (
    <div data-testid="vehicle-editor" className="min-h-screen bg-[#F8F9FC] p-5">
      {/* 1. Breadcrumb */}
      <nav className="mb-6 text-[13px] font-medium text-[#9BA4C0]">
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          <Link href="/admin/vehicles" className="hover:text-[#000666] transition-colors">
            차량 관리
          </Link>
          <span className="inline-flex items-center gap-2">
            <ChevronRight size={14} />
            <span className="text-[#4A5270]">{vehicle.brand}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <ChevronRight size={14} />
            <span className="text-[#4A5270]">{vehicle.name}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <ChevronRight size={14} />
            <span className="font-bold text-[#000666]">차량 상세 구성</span>
          </span>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* 2. Page Header */}
        <div data-testid="vehicle-editor-header" className="flex items-center justify-between rounded-[16px] border border-[#E8EAF0] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <Link
              href={`/admin/vehicles?selected=${vehicle.id}`}
              aria-label="차량 목록으로 돌아가기"
              title="차량 목록으로 돌아가기"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F4F5F8] text-[#6B7399] transition-colors hover:bg-[#E8EAF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="break-keep text-[24px] font-black leading-tight text-[#1A1A2E]">
                {vehicle.name} <span className="text-[#9BA4C0] font-normal text-[18px]">상세 관리</span>
              </h1>
              <p className="mt-0.5 break-keep text-[13px] text-[#6B7399]">
                {vehicle.brand} / {vehicle.category} / {vehicle.lineups.length}개 라인업 / {vehicle.trims.length}개 트림
              </p>
            </div>
          </div>
        </div>

        {/* 3. Tab Navigation */}
        <div role="tablist" aria-label="차량 상세 관리" aria-orientation="horizontal" className="max-w-full overflow-x-auto rounded-[12px] bg-[#F0F2F8] p-1">
          <div className="flex min-w-max gap-1">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={tab.key === "images" ? imageTabRef : undefined}
                  type="button"
                  role="tab"
                  id={`vehicle-tab-${tab.key}`}
                  aria-controls={`vehicle-tabpanel-${tab.key}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] px-6 py-2.5 text-[14px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]",
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
        </div>

        {/* 4. Tab Content */}
        <div role="tabpanel" id={`vehicle-tabpanel-${activeTab}`} aria-labelledby={`vehicle-tab-${activeTab}`} tabIndex={0} className="min-h-[500px] break-keep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]">
          {activeTab === "basic" && (
            <BasicInfoTab
              vehicle={currentVehicle}
              onOpenImages={openImages}
            />
          )}
          {activeTab === "lineup" && <LineupTab vehicle={currentVehicle} />}
          {activeTab === "trim" && <TrimTab vehicle={currentVehicle} />}
          {activeTab === "option" && <OptionTab vehicle={currentVehicle} />}
          {activeTab === "color" && <ColorTab vehicle={currentVehicle} />}
          {activeTab === "images" && <ImageTab key={`${vehicle.id}:${publicationEpoch}`} vehicle={currentVehicle} canPurgeImages={canPurgeImages} onVehicleImagesChanged={setImageSnapshot} />}
          {activeTab === "rule" && <RuleTab vehicle={currentVehicle} />}
          {activeTab === "popular" && <PopularConfigTab vehicleId={vehicle.id} />}
          {activeTab === "stats" && <StatsTab vehicleId={vehicle.id} />}
        </div>
      </div>
    </div>
  );
}
