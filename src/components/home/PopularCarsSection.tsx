"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

const INITIAL_VISIBLE = 3;

function PopularCard({ vehicle, index }: { vehicle: VehicleListItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group block bg-white rounded-[18px] border border-line2 overflow-hidden shadow-soft
                   transition-all duration-300 hover:shadow-card-hover hover:border-brand/30 hover:-translate-y-1"
      >
        {/* 썸네일 */}
        <div className="relative aspect-video md:aspect-auto md:h-[180px] bg-neutral overflow-hidden">
          {vehicle.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.thumbnailUrl}
              alt={vehicle.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-g2 text-[13px]">
              이미지 준비중
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {vehicle.isPopular && (
              <span className="inline-flex items-center gap-1 bg-brand text-white text-[11px] font-extrabold px-2.5 py-1 rounded-pill">
                인기
              </span>
            )}
            {vehicle.hasAvailableInventory && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-pos text-white px-2.5 py-1 rounded-pill">
                즉시출고
              </span>
            )}
          </div>
        </div>

        {/* 정보 */}
        <div className="p-5">
          <p className="text-[12px] text-g2 font-bold">
            {vehicle.brand}
          </p>
          <h3 className="text-[19px] font-extrabold text-ink mt-1 leading-tight tracking-[-0.03em]">
            {vehicle.name}
          </h3>
          {vehicle.defaultTrim && (
            <p className="text-[12.5px] text-g2 mt-1">
              {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-line2 flex items-end justify-between">
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="brand"
              size="sm"
            />
            <span className="text-[12px] text-brand font-extrabold flex items-center gap-1
                             opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              상세 보기 <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PopularCarsSection({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = vehicles.length > INITIAL_VISIBLE;
  const visibleVehicles = expanded ? vehicles : vehicles.slice(0, INITIAL_VISIBLE);

  return (
    <section className="t-shell-wide py-14">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 mb-7">
        <div>
          <div className="t-kick mb-2">
            주목할 차량
          </div>
          <h2 className="t-h1">지금 가장 많이 찾는 차량</h2>
        </div>
        <Link
          href="/cars"
          className="text-[13px] text-brand font-extrabold flex items-center gap-1 hover:underline shrink-0"
        >
          전체 보기 <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {visibleVehicles.map((v, i) => (
          <PopularCard key={v.id} vehicle={v} index={i} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-sec text-g1 text-[13.5px] font-bold hover:bg-line2 transition-all duration-200"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                접기
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                더 많은 인기 차량 보기 ({vehicles.length - INITIAL_VISIBLE}개 더)
                <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
