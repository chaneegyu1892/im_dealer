"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lightbulb, Calculator, Shield, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: Lightbulb,
    title: "AI가 차량을 추천해요",
    desc: "업종·목적·예산 4가지 질문으로 최적의 차량을 찾아드립니다.",
    color: "#27368A",
    bgColor: "#ECEEF9",
  },
  {
    icon: Calculator,
    title: "실시간 견적을 확인해요",
    desc: "무보증·보증금·선납금 3가지 시나리오를 즉시 비교할 수 있습니다.",
    color: "#5A3DB0",
    bgColor: "#F0EAFB",
  },
  {
    icon: Shield,
    title: "투명하게 계약해요",
    desc: "숨겨진 비용 없이 견적 산출 내역을 모두 공개합니다.",
    color: "#4E5968",
    bgColor: "#E8EBF0",
  },
];

export function ServiceIntroSection() {
  return (
    <section className="py-16 bg-white">
      <div className="t-shell-wide">
        <div className="text-center mb-11">
          <div className="t-kick mb-3 justify-center">서비스 안내</div>
          <h2 className="t-h1 mb-3">아임딜러는 이렇게 다릅니다</h2>
          <p className="t-sub max-w-md mx-auto">
            고객이 먼저 탐색하고, 이해하고, 스스로 판단하는 구조.
            <br />
            상담 접수가 아닌 정보 제공이 목적입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative p-7 rounded-[18px] border border-line2 bg-white
                         hover:shadow-card-hover hover:border-brand/30
                         transition-all duration-300 group"
            >
              <div
                className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-5"
                style={{ backgroundColor: step.bgColor }}
              >
                <step.icon size={22} style={{ color: step.color }} />
              </div>
              <div
                className="absolute top-7 right-7 num text-[44px] md:text-[60px] font-extrabold leading-none select-none"
                style={{ color: "rgba(0,0,0,0.04)" }}
              >
                {i + 1}
              </div>
              <h3 className="text-[17px] font-extrabold text-ink mb-2 tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="text-[14px] text-g1 leading-[1.6]">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="mx-auto max-w-[360px]">
          <Link
            href="/recommend"
            className="cta hover:bg-brand-dark"
          >
            AI 추천으로 시작하기
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
