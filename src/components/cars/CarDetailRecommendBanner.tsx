"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";

export function CarDetailRecommendBanner() {
  return (
    <motion.section
      initial={false}
      className="mt-12 overflow-hidden rounded-[24px] bg-primary text-white"
    >
      <div className="grid gap-5 px-6 py-8 md:grid-cols-[1fr_auto] md:items-center md:px-12 md:py-10">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <AiBadge tone="onDark" />
            <span className="text-[12px] font-extrabold uppercase text-white/65">추천</span>
          </div>
          <h3 className="mb-1.5 text-[22px] font-extrabold text-white md:text-[24px]">
            나에게 맞는 차량이 따로 있을 수 있어요
          </h3>
          <p className="text-[14px] leading-relaxed text-white/68">
            업종·목적·예산·성향 4가지로 최적 차량을 찾아드려요.
          </p>
        </div>
        <Link
          href="/recommend"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-btn bg-white px-6 text-[14px] font-extrabold text-primary transition-colors duration-150 hover:bg-white/90 md:w-auto"
        >
          AI 추천 받기
          <ChevronRight size={14} strokeWidth={2.5} />
        </Link>
      </div>
    </motion.section>
  );
}
