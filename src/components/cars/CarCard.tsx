"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Fuel, Gauge, Leaf, Zap, type LucideIcon } from "lucide-react";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

interface CarCardProps {
  vehicle: VehicleListItem;
}

const ENGINE_BADGE: Record<
  EngineType,
  { label: string; icon: LucideIcon; className: string }
> = {
  EV: { label: "EV", icon: Zap, className: "bg-brand-soft text-brand" },
  하이브리드: { label: "HEV", icon: Leaf, className: "bg-status-positive-soft text-status-positive" },
  가솔린: { label: "가솔린", icon: Fuel, className: "bg-surface text-text-body ring-1 ring-border-subtle" },
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
        className="group flex min-h-[148px] items-center overflow-hidden rounded-card border border-border-subtle bg-surface-soft p-3 transition-all duration-state hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-raised hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
      >
        <div className="relative flex aspect-[4/3] w-[44%] min-w-[132px] max-w-[216px] shrink-0 items-center justify-center overflow-hidden rounded-card">
          {vehicle.thumbnailUrl ? (
            <Image
              src={vehicle.thumbnailUrl}
              alt={`${vehicle.brand} ${vehicle.name}`}
              fill
              sizes="(max-width: 767px) 44vw, 216px"
              unoptimized={isSupabaseStorageUrl(vehicle.thumbnailUrl)}
              className="!relative !inset-auto !h-auto !w-full max-h-full max-w-full rounded-card object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-bold text-text-muted">
              이미지 준비 중
            </div>
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
            {vehicle.isPopular && (
              <span className="inline-flex rounded-pill bg-brand px-2 py-0.5 text-[9px] font-extrabold text-white">
                인기
              </span>
            )}
            {vehicle.hasAvailableInventory && (
              <span className="inline-flex rounded-pill bg-status-positive px-2 py-0.5 text-[9px] font-extrabold text-white">
                즉시출고
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-0.5 pl-4">
          <p className="truncate text-[11px] font-bold text-text-muted">{vehicle.brand}</p>
          <h3 className="mt-0.5 line-clamp-2 text-[16px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand">
            {vehicle.name}
          </h3>
          {vehicle.defaultTrim && (
            <p className="mt-1 truncate text-[11px] text-text-body">
              {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
            </p>
          )}

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[9.5px] font-extrabold",
                engineBadge.className,
              )}
            >
              <engineBadge.icon size={9} strokeWidth={2.5} />
              {engineBadge.label}
            </span>
            {vehicle.highlights.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className="max-w-[92px] truncate rounded-pill bg-surface px-2 py-0.5 text-[9.5px] font-bold text-text-body ring-1 ring-border-subtle"
              >
                {tag}
              </span>
            ))}
            {vehicle.hashtags?.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className="max-w-[92px] truncate rounded-pill bg-brand-soft px-2 py-0.5 text-[9.5px] font-bold text-brand"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-auto pt-3">
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="brand"
              size="sm"
              showCaption={false}
              numberClassName="text-[22px]"
              unitClassName="text-[12px] font-bold"
            />
            <p className="mt-0.5 text-[9.5px] font-medium leading-tight text-text-muted">
              월 납입금 · 60개월 · 연 2만km · 무보증
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
