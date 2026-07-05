"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Fuel, Gauge, Leaf, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

interface CarCardProps {
  vehicle: VehicleListItem;
}

const ENGINE_BADGE: Record<
  EngineType,
  { label: string; icon: LucideIcon; className: string }
> = {
  EV: { label: "EV", icon: Zap, className: "bg-brand-soft text-brand" },
  하이브리드: { label: "HEV", icon: Leaf, className: "bg-status-positive-soft text-status-positive" },
  가솔린: { label: "가솔린", icon: Fuel, className: "bg-white text-text-body ring-[1px] ring-[#E5E8EB]" },
  디젤: { label: "디젤", icon: Gauge, className: "bg-purple-soft text-purple" },
};

export function CarCard({ vehicle }: CarCardProps) {
  const rawEngineType = vehicle.defaultTrim?.engineType ?? "가솔린";
  const engineType = (rawEngineType in ENGINE_BADGE ? rawEngineType : "가솔린") as EngineType;
  const engineBadge = ENGINE_BADGE[engineType];
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group block overflow-hidden rounded-[20px] bg-[#F8FAFC] transition-all duration-200 hover:bg-white hover:ring-[1.5px] hover:ring-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
      >
        {/* ─── 모바일: 가로형 (썬네일 좌측 + 정보 우측) ─── */}
        <div className="flex gap-3 p-3 md:hidden">
          {/* 썬네일 — 작은 정사각형 */}
          <div className="relative aspect-square w-[88px] shrink-0 overflow-hidden rounded-[12px] bg-white">
            {vehicle.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vehicle.thumbnailUrl}
                alt={`${vehicle.brand} ${vehicle.name}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] font-bold text-text-muted">
                이미지 없음
              </div>
            )}
            {/* 배지 — 썬네일 좌상단 */}
            <div className="absolute left-1 top-1 flex flex-col gap-0.5">
              {vehicle.isPopular && (
                <span className="inline-flex rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="inline-flex rounded-full bg-status-positive px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white">
                  즉시출고
                </span>
              )}
            </div>
          </div>

          {/* 정보 — 우측 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[11px] font-bold text-text-muted">{vehicle.brand}</p>
            <h3 className="mt-0.5 line-clamp-1 text-[15px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand">
              {vehicle.name}
            </h3>
            {vehicle.defaultTrim && (
              <p className="mt-0.5 truncate text-[11.5px] text-text-body">
                {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
              </p>
            )}

            {/* 해시태그 — 모바일 1-2개 */}
            {vehicle.hashtags && vehicle.hashtags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {vehicle.hashtags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-brand ring-[1px] ring-brand/15"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 월 납입금 — 모바일은 인라인 */}
            <div className="mt-auto pt-2">
              <RepresentativeQuotePrice
                quotes={vehicle.representativeQuotes}
                tone="brand"
                size="sm"
                showCaption={false}
                numberClassName="text-[22px]"
                unitClassName="text-[12px] font-bold"
              />
              <p className="mt-0.5 text-[10px] font-medium text-text-muted">
                월 납입금 · 60개월 · 초기 비용 0원
              </p>
            </div>
          </div>
        </div>

        {/* ─── 데스크톱: 세로형 (v2 홈 카드와 동일) ─── */}
        <div className="hidden md:block">
          {/* 썬네일 — 16:10 전체 폭 */}
          <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-white">
            {vehicle.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vehicle.thumbnailUrl}
                alt={`${vehicle.brand} ${vehicle.name}`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-text-muted">
                이미지 준비 중
              </div>
            )}
            {/* 배지 — 썬네일 좌상단 */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1">
              {vehicle.isPopular && (
                <span className="inline-flex rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="inline-flex rounded-full bg-status-positive px-2 py-0.5 text-[10px] font-extrabold text-white">
                  즉시출고
                </span>
              )}
            </div>
          </div>

          <div className="p-5 pt-0">
            {/* 차명 + 트림 */}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold text-text-muted">{vehicle.brand}</p>
              <h3 className="mt-1 line-clamp-2 text-[17px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand">
                {vehicle.name}
              </h3>
              {vehicle.defaultTrim && (
                <p className="mt-1 truncate text-[12.5px] text-text-body">
                  {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
                </p>
              )}

              {/* 엔진 배지 + 하이라이트 */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
                    engineBadge.className,
                  )}
                >
                  <engineBadge.icon size={9} strokeWidth={2.5} />
                  {engineBadge.label}
                </span>
                {vehicle.highlights.slice(0, 1).map((tag) => (
                  <span
                    key={tag}
                    className="max-w-[120px] truncate rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-text-body ring-[1px] ring-[#E5E8EB]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* 해시태그 — 데스크톱 2-3개 */}
              {vehicle.hashtags && vehicle.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {vehicle.hashtags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-brand ring-[1px] ring-brand/15"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 구분선 */}
            <div className="my-4 h-[1px] bg-[#E5E8EB]" />

            {/* 월 납입금 — 큰 타이포 + 풀 캡션 */}
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="brand"
              size="lg"
              captionClassName="mb-1.5 text-[12px] font-bold leading-none text-text-muted"
              numberClassName="text-[28px]"
              unitClassName="text-[13px] font-bold"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
