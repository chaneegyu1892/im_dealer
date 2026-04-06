import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RecommendedVehicle } from "@/types/recommendation";
import { AiInsight } from "@/components/quote/AiInsight";
import { QuoteScenarioTabs } from "@/components/quote/QuoteScenarioTabs";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { ChevronRight, Trophy } from "lucide-react";

interface RecommendVehicleCardProps {
  vehicle: RecommendedVehicle;
  isTop?: boolean;
}

const RANK_LABELS: Record<number, string> = {
  1: "1순위 추천",
  2: "2순위 추천",
  3: "3순위 추천",
};

export function RecommendVehicleCard({ vehicle, isTop = false }: RecommendVehicleCardProps) {
  const { vehicle: detail, scenarios, reason, highlights, rank } = vehicle;

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

      <div className="p-4 md:p-5 space-y-5">
        {/* 차량 정보 헤더 */}
        <div className="flex items-center gap-4">
          {/* 썸네일 */}
          <div className="relative w-24 h-16 flex-shrink-0 rounded-[8px] overflow-hidden bg-neutral">
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
            href={`/cars/${vehicle.vehicleId}`}
            className="flex-shrink-0 text-ink-caption hover:text-primary transition-colors"
            aria-label="차량 상세 보기"
          >
            <ChevronRight size={20} />
          </Link>
        </div>

        {/* AI 해설 */}
        <AiInsight reason={reason} highlights={highlights} />

        {/* 견적 시나리오 탭 */}
        <div>
          <p className="text-[11px] font-medium text-ink-label mb-3">
            납입 방식별 견적 비교
          </p>
          <QuoteScenarioTabs scenarios={scenarios} />
        </div>

        {/* 채널톡 CTA */}
        <ChannelTalkButton vehicleName={detail.name} />
      </div>
    </div>
  );
}
