import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Eye, MessageCircle } from "lucide-react";
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
    icon: <Eye size={24} />,
    title: "투명한 견적",
    description:
      "보증금·선납금·계약기간·약정거리까지 숨기는 조건 없이 실제 납입 구조를 그대로 보여드립니다. '월 xx원~' 으로 끝나지 않습니다.",
  },
  {
    icon: <Sparkles size={24} />,
    title: "AI 기반 추천",
    description:
      "업종·사용 목적·예산·성향 4가지 질문으로 지금 상황에 맞는 차량과 조건을 추천합니다. AI는 완벽하지 않지만 솔직하게 설명합니다.",
  },
  {
    icon: <MessageCircle size={24} />,
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
    description: "보수형·표준형·공격형 시나리오로 실제 납입 구조를 파악하세요",
  },
  {
    step: "03",
    label: "결정",
    description: "충분히 이해한 다음, 전문가와 상담으로 최종 계약을 완성하세요",
  },
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
    <div className="min-h-screen bg-neutral">
      {/* ── 히어로 ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* 배경 이미지 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-bg.png')" }}
        />
        <div className="absolute inset-0 bg-black/55" />

        <div className="page-container relative z-10 py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-[12px] font-medium px-4 py-1.5 rounded-full mb-8 border border-white/15">
              <ShieldCheck size={13} />
              아임딜러 소개
            </div>
            <h1 className="font-display text-[30px] md:text-[48px] font-light text-white leading-[1.1] mb-5" style={{ letterSpacing: "-0.02em" }}>
              기존 견적사이트와
              <br />
              <span className="font-medium">완전히 다릅니다.</span>
            </h1>
            <p className="text-[16px] text-white/55 leading-relaxed mb-10 max-w-lg">
              장기렌트·리스 시장의 관행을 바꾸려 합니다.
              <br />
              고객이 먼저 탐색하고, 이해하고, 결정할 수 있는
              <br />
              AI 기반 진짜견적 서비스입니다.
            </p>
            <Link
              href="/cars"
              className="inline-flex items-center gap-2 bg-white/10 text-white text-[14px] font-medium
                         px-7 py-3.5 rounded-btn hover:bg-white/15 transition-colors duration-200 border border-white/20"
            >
              차량 탐색하기
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 문제 vs 해결 ────────────────────────────────── */}
      <section className="page-container py-20">
        <div className="text-center mb-14">
          <p className="section-label mb-3">왜 아임딜러인가</p>
          <h2 className="font-display text-headline-sm text-ink">
            기존 시장의 구조적 문제
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 기존 방식 */}
          <div className="bg-white rounded-card p-8 border border-[#F0F0F0] shadow-card">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-tertiary-700 shrink-0" />
              <p className="text-[12px] font-semibold text-tertiary-700 uppercase tracking-wider">
                기존 견적사이트
              </p>
            </div>
            <ul className="space-y-4">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[14px] text-ink-label">
                  <span className="text-tertiary-700 text-[16px] leading-none mt-0.5">✕</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* 아임딜러 */}
          <div
            className="rounded-card p-8 border-2 border-primary shadow-card-hover"
            style={{ background: "linear-gradient(145deg, #F5F5FF 0%, #FFFFFF 100%)" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <p className="text-[12px] font-semibold text-primary uppercase tracking-wider">
                아임딜러
              </p>
            </div>
            <ul className="space-y-4">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex items-start gap-3 text-[14px] text-ink">
                  <span className="text-primary text-[16px] leading-none mt-0.5 shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 3가지 핵심 원칙 ─────────────────────────────── */}
      <section className="bg-white border-y border-[#F0F0F0]">
        <div className="page-container py-20">
          <div className="text-center mb-14">
            <p className="section-label mb-3">서비스 원칙</p>
            <h2 className="font-display text-headline-sm text-ink">
              아임딜러가 지키는 것
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {PILLARS.map((pillar, i) => (
              <div key={i} className="group">
                <div className="w-14 h-14 rounded-[12px] flex items-center justify-center mb-5
                               bg-primary-100 text-primary group-hover:bg-primary group-hover:text-white
                               transition-colors duration-300">
                  {pillar.icon}
                </div>
                <h3 className="font-display text-[18px] font-medium text-ink mb-2.5">
                  {pillar.title}
                </h3>
                <p className="text-[14px] text-ink-label leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 서비스 흐름 ─────────────────────────────────── */}
      <section className="page-container py-20">
        <div className="text-center mb-14">
          <p className="section-label mb-3">이용 흐름</p>
          <h2 className="font-display text-headline-sm text-ink">
            고객이 주도하는 3단계
          </h2>
          <p className="text-[14px] text-ink-label mt-2.5">
            개인정보 없이, 상담 압박 없이 시작하세요
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-3xl mx-auto">
          {FLOW_STEPS.map((item, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-white text-[13px] font-semibold
                             flex items-center justify-center mb-5 shrink-0">
                {item.step}
              </div>
              <p className="font-display text-[17px] font-medium text-ink mb-2">
                {item.label}
              </p>
              <p className="text-[13px] text-ink-label leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 신뢰 배지 ───────────────────────────────────── */}
      <section className="bg-primary-100 border-y border-primary-200">
        <div className="page-container py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
            <p className="text-[15px] font-medium text-primary">
              아임딜러는 이렇게 약속합니다
            </p>
            <TrustBadgeGroup />
          </div>
        </div>
      </section>

      {/* ── 솔직한 한 마디 ──────────────────────────────── */}
      <section className="page-container py-20">
        <div className="max-w-2xl mx-auto">
          <blockquote className="border-l-4 border-primary pl-8">
            <p className="font-display text-[24px] font-light text-ink leading-relaxed mb-5">
              &ldquo;AI는 아직 완벽하지 않습니다.
              <br />
              하지만 솔직하게 설명하는 것에는 자신 있습니다.&rdquo;
            </p>
            <footer className="text-[13px] text-ink-label">
              — 아임딜러 운영 원칙
            </footer>
          </blockquote>

          <p className="text-[14px] text-ink-label leading-relaxed mt-10">
            걸음마 단계임을 솔직히 인정하고, 그 솔직함이 신뢰로 이어지는
            서비스를 만들겠습니다. 시스템이 부족한 부분은 사람이 보완하고,
            고객 경험은 절대 끊기지 않도록 운영합니다.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="page-container mb-16">
        <div
          className="rounded-card overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
          }}
        >
          <div className="px-6 md:px-12 py-10 md:py-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
            <div>
              <h3 className="font-display text-[20px] md:text-[24px] font-light text-white mb-2">
                지금 바로 시작해보세요
              </h3>
              <p className="text-[14px] text-white/50">
                이름도, 전화번호도 필요 없습니다
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Link
                href="/recommend"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary text-[14px] font-semibold
                           px-7 py-3.5 rounded-btn hover:shadow-lg transition-shadow duration-200"
              >
                <Sparkles size={15} />
                AI 추천 받기
              </Link>
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white text-[14px] font-medium
                           px-7 py-3.5 rounded-btn hover:bg-white/15 transition-colors duration-200
                           border border-white/20"
              >
                견적 계산하기
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
