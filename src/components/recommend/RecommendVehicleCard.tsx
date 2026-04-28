"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatCurrency, formatMonthly } from "@/lib/utils";
import type { RecommendedVehicle } from "@/types/recommendation";
import { AiInsight } from "@/components/quote/AiInsight";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { ChevronRight, Trophy, Check, Users } from "lucide-react";
import { industryToCustomerType } from "@/constants/customer-types";

interface RecommendVehicleCardProps {
  vehicle: RecommendedVehicle;
  isTop?: boolean;
  industry?: string;
}

const RANK_LABELS: Record<number, string> = {
  1: "1순위 추천",
  2: "2순위 추천",
  3: "3순위 추천",
};

export function RecommendVehicleCard({ vehicle, isTop = false, industry }: RecommendVehicleCardProps) {
  const { vehicle: detail, scenarios, reason, highlights, rank } = vehicle;
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedTotal = detail.popularConfigs
    .flatMap((c) => c.items)
    .filter((i) => selectedItems.has(i.id))
    .reduce((sum, i) => sum + i.price, 0);

  const hasConfigs = detail.popularConfigs.length > 0;

  function handleQuote() {
    const params = new URLSearchParams({
      vehicle: detail.slug,
      customerType: industryToCustomerType(industry),
    });
    if (selectedItems.size > 0) {
      const allItems = detail.popularConfigs.flatMap((c) => c.items);
      const trimOptionIds = Array.from(selectedItems)
        .map((pciId) => allItems.find((i) => i.id === pciId)?.trimOptionId)
        .filter((id): id is string => !!id);
      if (trimOptionIds.length > 0) {
        params.set("options", trimOptionIds.join(","));
      }
    }
    router.push(`/quote?${params.toString()}`);
  }

  return (
    <div
      className={cn(
        "bg-white rounded-card shadow-card overflow-hidden",
        isTop ? "border-2 border-primary" : "border border-[#F0F0F0]"
      )}
    >
      {/* 순위 배지 */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          isTop ? "bg-primary" : "bg-neutral"
        )}
      >
        {isTop && <Trophy size={14} className="text-white" />}
        <span
          className={cn(
            "text-[12px] font-medium",
            isTop ? "text-white" : "text-ink-label"
          )}
        >
          {RANK_LABELS[rank] ?? `${rank}순위`}
        </span>
      </div>

      <div className="p-6 space-y-5">
        {/* 차량 정보 헤더 */}
        <div className="flex items-center gap-4">
          {/* 썸네일 */}
          <div className="relative w-28 h-20 flex-shrink-0 rounded-[8px] overflow-hidden bg-neutral">
            {detail.thumbnailUrl ? (
              <Image
                src={detail.thumbnailUrl}
                alt={detail.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🚗</div>
            )}
          </div>

          {/* 이름·트림 */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-ink-label">{detail.brand}</p>
            <h3 className="text-title-sm text-ink font-medium leading-tight truncate">
              {detail.name}
            </h3>
            <p className="text-[12px] text-ink-caption mt-0.5">{detail.defaultTrimName}</p>
          </div>

          {/* 차량 상세 링크 */}
          <Link
            href={`/cars/${detail.slug}`}
            className="flex-shrink-0 text-ink-caption hover:text-primary transition-colors"
            aria-label="차량 상세 보기"
          >
            <ChevronRight size={20} />
          </Link>
        </div>

        {/* AI 해설 */}
        <AiInsight reason={reason} highlights={highlights} />

        {/* 추천 구성 */}
        {hasConfigs && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-secondary" />
              <p className="text-[12px] font-medium text-ink-label">추천 구성</p>
              <span className="text-[10px] font-medium text-secondary bg-secondary-100 rounded-pill px-2 py-0.5">
                인기
              </span>
            </div>

            <div className="space-y-3">
              {detail.popularConfigs.map((config) => (
                <div key={config.id}>
                  {/* 구성 헤더 */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-medium text-ink">{config.name}</p>
                    {config.note && (
                      <p className="text-[10px] text-ink-caption">{config.note}</p>
                    )}
                  </div>

                  {/* 옵션 칩들 */}
                  <div className="flex flex-wrap gap-2">
                    {config.items.map((item) => {
                      const isSelected = selectedItems.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12px] font-medium transition-all duration-150",
                            isSelected
                              ? "bg-primary-100 border border-primary text-primary"
                              : "bg-white border border-neutral-800 text-ink-label hover:border-primary-400 hover:text-ink"
                          )}
                        >
                          {isSelected && <Check size={11} className="flex-shrink-0" />}
                          <span>{item.name}</span>
                          <span
                            className={cn(
                              "text-[11px]",
                              isSelected ? "text-primary" : "text-ink-caption"
                            )}
                          >
                            +{Math.round(item.price / 10000)}만
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 선택 총액 */}
            {selectedTotal > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-[6px] bg-primary-100 border border-primary-200 px-3 py-2">
                <p className="text-[12px] text-primary font-medium">선택 구성 추가금</p>
                <p className="text-[13px] font-semibold text-primary">
                  +{formatCurrency(selectedTotal)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 월 납입금 요약 */}
        <div className="rounded-btn bg-neutral p-4">
          <p className="text-[11px] text-ink-caption mb-1">월 납입금 예상</p>
          <p className="text-[26px] font-light text-ink leading-none">
            {formatMonthly(scenarios.standard.monthlyPayment)}
          </p>
          <p className="text-[11px] text-ink-caption mt-1.5">
            48개월 · 보증금·선납금 없음 (표준형 기준)
          </p>
          <p className="text-[10px] text-ink-caption mt-1">
            * 실제 견적은 금융사·신용도에 따라 달라질 수 있어요
          </p>
        </div>

        {/* 하단 버튼 */}
        <div className="space-y-2">
          {/* 견적내기 */}
          <button
            type="button"
            onClick={handleQuote}
            className="w-full py-2.5 rounded-btn border border-primary/30 text-primary text-[13px] font-medium hover:bg-primary/[0.04] active:scale-[0.98] transition-all duration-150"
          >
            견적내기
          </button>

          {/* 상담하기 */}
          <ChannelTalkButton vehicleName={detail.name} />
        </div>
      </div>
    </div>
  );
}
