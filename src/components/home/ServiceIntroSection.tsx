"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calculator, ClipboardCheck, FileText } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "조건을 먼저 정리해요",
    descLines: ["용도와 초기 비용 기준을", "견적 전에 분명히 맞춥니다."],
  },
  {
    icon: Calculator,
    title: "월 납입금을 비교해요",
    descLines: ["무보증·보증금·선납 조건을", "한 화면에서 확인합니다."],
  },
  {
    icon: FileText,
    title: "상담 전에 이해해요",
    descLines: ["계약 전 확인할 항목을", "차근차근 보여드립니다."],
  },
] as const;

export function ServiceIntroSection() {
  return (
    <section className="border-t border-border-subtle bg-surface py-14 md:py-20">
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-5">
        <div className="grid gap-8 md:grid-cols-[0.86fr_1.14fr] md:items-start md:gap-12">
          <div className="max-w-xl">
            <div className="mb-3 text-[12px] font-extrabold text-text-muted">이용 흐름</div>
            <h2 className="mb-3 break-keep text-[27px] font-extrabold leading-[1.2] text-text-strong md:text-[36px]">
              견적을 받기 전에
              <br />
              알아야 할 것만 먼저.
            </h2>
            <p className="break-keep text-[14px] leading-[1.7] text-text-body md:text-[15px]">
              차종을 고르기 전에 월 납입 구조와 초기 비용 차이를 먼저 확인할 수 있게 정리했습니다.
            </p>

            <Link
              href="/recommend"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-text-strong px-6 text-[15px] font-extrabold text-surface transition-all duration-state hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
            >
              AI 추천으로 시작하기
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="divide-y divide-border-subtle rounded-[28px] border border-border-subtle bg-app-bg">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="group relative overflow-hidden px-5 py-5 transition-all duration-state hover:bg-surface-soft md:px-6"
            >
              <div className="flex gap-4">
                <div
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand"
                >
                  <step.icon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[12px] font-extrabold text-text-muted">
                    0{i + 1}
                  </div>
                  <h3 className="mb-2 break-keep text-[17px] font-extrabold text-text-strong">
                    {step.title}
                  </h3>
                  <p className="break-keep text-[14px] leading-[1.65] text-text-body">
                    {step.descLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
