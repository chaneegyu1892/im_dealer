"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Fuel, Gauge, Leaf, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { formatSubsidyManwon } from "@/lib/ev-subsidy";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

interface CarCardProps {
  vehicle: VehicleListItem;
}

const ENGINE_BADGE: Record<
  EngineType,
  { label: string; icon: LucideIcon; className: string }
> = {
  EV: {
    label: "EV",
    icon: Zap,
    className: "bg-brand-soft text-brand",
  },
  하이브리드: {
    label: "HEV",
    icon: Leaf,
    className: "bg-status-positive-soft text-status-positive",
  },
  가솔린: {
    label: "가솔린",
    icon: Fuel,
    className: "bg-surface-soft text-text-body",
  },
  디젤: {
    label: "디젤",
    icon: Gauge,
    className: "bg-purple-soft text-purple",
  },
};

export function CarCard({ vehicle }: CarCardProps) {
  const rawEngineType = vehicle.defaultTrim?.engineType ?? "가솔린";
  const engineType = (rawEngineType in ENGINE_BADGE ? rawEngineType : "가솔린") as EngineType;
  const engine = ENGINE_BADGE[engineType];
  const EngineIcon = engine.icon;

  return (
    <motion.div
      initial={false}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="group relative overflow-hidden rounded-[26px] bg-surface shadow-card ring-1 ring-border-subtle/80 transition-all duration-state hover:ring-brand/25 hover:shadow-float"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(var(--color-brand-soft-rgb),0.86),transparent_62%)] opacity-80" />
      <Link
        href={`/cars/${vehicle.slug}`}
        className="relative block p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
      >
        <div className="flex items-start gap-4">
          <div className="relative h-[82px] w-[112px] shrink-0 overflow-hidden rounded-[20px] bg-surface-soft shadow-[inset_0_0_0_1px_rgba(var(--color-text-strong-rgb),0.05)] sm:h-[96px] sm:w-[132px]">
            {vehicle.thumbnailUrl ? (
              <Image
                src={vehicle.thumbnailUrl}
                alt={`${vehicle.brand} ${vehicle.name}`}
                fill
                sizes="160px"
                unoptimized
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-soft px-3 text-center text-[13px] font-extrabold text-brand">
                {vehicle.brand}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="truncate text-[12.5px] font-bold text-text-muted">
                {vehicle.brand} · {vehicle.category}
              </span>
              {vehicle.hasAvailableInventory && (
                <span className="shrink-0 rounded-pill bg-status-positive-soft px-2 py-0.5 text-[10.5px] font-extrabold text-status-positive">
                  즉시출고
                </span>
              )}
            </div>

            <h3 className="line-clamp-2 text-[18px] font-extrabold leading-tight text-text-strong transition-colors duration-state group-hover:text-brand sm:text-[19px]">
              {vehicle.name}
            </h3>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-extrabold",
                  engine.className,
                )}
              >
                <EngineIcon size={10} strokeWidth={2.5} />
                {engine.label}
              </span>
              {vehicle.highlights.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="max-w-[150px] truncate rounded-pill bg-surface-soft px-2.5 py-1 text-[11px] font-bold text-text-body"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {vehicle.hashtags && vehicle.hashtags.length > 0 && (
          <div className="mt-4 flex min-h-[22px] flex-wrap gap-1.5">
            {vehicle.hashtags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-brand-soft px-2.5 py-1 text-[11.5px] font-bold text-brand"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-[20px] border border-border-subtle/70 bg-surface-raised px-4 py-3.5 shadow-[0_10px_24px_rgba(var(--color-text-strong-rgb),0.06)]">
          <RepresentativeQuotePrice
            quotes={vehicle.representativeQuotes}
            tone="brand"
            size="lg"
          />
          {vehicle.evSubsidyRange ? (
            <div className="mt-2 inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2.5 py-1">
              <Zap size={11} strokeWidth={2.5} className="text-brand" />
              <span className="text-[11px] font-bold text-brand">
                전기차 보조금 {formatSubsidyManwon(vehicle.evSubsidyRange)}
              </span>
            </div>
          ) : null}
        </div>
      </Link>

      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className="relative mx-4 mb-4 flex min-h-[46px] items-center justify-center gap-2 rounded-pill bg-brand text-[13.5px] font-extrabold text-white shadow-[0_10px_22px_rgba(var(--color-brand-rgb),0.22)] transition-all duration-state hover:bg-brand-pressed hover:shadow-float active:scale-[0.98]"
      >
        바로 견적 보기
        <ArrowRight size={14} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
