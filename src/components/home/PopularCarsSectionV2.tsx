"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { isSupabaseStorageUrl } from "@/lib/image-url";

const INITIAL_VISIBLE = 3;

function PopularCardV2({ vehicle, index }: { vehicle: VehicleListItem; index: number }) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-[20px] bg-[#F8FAFC] p-5 transition-all duration-200 hover:bg-white hover:ring-[1.5px] hover:ring-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
      >
        {/* 썸네일 */}
        <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-white">
          {vehicle.thumbnailUrl ? (
            <Image
              src={vehicle.thumbnailUrl}
              alt={vehicle.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized={isSupabaseStorageUrl(vehicle.thumbnailUrl)}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-text-muted">
              이미지 준비 중
            </div>
          )}
          {/* 배지 */}
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

        {/* 차명 + 트림 */}
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-text-muted">{vehicle.brand}</p>
          <h3 className="mt-1 truncate text-[18px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand">
            {vehicle.name}
          </h3>
          {vehicle.defaultTrim && (
            <p className="mt-1 truncate text-[13px] text-text-body">
              {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
            </p>
          )}
        </div>

        {/* 구분선 */}
        <div className="my-4 h-[1px] bg-[#E5E8EB]" />

        {/* 월 납입금 — 카드 내 가장 큰 타이포 */}
        <div className="mt-auto">
          <RepresentativeQuotePrice
            quotes={vehicle.representativeQuotes}
            tone="brand"
            size="xl"
            captionText="월 납입금"
            captionClassName="mb-1.5 text-[12px] font-bold leading-none text-text-muted"
            numberClassName="text-[30px] md:text-[32px]"
            unitClassName="text-[14px] font-bold"
          />
          <span className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1 rounded-[12px] bg-white text-[13px] font-bold text-text-body ring-[1px] ring-[#E5E8EB] transition-all group-hover:bg-brand group-hover:text-white group-hover:ring-brand">
            견적 보기
            <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function PopularCarsSectionV2({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = vehicles.length > INITIAL_VISIBLE;
  const visibleVehicles = expanded ? vehicles : vehicles.slice(0, INITIAL_VISIBLE);

  return (
    <section className="bg-white px-5 pb-14 pt-4 sm:px-6 md:pb-20">
      <div className="mx-auto w-full max-w-[1120px]">
        {/* 헤더 */}
        <div className="mb-7 md:mb-10">
          <p className="text-[12.5px] font-bold text-brand">실시간 견적</p>
          <h2 className="mt-1.5 break-keep text-[24px] font-extrabold leading-[1.25] tracking-[-0.03em] text-text-strong md:text-[32px]">
            월 납입금이 보이는 차량
          </h2>
          <p className="mt-2 break-keep text-[14px] text-text-body md:text-[15px]">
            60개월 · 초기 비용 0원 기준. 차량을 고르면 조건별 견적으로 바로 이어져요.
          </p>
        </div>

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleVehicles.map((v, i) => (
            <PopularCardV2 key={v.id} vehicle={v} index={i} />
          ))}
        </div>

        {/* 더보기 토글 */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#F8FAFC] px-6 text-[14px] font-bold text-text-body ring-[1.5px] ring-transparent transition-all hover:ring-[#E5E8EB] active:scale-[0.99]"
              aria-expanded={expanded}
            >
              {expanded ? (
                "접기"
              ) : (
                <>
                  더 많은 차량 보기 ({vehicles.length - INITIAL_VISIBLE}대)
                  <ChevronDown size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
