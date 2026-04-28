"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Leaf, Fuel, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

interface CarCardProps {
  vehicle: VehicleListItem;
  index?: number;
}

const ENGINE_BADGE: Record<
  EngineType,
  { label: string; icon: React.ElementType; className: string }
> = {
  EV: {
    label: "EV",
    icon: Zap,
    className: "bg-primary-100 text-primary border-primary-200",
  },
  하이브리드: {
    label: "HEV",
    icon: Leaf,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  가솔린: {
    label: "가솔린",
    icon: Fuel,
    className: "bg-neutral text-ink-label border-neutral-800",
  },
  디젤: {
    label: "디젤",
    icon: Gauge,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

export function CarCard({ vehicle, index = 0 }: CarCardProps) {
  const rawEngineType = vehicle.defaultTrim?.engineType ?? "가솔린";
  const engineType = (rawEngineType in ENGINE_BADGE ? rawEngineType : "가솔린") as EngineType;
  const engine = ENGINE_BADGE[engineType];
  const EngineIcon = engine.icon;
  const formattedMonthly = vehicle.monthlyFrom > 0
    ? Math.round(vehicle.monthlyFrom / 10000)
    : null;
  const brandColor = BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-white rounded-card border border-[#F0F0F0] overflow-hidden cursor-pointer
                 shadow-card hover:shadow-card-hover hover:border-primary-200 transition-shadow duration-200"
    >
      <Link href={`/cars/${vehicle.slug}`} className="block">
        {/* 이미지 영역 */}
        <div className="relative overflow-hidden aspect-[16/9]">
          {vehicle.thumbnailUrl ? (
            <Image
              src={vehicle.thumbnailUrl}
              alt={`${vehicle.brand} ${vehicle.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center relative"
              style={{ background: brandColor }}
            >
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
              <div className="absolute -left-6 -bottom-6 w-28 h-28 rounded-full opacity-10 bg-white" />
              <span className="relative z-10 text-white/40 text-[11px] font-medium uppercase tracking-[0.2em] mb-1">
                {vehicle.brand}
              </span>
              <span className="relative z-10 text-white/90 text-2xl font-light tracking-tight">
                {vehicle.name}
              </span>
            </div>
          )}

          {/* 태그들 */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {vehicle.hasAvailableInventory && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px]
                           bg-primary text-white backdrop-blur-sm"
              >
                즉시출고
              </span>
            )}
            {vehicle.highlights.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px]
                           bg-white/90 text-ink backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 엔진 뱃지 */}
          <div className="absolute top-3 right-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5",
                "rounded-[4px] border backdrop-blur-sm bg-white/90",
                engine.className
              )}
            >
              <EngineIcon size={9} strokeWidth={2.5} />
              {engine.label}
            </span>
          </div>
        </div>

        {/* 카드 본문 */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-ink-caption uppercase tracking-[0.12em]">
              {vehicle.brand}
            </span>
            <span className="text-[11px] text-ink-caption">{vehicle.category}</span>
          </div>

          <h3 className="text-title-sm text-ink mb-1.5 group-hover:text-primary transition-colors duration-200">
            {vehicle.name}
          </h3>

          <p className="text-[12px] text-ink-label leading-relaxed line-clamp-1 mb-4">
            {vehicle.description}
          </p>

          <div className="h-px bg-[#F0F0F0] mb-3" />

          <div className="flex items-end justify-between">
            <div>
              <span className="text-[10px] text-ink-caption block mb-0.5">
                월 납입금 (48개월·표준형)
              </span>
              <div className="flex items-baseline gap-1">
                {formattedMonthly ? (
                  <>
                    <span className="text-[22px] font-semibold text-ink leading-none">
                      {formattedMonthly}
                    </span>
                    <span className="text-[13px] font-medium text-ink-label">만원~</span>
                  </>
                ) : (
                  <span className="text-[14px] text-ink-label">견적 준비중</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>

      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className="absolute bottom-4 right-4 flex items-center gap-1 text-[12px] font-medium text-primary
                   opacity-0 group-hover:opacity-100 transition-all duration-200 hover:gap-2"
      >
        견적 보기
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
