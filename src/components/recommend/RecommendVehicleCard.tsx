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
import { useAuthUser } from "@/hooks/useAuthUser";
import { MemberGate } from "@/components/auth/MemberGate";

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

  // 비회원에게는 보증금형·선납형(낮아진 월납입금) 카드를 블러 처리한다.
  const { user } = useAuthUser();
  const locked = !user;

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

  // 48개월 실부담(돌려받지 못하는 실제 비용) 계산
  // - 무보증/보증금형: 월납 × 개월수 (보증금은 계약 종료 시 환급되므로 실부담에서 제외)
  // - 선납형: 월납 × 개월수 + 선납금(환급 안 됨)
  const months = scenarios.standard.contractMonths || 48;
  const standardTotalCost = scenarios.standard.monthlyPayment * months;
  const depositTotalCost = scenarios.conservative.monthlyPayment * months;
  const prepayTotalCost =
    scenarios.aggressive.monthlyPayment * months + scenarios.aggressive.prepayAmount;
  const formatMan = (won: number) =>
    `${Math.round(won / 10000).toLocaleString("ko-KR")}만원`;

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
            {(() => {
              const imageSrc = detail.thumbnailUrl || detail.imageUrls?.[0];
              return imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={detail.name}
                  fill
                  sizes="96px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🚗</div>
              );
            })()}
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
            <div className="flex items-center gap-2 mb-2">
              <Users size={13} className="text-secondary" />
              <p className="text-[12px] font-medium text-ink-label">추천 구성</p>
              <span className="text-[10px] font-medium text-secondary bg-secondary-100 rounded-pill px-2 py-0.5">
                인기
              </span>
            </div>
            <p className="text-[11px] text-ink-caption mb-3">
              👇 원하는 옵션을 눌러서 추가해보세요. 금액이 실시간으로 반영돼요.
            </p>

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
                          aria-pressed={isSelected}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12px] font-medium transition-all duration-150",
                            "active:scale-[0.97]",
                            isSelected
                              ? "bg-primary-100 border border-primary text-primary shadow-sm"
                              : "bg-white border border-dashed border-neutral-300 text-ink-label hover:border-solid hover:border-primary-400 hover:text-ink hover:bg-primary-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex items-center justify-center w-3.5 h-3.5 rounded-full border flex-shrink-0",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-neutral-400"
                            )}
                          >
                            {isSelected && <Check size={9} className="text-white" />}
                          </span>
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

        {/* 월 납입금 예상 — 3가지 견적 비교 */}
        <div>
          <div className="mb-3">
            <p className="text-[12px] font-medium text-ink-label">
              예상 월 납입금 ({months}개월)
            </p>
            <p className="text-[10px] text-ink-caption mt-0.5">
              조건별 월 납입금과 실부담을 함께 비교해 보세요
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 무보증 */}
            <div className="rounded-btn border border-[#F0F0F0] bg-neutral p-3 flex flex-col gap-1">
              <p className="text-[10px] text-ink-caption">무보증</p>
              <p className="text-[18px] font-light text-ink leading-none">
                {formatMonthly(scenarios.standard.monthlyPayment)}
              </p>
              <p className="text-[10px] text-ink-caption">보증금·선납금 없음</p>
              <div className="mt-1.5 pt-1.5 border-t border-neutral-200">
                <p className="text-[10px] text-ink-caption">{months}개월 실부담</p>
                <p className="text-[12px] font-medium text-ink">
                  {formatMan(standardTotalCost)}
                </p>
              </div>
            </div>

            {/* 보증금형 + 선납형 — 회원 전용 (비회원은 블러 + 카카오 로그인 유도) */}
            <MemberGate locked={locked} className="sm:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 보증금형 — 기본 강조 + 추천 배지 */}
            <div className="relative rounded-btn border border-primary bg-primary-50 p-3 flex flex-col gap-1">
              <span className="absolute -top-2 right-2 text-[9px] font-semibold text-white bg-primary rounded-pill px-2 py-0.5 shadow-sm">
                추천
              </span>
              <p className="text-[10px] text-primary font-medium">보증금 20%</p>
              <p className="text-[18px] font-medium text-primary leading-none">
                {formatMonthly(scenarios.conservative.monthlyPayment)}
              </p>
              <p className="text-[10px] text-primary-700">
                보증금 {formatCurrency(scenarios.conservative.depositAmount)}
              </p>
              <p className="text-[10px] text-primary-700">↳ 계약 종료 시 전액 환급</p>
              <div className="mt-1.5 pt-1.5 border-t border-primary-200">
                <p className="text-[10px] text-primary-700">{months}개월 실부담</p>
                <p className="text-[12px] font-semibold text-primary">
                  {formatMan(depositTotalCost)}
                </p>
              </div>
            </div>

            {/* 선납형 */}
            <div className="rounded-btn border border-[#F0F0F0] bg-neutral p-3 flex flex-col gap-1">
              <p className="text-[10px] text-ink-caption">선납 30%</p>
              <p className="text-[18px] font-light text-ink leading-none">
                {formatMonthly(scenarios.aggressive.monthlyPayment)}
              </p>
              <p className="text-[10px] text-ink-caption">
                선납 {formatCurrency(scenarios.aggressive.prepayAmount)}
              </p>
              <p className="text-[10px] text-ink-caption">↳ 매월 나눠서 차감</p>
              <div className="mt-1.5 pt-1.5 border-t border-neutral-200">
                <p className="text-[10px] text-ink-caption">{months}개월 실부담</p>
                <p className="text-[12px] font-medium text-ink">
                  {formatMan(prepayTotalCost)}
                </p>
              </div>
            </div>
              </div>
            </MemberGate>
          </div>

          {/* 선납금이 낮아 보이는 이유 안내 */}
          <div className="mt-2.5 rounded-[6px] bg-neutral border border-[#F0F0F0] px-3 py-2.5">
            <p className="text-[10px] text-ink-label leading-relaxed">
              💡 <span className="font-medium">선납금형</span>은 미리 낸 목돈이 매월 나뉘어
              차감되어 월 납입금이 크게 낮아 보일 뿐, 실제로 내는 총액은 무보증과 비슷해요.
              <br />
              <span className="font-medium text-primary">보증금형</span>은 보증금을 계약
              종료 시 돌려받아 {months}개월 실부담이 가장 낮습니다.
            </p>
          </div>

          <p className="text-[10px] text-ink-caption mt-2">
            * 실부담 = 월 납입금 합계 + 환급되지 않는 선납금 (보증금 제외). 실제 견적은
            금융사·신용도에 따라 달라질 수 있어요
          </p>
        </div>

        {/* 하단 버튼 — 견적내기(메인) / 상담하기(보조) */}
        <div className="space-y-2">
          {/* 견적내기 — 메인 강조 */}
          <button
            type="button"
            onClick={handleQuote}
            className="w-full py-3.5 rounded-btn bg-primary text-white text-[14px] font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 shadow-sm"
          >
            견적내기
          </button>

          {/* 상담하기 — 보조 (테두리) */}
          <ChannelTalkButton
            vehicleName={detail.name}
            size="sm"
            className="w-full !bg-transparent !text-ink-label border border-neutral-300 hover:!bg-neutral-50"
          />
        </div>
      </div>
    </div>
  );
}
