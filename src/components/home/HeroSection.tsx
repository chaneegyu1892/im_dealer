import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="page-container py-6 md:py-10">
      <div
        className="relative overflow-hidden rounded-[16px] px-8 py-10 md:px-12 md:py-16"
        style={{
          background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
        }}
      >
        {/* 배경 원형 장식 */}
        <span
          aria-hidden
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <span
          aria-hidden
          className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />

        {/* AI 태그 pill */}
        <div className="relative mb-6 inline-flex items-center gap-1.5 rounded-[20px] px-4 py-1.5"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <Sparkles
            size={13}
            style={{ color: "rgba(255,255,255,0.9)" }}
          />
          <span
            className="text-[12px] font-medium"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            AI 기반 진짜견적 서비스
          </span>
        </div>

        {/* 헤드라인 */}
        <h1
          className="relative text-white font-light leading-snug mb-3"
          style={{ fontSize: "clamp(24px, 5vw, 40px)" }}
        >
          차 뽑기 전에,
          <br />
          AI한테 먼저 물어보세요
        </h1>

        {/* 서브텍스트 */}
        <p
          className="relative mb-8 max-w-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.7)", fontSize: "15px" }}
        >
          업종·목적·예산만 입력하면
          <br />
          실제 계약 가능한 견적을 바로 확인할 수 있어요.
        </p>

        {/* CTA */}
        <div className="relative flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="bg-white text-primary border-none font-semibold shadow-sm hover:bg-white/90"
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
            className="border-white/40 text-white hover:bg-white/10"
            asChild
          >
            <Link href="/cars">차량 직접 탐색</Link>
          </Button>
        </div>
      </div>

      {/* Trust Badges — 히어로 하단 */}
      <div className="mt-5 flex justify-center md:justify-start">
        <TrustBadgeGroup />
      </div>
    </section>
  );
}
