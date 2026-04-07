"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Calculator, Shield, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "AI가 차량을 추천해요",
    desc: "업종·목적·예산 4가지 질문으로 최적의 차량을 찾아드립니다.",
    color: "#000666",
    bgColor: "#E5E5FA",
  },
  {
    icon: Calculator,
    title: "실시간 견적을 확인해요",
    desc: "보수형·표준형·공격형 3가지 시나리오를 즉시 비교할 수 있습니다.",
    color: "#5C1800",
    bgColor: "#F5DDD5",
  },
  {
    icon: Shield,
    title: "투명하게 계약해요",
    desc: "숨겨진 비용 없이 견적 산출 내역을 모두 공개합니다.",
    color: "#71749A",
    bgColor: "#E8EAF2",
  },
];

export function ServiceIntroSection() {
  return (
    <section className="py-20 bg-white">
      <div className="page-container">
        <div className="text-center mb-14">
          <p className="section-label mb-3">서비스 안내</p>
          <h2 className="font-display text-headline-sm text-ink mb-3">
            아임딜러는 이렇게 다릅니다
          </h2>
          <p className="text-[15px] text-ink-label max-w-md mx-auto">
            고객이 먼저 탐색하고, 이해하고, 스스로 판단하는 구조.
            <br />
            상담 접수가 아닌 정보 제공이 목적입니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-14">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative p-8 rounded-card border border-[#F0F0F0] bg-white
                         hover:shadow-card-hover hover:border-primary-200
                         transition-all duration-300 group"
            >
              <div
                className="w-12 h-12 rounded-[10px] flex items-center justify-center mb-5"
                style={{ backgroundColor: step.bgColor }}
              >
                <step.icon size={22} style={{ color: step.color }} />
              </div>
              <div
                className="absolute top-8 right-8 font-display text-[64px] font-bold leading-none select-none"
                style={{ color: "rgba(0,0,0,0.03)" }}
              >
                {i + 1}
              </div>
              <h3 className="font-display text-[17px] font-medium text-ink mb-2">
                {step.title}
              </h3>
              <p className="text-[14px] text-ink-label leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/recommend"
            className="inline-flex items-center gap-2 bg-primary text-white text-[14px] font-medium
                       px-8 py-3.5 rounded-btn hover:opacity-90 transition-opacity duration-200"
          >
            AI 추천으로 시작하기
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
