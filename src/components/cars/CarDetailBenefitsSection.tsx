"use client";

import { motion } from "framer-motion";
import {
  BadgePercent,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  UserX,
  Wrench,
} from "lucide-react";

const BENEFITS = [
  { icon: <Receipt size={16} />, title: "전액 비용처리", desc: "렌트료 100% 경비 처리\n법인·개인사업자" },
  { icon: <Wrench size={16} />, title: "유지보수 포함", desc: "정기점검·소모품\n비용 걱정 없음" },
  { icon: <BadgePercent size={16} />, title: "보험료 절감", desc: "자동차 보험이\n렌트료에 포함" },
  { icon: <TrendingDown size={16} />, title: "초기 비용 최소", desc: "보증금 0%부터\n시작 가능" },
  { icon: <RefreshCw size={16} />, title: "잔존가치 부담 없음", desc: "계약 종료 후 반납,\n시세 하락 위험 없음" },
  { icon: <UserX size={16} />, title: "개인정보 없이", desc: "이름·전화번호 요구\n없이 견적 확인" },
];

export function CarDetailBenefitsSection() {
  return (
    <motion.section
      initial={false}
      className="overflow-hidden rounded-[24px] bg-brand text-white shadow-[0_16px_42px_rgb(var(--color-brand-primary-rgb)/0.18)]"
    >
      <div className="px-6 pb-2 pt-6 md:px-7">
        <div className="mb-1.5 flex items-center gap-2">
          <ShieldCheck size={15} className="text-white/85" />
          <p className="text-[12px] font-extrabold uppercase text-white/85">
            장기렌트 핵심 혜택
          </p>
        </div>
        <p className="mb-5 text-[21px] font-extrabold text-white">
          이 차를 렌트로 타면 달라지는 것들
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-white/15 bg-white/10 md:grid-cols-3">
        {BENEFITS.map(({ icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col gap-2 bg-brand-pressed/40 px-5 py-5 transition-colors duration-150 hover:bg-brand-pressed/60"
          >
            <span className="text-white/90">{icon}</span>
            <p className="text-[13.5px] font-extrabold leading-snug text-white">{title}</p>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-white/85">{desc}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
