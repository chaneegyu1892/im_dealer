"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

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
    <section className="page-container pt-12 pb-10">
      <div className="relative overflow-hidden rounded-[20px]">
        {/* 배경 이미지 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-bg.png')" }}
        />
        {/* 이미지 위 어두운 오버레이 — 텍스트 가독성 확보 */}
        <div className="absolute inset-0 bg-black/55" />

        {/* 2컬럼 레이아웃 */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex items-center justify-between gap-16 px-16 py-20"
        >
          {/* 좌측: 텍스트 */}
          <div className="max-w-[560px]">
            <motion.div
              variants={fadeUp}
              className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-white/20"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <Sparkles size={13} className="text-white/80" />
              <span className="text-[12px] font-medium text-white/80 tracking-wide">
                AI 기반 진짜견적 서비스
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display text-white font-light leading-[1.1] mb-5"
              style={{ fontSize: "48px", letterSpacing: "-0.02em" }}
            >
              차 뽑기 전에,
              <br />
              <span className="font-normal">AI</span>한테 먼저
              <br />
              물어보세요
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-[16px] leading-relaxed mb-10 max-w-[400px]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              업종 · 목적 · 예산만 입력하면
              <br />
              실제 계약 가능한 견적을 바로 확인할 수 있어요.
            </motion.p>

            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="lg"
                className="bg-white text-primary border-none font-semibold shadow-lg hover:bg-white/90 hover:shadow-xl transition-shadow"
                asChild
              >
                <Link href="/recommend">
                  AI 추천 시작하기
                  <ArrowRight size={16} className="ml-2" />
                </Link>
              </Button>
              <Button
                variant="outlined"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                asChild
              >
                <Link href="/cars">차량 직접 탐색</Link>
              </Button>
            </motion.div>
          </div>

          {/* 우측: 하이라이트 카드 */}
          <motion.div variants={fadeUp} className="w-[360px] shrink-0">
            <div
              className="rounded-2xl p-7 space-y-5"
              style={{
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                아임딜러가 다른 이유
              </p>
              {HIGHLIGHTS.map((text) => (
                <div key={text} className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-white/60 shrink-0" />
                  <span className="text-[15px] font-medium text-white/85">{text}</span>
                </div>
              ))}

              <div className="pt-5 mt-2 border-t border-white/10">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-display text-[40px] font-light text-white leading-none">
                    3분
                  </span>
                  <span className="text-[14px] text-white/45">만에 견적 완성</span>
                </div>
                <p className="text-[12px] text-white/30">
                  개인정보 없이 · 상담 압박 없이
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Trust Badges */}
      <div className="mt-8">
        <TrustBadgeGroup />
      </div>
    </section>
  );
}
