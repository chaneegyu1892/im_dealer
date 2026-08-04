"use client";

import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { RecommendedVehicle } from "@/types/recommendation";
import type { RecommendBudgetRange } from "@/constants/recommend-budget";
import { getRecommendationBudgetOvershoot } from "@/lib/recommend/recommendation-budget";
import { formatKRWManWon } from "@/lib/format";

interface RecommendNearMissSectionProps {
  readonly vehicles: readonly RecommendedVehicle[];
  readonly budgetRange: RecommendBudgetRange | undefined;
}

/**
 * 예산 상한 하나 때문에 탈락한 차량 안내.
 *
 * 조건을 못 맞췄다는 사실을 감추지 않는 게 이 섹션의 존재 이유다. 추천 카드와
 * 같은 무게로 그리면 조건에 맞는 결과처럼 읽히므로, 견적 CTA 없이 한 줄 요약만
 * 두고 시각적으로 한 단계 낮춘다.
 */
export function RecommendNearMissSection({
  vehicles,
  budgetRange,
}: RecommendNearMissSectionProps) {
  if (vehicles.length === 0) return null;

  return (
    <section
      aria-labelledby="nearMissTitle"
      className="mt-6 overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
    >
      <div className="border-b border-border-subtle bg-brand-soft/40 px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="shrink-0 text-brand" aria-hidden />
          <h3
            id="nearMissTitle"
            className="text-[15px] font-extrabold tracking-[-0.02em] text-text-strong"
          >
            조금만 더 쓰면 가능한 차량
          </h3>
        </div>
        <p className="mt-1 break-keep text-[12.5px] leading-relaxed text-text-muted">
          선택하신 예산은 넘지만, 다른 조건은 모두 맞는 차량이에요.
        </p>
      </div>

      <ul className="divide-y divide-border-subtle">
        {vehicles.map((vehicle) => {
          const overshoot = budgetRange
            ? getRecommendationBudgetOvershoot(budgetRange, vehicle.estimatedMonthly)
            : null;

          return (
            <li key={vehicle.vehicleId}>
              <Link
                href={`/cars/${vehicle.vehicle.slug}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-soft/30 md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold text-text-strong">
                    {vehicle.vehicle.name}
                  </p>
                  <p className="mt-0.5 text-[12.5px] font-medium text-text-muted">
                    {vehicle.vehicle.brand}
                    {vehicle.popularity?.rank
                      ? ` · 인기 ${vehicle.popularity.rank}위`
                      : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="num text-[15px] font-extrabold text-text-strong">
                    월 {formatKRWManWon(vehicle.estimatedMonthly)}
                  </p>
                  {overshoot !== null && (
                    <p className="mt-0.5 text-[12px] font-bold text-status-warning">
                      예산보다 {formatKRWManWon(overshoot)} 더
                    </p>
                  )}
                </div>

                <ChevronRight
                  size={16}
                  className="shrink-0 text-text-muted"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
