import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CarFront, ClipboardCheck, MessageCircle, ShieldCheck } from "lucide-react";

const PROBLEMS = [
  "상담 신청 후에야 견적이 열리는 구조",
  "최저가처럼 보이지만 실제 조건이 다른 견적",
  "보증금·선납금·주행거리 조건이 한눈에 보이지 않는 화면",
] as const;

const PROMISES = [
  {
    icon: ClipboardCheck,
    title: "조건부터 먼저 정리",
    desc: "월 납입금, 초기 비용, 계약기간을 상담 전에 먼저 확인합니다.",
  },
  {
    icon: CarFront,
    title: "실제 차량 중심 탐색",
    desc: "보여주기용 배너보다 실제 차량과 견적 조건을 먼저 배치합니다.",
  },
  {
    icon: MessageCircle,
    title: "상담은 선택 후 연결",
    desc: "고객이 충분히 비교한 뒤 필요할 때만 상담으로 이어집니다.",
  },
] as const;

const FLOW = [
  ["01", "차량 탐색", "브랜드와 차종을 고르고 대표 월 납입금을 먼저 봅니다."],
  ["02", "조건 비교", "무보증·보증금·선납 조건을 한 화면에서 비교합니다."],
  ["03", "상담 연결", "계약 전에 확인할 항목을 이해한 뒤 상담을 시작합니다."],
] as const;

const STATS = [
  ["0원", "개인정보 입력 없이 견적 확인"],
  ["12,400+", "누적 견적 산출"],
  ["4곳", "제휴 금융사"],
  ["2,140", "실제 계약 후기"],
] as const;

export const metadata: Metadata = {
  title: "아임딜러 소개",
  description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스. 고객이 먼저 탐색하고 이해하는 견적 경험입니다.",
  openGraph: {
    title: "아임딜러 소개",
    description: "허위견적 없는 AI 기반 장기렌트·리스 견적 서비스.",
  },
};

export default function AboutPage() {
  return (
    <div className="home-showroom-scope bg-app-bg pb-[calc(112px+env(safe-area-inset-bottom,0px))] text-text-body lg:pb-0">
      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 py-12 sm:px-6 md:grid-cols-[1fr_0.85fr] md:items-center md:py-16 lg:px-8">
          <div>
            <p className="mb-4 inline-flex rounded-pill border border-border-subtle bg-surface-soft px-3 py-1.5 text-[12px] font-extrabold text-text-body">
              ABOUT IMDEALER
            </p>
            <h1 className="break-keep text-[34px] font-extrabold leading-[1.08] tracking-[-0.035em] text-text-strong md:text-[52px]">
              견적을 받기 전에
              <br />
              조건부터 보이게.
            </h1>
            <p className="mt-5 max-w-[560px] break-keep text-[15px] font-medium leading-[1.75] text-text-body md:text-[17px]">
              아임딜러는 장기렌트·리스 견적을 상담 뒤에 숨기지 않습니다. 고객이 먼저 차량을 탐색하고 월 납입 구조를 이해한 뒤 결정할 수 있도록 만듭니다.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:flex">
              <Link
                href="/cars"
                className="inline-flex min-h-[50px] items-center justify-center rounded-pill bg-text-strong px-4 text-[13px] font-extrabold text-surface transition-colors duration-state hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              >
                차량 둘러보기
              </Link>
              <Link
                href="/recommend"
                className="inline-flex min-h-[50px] items-center justify-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-4 text-[13px] font-extrabold text-text-strong shadow-card transition-colors duration-state hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              >
                AI 추천 시작
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-border-subtle bg-app-bg p-4">
            <div className="rounded-[22px] bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-text-muted">운영 원칙</p>
                  <p className="mt-0.5 text-[18px] font-extrabold text-text-strong">먼저 보여주고, 나중에 상담합니다.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {STATS.map(([value, label]) => (
                  <div key={label} className="rounded-[16px] bg-surface-soft px-2 py-4 min-[375px]:px-3 min-[430px]:px-4 md:px-3 lg:px-4">
                    <p className="text-[19px] font-extrabold leading-none text-brand min-[375px]:text-[20px] min-[430px]:text-[22px] md:text-[20px] lg:text-[24px]">{value}</p>
                    <p className="mt-2 break-keep text-[12px] font-semibold leading-snug text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <div>
            <p className="mb-2 text-[12px] font-extrabold text-text-muted">WHY IMDEALER</p>
            <h2 className="break-keep text-[27px] font-extrabold leading-[1.18] text-text-strong md:text-[36px]">
              기존 견적 경험에서
              <br />
              불편했던 것들
            </h2>
          </div>
          <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-card">
            <ul className="space-y-3">
              {PROBLEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] font-medium leading-relaxed text-text-body">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[1120px] px-5 py-12 sm:px-6 lg:px-8">
          <p className="mb-2 text-[12px] font-extrabold text-text-muted">SERVICE PROMISE</p>
          <h2 className="break-keep text-[27px] font-extrabold leading-[1.18] text-text-strong md:text-[36px]">
            고객이 먼저 결정하는 구조
          </h2>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {PROMISES.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="rounded-[22px] border border-border-subtle bg-surface px-5 py-5 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
                  <Icon size={21} />
                </span>
                <h3 className="mt-5 text-[18px] font-extrabold text-text-strong">{title}</h3>
                <p className="mt-2 break-keep text-[13px] font-medium leading-relaxed text-text-body">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-5 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-border-subtle bg-surface p-5 shadow-card md:p-7">
          <p className="mb-2 text-[12px] font-extrabold text-text-muted">HOW IT WORKS</p>
          <h2 className="break-keep text-[25px] font-extrabold leading-[1.2] text-text-strong md:text-[32px]">
            탐색부터 상담까지 3단계
          </h2>
          <div className="mt-6 divide-y divide-border-subtle">
            {FLOW.map(([step, title, desc]) => (
              <div key={step} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-[13px] font-extrabold text-brand">
                  {step}
                </span>
                <div>
                  <h3 className="text-[17px] font-extrabold text-text-strong">{title}</h3>
                  <p className="mt-1 break-keep text-[13.5px] font-medium leading-relaxed text-text-body">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
