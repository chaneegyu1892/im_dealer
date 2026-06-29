import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb, Eye, MessageCircle, Check } from "lucide-react";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";

const PROBLEMS = [
  "이름·전화번호 입력 후에야 견적 공개",
  "최저가를 미끼로 상담 유도, 실제 조건은 다름",
  "상담접수 완료 → 영업팀 연락 반복 구조",
  "고객이 비교하는 게 아니라 영업을 당하는 구조",
];

const SOLUTIONS = [
  "개인정보 없이 AI 기반 견적 즉시 확인",
  "실제 운영 가능한 조건으로만 계산된 진짜 견적",
  "탐색 → 이해 → 결정 후 자연스러운 상담 연결",
  "고객이 주도하는 탐색, 선택, 결정 구조",
];

const PILLARS = [
  {
    icon: <Eye size={22} />,
    title: "투명한 견적",
    description:
      "보증금·선납금·계약기간·약정거리까지 숨기는 조건 없이 실제 납입 구조를 그대로 보여드립니다. '월 xx원~' 으로 끝나지 않습니다.",
  },
  {
    icon: <Lightbulb size={22} />,
    title: "AI 기반 추천",
    description:
      "업종·사용 목적·예산·성향 4가지 질문으로 지금 상황에 맞는 차량과 조건을 추천합니다. AI는 완벽하지 않지만 솔직하게 설명합니다.",
  },
  {
    icon: <MessageCircle size={22} />,
    title: "압박 없는 상담",
    description:
      "탐색하고, 비교하고, 충분히 이해한 다음에 상담으로 이어집니다. 먼저 연락하지 않습니다. 고객이 준비됐을 때 연결합니다.",
  },
];

const FLOW_STEPS = [
  {
    step: "01",
    label: "탐색",
    description: "AI 추천 또는 차량 목록에서 원하는 차량을 찾아보세요",
  },
  {
    step: "02",
    label: "이해",
    description: "무보증·보증금·선납금 시나리오로 실제 납입 구조를 파악하세요",
  },
  {
    step: "03",
    label: "결정",
    description: "충분히 이해한 다음, 전문가와 상담으로 최종 계약을 완성하세요",
  },
];

const STATS = [
  { value: "0원", label: "개인정보 입력 없이 견적 확인" },
  { value: "12,400+", label: "누적 견적 산출 건수" },
  { value: "4곳", label: "제휴 금융사" },
  { value: "2,140", label: "실제 계약 후기" },
];

export const metadata: Metadata = {
  title: "아임딜러 소개",
  description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스. 기존 견적사이트와 완전히 다른, 고객이 먼저 탐색하고 이해하는 구조입니다.",
  openGraph: {
    title: "아임딜러 소개",
    description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스.",
  },
};

