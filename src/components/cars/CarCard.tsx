"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { getVehicleCardPoints } from "@/lib/vehicle-card-points";
import type { VehicleListItem } from "@/types/api";

interface CarCardProps {
  vehicle: VehicleListItem;
}

export function CarCard({ vehicle }: CarCardProps) {
  const points = getVehicleCardPoints(vehicle);

  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group flex min-h-[180px] items-stretch overflow-hidden rounded-card border border-border-subtle bg-surface-soft p-3 transition-all duration-state hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-raised hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 lg:min-h-[236px] lg:p-4"
      >
        <div className="flex w-[44%] min-w-[132px] max-w-[216px] shrink-0 flex-col lg:w-[46%] lg:min-w-[208px] lg:max-w-[248px] xl:min-w-[220px]">
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-card bg-surface">
            {vehicle.thumbnailUrl ? (
              <Image
                src={vehicle.thumbnailUrl}
                alt={`${vehicle.brand} ${vehicle.name}`}
                fill
                sizes="(max-width: 767px) 44vw, (max-width: 1023px) 216px, 248px"
                unoptimized={isSupabaseStorageUrl(vehicle.thumbnailUrl)}
                className="rounded-card object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-2 text-center text-[12px] font-bold text-text-muted">
                이미지 준비 중
              </div>
            )}
            <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
              {vehicle.isPopular && (
                <span className="inline-flex rounded-pill bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white lg:px-2.5 lg:py-1 lg:text-[11px]">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="inline-flex rounded-pill bg-status-positive px-2 py-0.5 text-[10px] font-extrabold text-white lg:px-2.5 lg:py-1 lg:text-[11px]">
                  즉시출고
                </span>
              )}
            </div>
          </div>

          {points.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1 lg:mt-2.5 lg:gap-1.5">
              {points.map((point) => (
                <span
                  key={point}
                  className="max-w-full truncate rounded-pill bg-brand-soft px-2 py-1 text-[10.5px] font-extrabold leading-none text-brand lg:px-2.5 lg:py-1.5 lg:text-[12px]"
                >
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-0.5 pl-4 xl:pl-5">
          <p className="truncate text-[12px] font-bold text-text-muted lg:text-[14px]">{vehicle.brand}</p>
          <h3 className="mt-0.5 line-clamp-2 text-[20px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand lg:text-[24px] xl:text-[26px]">
            {vehicle.name}
          </h3>

          <div className="mt-auto flex flex-col items-end pt-3 text-right lg:pt-4">
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="brand"
              size="sm"
              showCaption={false}
              align="end"
              className="w-full"
              numberClassName="text-[30px] lg:text-[36px] xl:text-[38px]"
              unitClassName="text-[14px] font-bold lg:text-[15px]"
            />
            <p className="mt-1 break-keep text-right text-[10.5px] font-medium leading-tight text-text-muted lg:text-[12px]">
              60개월 · 연 2만km · 무보증
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
