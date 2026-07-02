"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { EvSubsidyNotice } from "@/components/quote/EvSubsidyNotice";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import type { RepresentativeQuote } from "@/lib/representative-quote";
import type { VehicleDetail } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

const ENGINE_LABEL: Record<EngineType, string> = {
  EV: "전기차",
  하이브리드: "하이브리드",
  가솔린: "가솔린",
  디젤: "디젤",
};

function formatWon(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만원`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

export function CarDetailHero({
  vehicle,
  heroImage,
  engineType,
  representativeQuotes,
}: {
  vehicle: VehicleDetail;
  heroImage: string;
  engineType: EngineType;
  representativeQuotes: RepresentativeQuote[];
}) {
  return (
    <section className="relative min-h-[520px] overflow-hidden md:min-h-[620px]">
      {heroImage && (
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

      <div className="page-container relative z-10 flex min-h-[520px] flex-col justify-between py-6 md:min-h-[620px] md:py-8">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Link
            href="/cars"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-white/10 px-3 text-[12px] font-bold text-white/70 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={13} />
            차량 목록
          </Link>
        </motion.div>

        <div className="grid gap-8 pb-5 lg:grid-cols-[1fr_320px] lg:items-end lg:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-extrabold uppercase text-white/70">
                {vehicle.brand}
              </span>
              <span className="text-white/30">·</span>
              <span className="text-[12px] font-semibold text-white/65">{vehicle.category}</span>
              <span className="rounded-pill bg-white/14 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                {ENGINE_LABEL[engineType]}
              </span>
              {vehicle.isPopular && (
                <span className="rounded-pill bg-primary px-2.5 py-1 text-[11px] font-bold text-white">
                  인기
                </span>
              )}
            </div>

            <h1 className="mb-3 max-w-3xl break-keep text-[34px] font-extrabold leading-[1.08] text-white drop-shadow-md md:text-[56px]">
              {vehicle.name}
            </h1>
            {vehicle.description && (
              <p className="max-w-xl text-[15px] leading-relaxed text-white/72 md:text-[16px]">
                {vehicle.description}
              </p>
            )}

            <div className="scrollbar-hide -mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <HeroSpec label="기본가" value={`${formatWon(vehicle.basePrice)}~`} />
              <EvSubsidyNotice range={vehicle.evSubsidyRange} tone="onDark" />
              {vehicle.defaultTrim?.engineType && (
                <HeroSpec label="연료" value={vehicle.defaultTrim.engineType} />
              )}
              {vehicle.defaultTrim?.fuelEfficiency && (
                <HeroSpec label="연비" value={`${vehicle.defaultTrim.fuelEfficiency}km/L~`} />
              )}
              <HeroSpec label="트림" value={`${vehicle.trims.length}종`} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="hidden rounded-[24px] border border-white/18 bg-white/12 p-6 shadow-[0_18px_44px_rgb(0_0_0/0.18)] backdrop-blur-md lg:block"
          >
            <RepresentativeQuotePrice
              quotes={representativeQuotes}
              tone="dark"
              size="xl"
              captionText="60개월 · 초기 비용 0원 · 2만km 기준"
              emptyText="견적 준비중"
              className="mb-4"
            />
            <div className="flex items-center gap-1.5 text-[12px] text-white/60">
              <Check size={12} strokeWidth={2.5} />
              개인정보 없이 견적 확인 가능
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroSpec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border border-white/18 bg-white/12 px-3.5 py-2 backdrop-blur-sm">
      <span className="text-[11px] text-white/58">{label}</span>
      <span className="text-[13px] font-extrabold text-white">{value}</span>
    </div>
  );
}