export default function AboutPage() {
  return (
    <div className="toss-page bg-white pb-14">
      {/* ── 히어로 (네이비 그라데이션) ──────────────────── */}
      <section
        className="rounded-b-[24px] px-5 pt-14 pb-12 md:pt-16 md:pb-14"
        style={{
          background: "linear-gradient(150deg,#1B2A66,#27368A 55%,#5A3DB0)",
        }}
      >
        <div className="mx-auto w-full max-w-[480px] md:max-w-[760px]">
          <p className="t-kick !text-white/70">ABOUT IMDEALER</p>
          <h1 className="mt-3 text-[28px] md:text-[34px] font-extrabold leading-[1.22] tracking-[-0.04em] text-white">
            기존 견적사이트와
            <br />
            완전히 다릅니다.
          </h1>
          <p className="mt-4 text-[14px] leading-[1.6] text-white/65">
            장기렌트·리스 시장의 관행을 바꾸려 합니다. 고객이 먼저 탐색하고,
            이해하고, 결정할 수 있는 AI 기반 진짜견적 서비스입니다.
          </p>
          <Link
            href="/cars"
            className="mt-7 inline-flex items-center gap-2 rounded-pill bg-white/15 px-5 py-2.5 text-[14px] font-extrabold text-white transition-colors hover:bg-white/25"
          >
            차량 탐색하기
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <div className="t-shell space-y-12 pt-10">
        {/* ── 핵심 지표 (2×2 stat 그리드) ─────────────── */}
        <section className="grid grid-cols-2 gap-3">
          {STATS.map((s) => (
            <div key={s.label} className="t-gray p-5">
              <p className="num text-[26px] font-extrabold leading-none text-brand">
                {s.value}
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.45] text-g1">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* ── 문제 vs 해결 ──────────────────────────── */}
        <section className="space-y-5">
          <div>
            <p className="t-kick">WHY IMDEALER</p>
            <h2 className="mt-2 t-h1">기존 시장의 구조적 문제</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* 기존 방식 */}
            <div className="t-gray p-5">
              <p className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-g2">
                <span className="h-1.5 w-1.5 rounded-full bg-g3" />
                기존 견적사이트
              </p>
              <ul className="space-y-3">
                {PROBLEMS.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-g1"
                  >
                    <span className="mt-px text-[14px] font-bold leading-none text-g3">
                      ✕
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* 아임딜러 */}
            <div className="rounded-[18px] border-[1.5px] border-brand bg-brand-soft p-5">
              <p className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                아임딜러
              </p>
              <ul className="space-y-3">
                {SOLUTIONS.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-ink"
                  >
                    <Check size={16} className="mt-px shrink-0 text-brand" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 우리의 약속 (3가지 핵심 원칙) ───────────── */}
        <section className="space-y-5">
          <div>
            <p className="t-kick">OUR PROMISE</p>
            <h2 className="mt-2 t-h1">우리의 약속</h2>
          </div>

          <div className="t-card divide-y divide-line2">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="flex items-start gap-3.5 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand">
                  {pillar.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-extrabold text-ink">
                    {pillar.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-g1">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 서비스 흐름 (고객 주도 3단계) ───────────── */}
        <section className="space-y-5">
          <div>
            <p className="t-kick">HOW IT WORKS</p>
            <h2 className="mt-2 t-h1">고객이 주도하는 3단계</h2>
            <p className="mt-2 t-sub">개인정보 없이, 상담 압박 없이 시작하세요</p>
          </div>

          <div className="space-y-3">
            {FLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="t-card flex items-center gap-4 p-5"
              >
                <span className="num flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-white">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-ink">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.5] text-g1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 신뢰 약속 ───────────────────────────────── */}
        <section className="t-gray space-y-4 p-5">
          <p className="text-[14.5px] font-extrabold text-brand">
            아임딜러는 이렇게 약속합니다
          </p>
          <TrustBadgeGroup />
        </section>

        {/* ── 솔직한 한 마디 ─────────────────────────── */}
        <section className="t-card p-6">
          <blockquote>
            <p className="text-[18px] font-extrabold leading-[1.5] tracking-[-0.03em] text-ink">
              &ldquo;AI는 아직 완벽하지 않습니다. 하지만 솔직하게 설명하는 것에는
              자신 있습니다.&rdquo;
            </p>
            <footer className="mt-3 text-[12.5px] text-g2">
              — 아임딜러 운영 원칙
            </footer>
          </blockquote>
          <p className="mt-5 text-[13.5px] leading-[1.6] text-g1">
            걸음마 단계임을 솔직히 인정하고, 그 솔직함이 신뢰로 이어지는 서비스를
            만들겠습니다. 시스템이 부족한 부분은 사람이 보완하고, 고객 경험은
            절대 끊기지 않도록 운영합니다.
          </p>
        </section>

        {/* ── CTA ─────────────────────────────────────── */}
        <div className="space-y-3">
          <Link href="/recommend" className="cta">
            AI 추천 시작하기
            <ArrowRight size={17} />
          </Link>
          <Link href="/quote" className="cta cta-gho">
            견적 계산하기
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
