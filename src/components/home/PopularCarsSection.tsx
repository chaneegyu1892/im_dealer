"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { VehicleListItem } from "@/types/api";

function PopularCard({ vehicle, index }: { vehicle: VehicleListItem; index: number }) {
  const monthly = vehicle.monthlyFrom > 0
    ? Math.round(vehicle.monthlyFrom / 10000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group block bg-white rounded-card border border-[#F0F0F0] overflow-hidden
                   transition-all duration-300 hover:shadow-card-hover hover:border-primary-200 hover:-translate-y-1"
      >
        {/* 썸네일 */}
        <div className="relative h-[180px] bg-neutral overflow-hidden">
          {vehicle.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.thumbnailUrl}
              alt={vehicle.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-caption text-[13px]">
              이미지 준비중
            </div>
          )}
          {vehicle.isPopular && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-primary text-white text-[10px] font-semibold px-2.5 py-1 rounded-[4px]">
              <Sparkles size={9} />
              인기
            </span>
          )}
        </div>

        {/* 정보 */}
        <div className="p-5">
          <p className="text-[11px] text-ink-caption font-medium tracking-wider uppercase">
            {vehicle.brand}
          </p>
          <h3 className="text-[17px] font-display font-medium text-ink mt-1 leading-snug">
            {vehicle.name}
          </h3>
          {vehicle.defaultTrim && (
            <p className="text-[12px] text-secondary mt-1">
              {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-[#F0F0F0] flex items-end justify-between">
            <div>
              <p className="text-[10px] text-ink-caption">월 납입금</p>
              {monthly ? (
                <p className="text-[20px] font-display font-semibold text-primary leading-none mt-0.5">
                  {monthly}<span className="text-[13px] font-normal text-ink-label ml-0.5">만원~</span>
                </p>
              ) : (
                <p className="text-[13px] text-ink-caption mt-0.5">견적 준비중</p>
              )}
            </div>
            <span className="text-[12px] text-primary font-medium flex items-center gap-1
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
  return (
    <section className="page-container py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="section-label mb-2">주목할 차량</p>
          <h2 className="font-display text-headline-sm text-ink">
            지금 가장 많이 찾는 차량
          </h2>
        </div>
        <Link
          href="/cars"
          className="text-[13px] text-primary font-medium flex items-center gap-1 hover:underline"
        >
          전체 보기 <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {vehicles.map((v, i) => (
          <PopularCard key={v.id} vehicle={v} index={i} />
        ))}
      </div>
    </section>
  );
}
