"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";

const HIGHLIGHTS = [
  "업종별 맞춤 차량 추천",
  "실제 계약 가능한 견적",
  "허위견적 · 상담 압박 없음",
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export function HeroSection() {
  return (
    <section className="t-shell-wide pt-7 pb-9 md:pt-10">
      <div className="relative overflow-hidden rounded-[18px]">
        {/* 배경 이미지 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-bg-v3.png')" }}
        />
        {/* 이미지 위 어두운 오버레이 — 텍스트 가독성 확보 */}
        <div className="absolute inset-0 bg-black/55" />

        {/* 반응형 레이아웃: 모바일 세로 / 데스크톱 가로 */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-9 md:gap-14 px-6 md:px-14 py-12 md:py-16"
        >
          {/* 좌측: 텍스트 */}
          <div className="w-full md:max-w-[540px]">
            <motion.div
              variants={fadeUp}
              className="mb-5 inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 border border-white/20"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <AiBadge tone="onDark" />
              <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-white">
                기반 진짜견적 서비스
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-extrabold text-white leading-[1.18] tracking-[-0.04em] mb-4 text-[30px] md:text-[44px]"
            >
              차 뽑기 전에,
              <br />
              AI한테 먼저
              <br />
              물어보세요
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-[15px] md:text-[15px] font-medium leading-[1.55] mb-7 w-full md:max-w-[400px] text-white/75"
            >
              묻는 건 단 3가지, 받는 건 진짜 견적.
              <br className="hidden md:block" />
              <span className="text-white/55"> 전화번호도, 영업 전화도 없이.</span>
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/recommend"
                className="cta bg-white !text-brand shadow-lift hover:bg-white/90 sm:w-auto sm:px-7"
              >
                <AiBadge />
                추천 받기
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/cars"
                className="cta cta-gho !bg-white/10 !text-white border border-white/30 hover:!bg-white/20 sm:w-auto sm:px-7"
              >
                내가 직접 견적 설계하기
              </Link>
            </motion.div>
          </div>

          {/* 우측: 하이라이트 카드 — 데스크톱 전용(모바일은 간결하게 생략) */}
          <motion.div variants={fadeUp} className="hidden md:block w-full md:w-[340px] md:shrink-0">
            <div
              className="rounded-[18px] p-6 space-y-4"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-white/45">
                아임딜러가 다른 이유
              </p>
              {HIGHLIGHTS.map((text) => (
                <div key={text} className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-white/70 shrink-0" />
                  <span className="text-[14.5px] font-bold text-white/90">{text}</span>
                </div>
              ))}

              <div className="pt-4 mt-1 border-t border-white/12">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="num text-[40px] font-extrabold text-white leading-none">
                    3분
                  </span>
                  <span className="text-[14px] font-bold text-white/55">만에 견적 완성</span>
                </div>
                <p className="text-[12px] text-white/40">
                  개인정보 없이 · 상담 압박 없이
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Trust Badges */}
      <div className="mt-7">
        <TrustBadgeGroup />
      </div>
    </section>
  );
}
