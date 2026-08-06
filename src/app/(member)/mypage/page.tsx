import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CarFront, ShieldCheck, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActiveQuoteSection } from "@/components/mypage/ActiveQuoteSection";
import { CouponSummaryCard } from "@/components/mypage/CouponSummaryCard";
import { QuoteCard } from "@/components/mypage/QuoteCard";
import { ProfileSummary } from "@/components/mypage/ProfileSummary";
import { getMyPageData } from "@/lib/member-queries/mypage";
import { requireMember } from "@/lib/require-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "마이페이지",
  description: "저장한 견적과 상담 진행 상황을 확인하세요.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MyPage() {
  const access = await requireMember();
  if (!access.userId) redirect("/login");

  const data = await getMyPageData(access.userId);

  // 채널 미추가 회원에게 노출할 카카오 채널 친구추가 URL.
  // KAKAO_CHANNEL_ID 가 공개 ID(_XXXXX) 형태일 때만 친구추가 링크를 만든다.
  const kakaoChannelId = process.env.KAKAO_CHANNEL_ID?.trim();
  const channelAddUrl = kakaoChannelId?.startsWith("_")
    ? `https://pf.kakao.com/${kakaoChannelId}/friend`
    : null;

  return (
    <main className="public-app-page min-h-[100dvh] pb-[calc(112px+env(safe-area-inset-bottom,0px))] lg:pb-14">
      <div className="page-container mx-auto max-w-[960px] pb-7 md:pb-10">
        <section className="mb-7 md:mb-9">
          <p className="mb-2 text-[13px] font-extrabold text-brand">MY PAGE</p>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-strong md:text-[36px]">
            {data.profile.name}님, 안녕하세요
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-text-body">
            견적과 상담 진행 상황을 한곳에서 이어보세요.
          </p>
        </section>

        {data.activeQuote ? (
          <ActiveQuoteSection quote={data.activeQuote} />
        ) : (
          <section className="mb-10 rounded-card-lg border border-border-subtle bg-surface-raised p-5 shadow-card md:mb-12 md:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
                <Sparkles size={21} strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold text-text-strong">내 조건에 맞는 차량을 찾아볼까요?</p>
                <p className="mt-1 text-[14px] leading-6 text-text-body">
                  차량을 고르고 월 납입금과 계약 조건을 비교해 보세요.
                </p>
                <Link
                  href="/cars"
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  차량 둘러보기
                  <ArrowRight size={15} strokeWidth={2.4} />
                </Link>
              </div>
            </div>
          </section>
        )}

        <CouponSummaryCard summary={data.couponSummary} />

        <section className="mb-10 md:mb-12" aria-labelledby="my-quotes-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] font-bold text-text-muted">견적 관리</p>
              <h2 id="my-quotes-heading" className="mt-1 text-[22px] font-extrabold text-text-strong md:text-[26px]">
                내 견적
              </h2>
            </div>
            {data.quotes.length > 0 && (
              <span className="rounded-pill bg-surface-soft px-3 py-1.5 text-[12px] font-extrabold text-text-body">
                총 {data.quotes.length}건
              </span>
            )}
          </div>

          {data.quotes.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              {data.quotes.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CarFront size={28} strokeWidth={1.8} />}
              title="아직 저장한 견적이 없어요"
              description="차량을 고른 뒤 조건을 설정하면 언제든 이곳에서 다시 확인할 수 있어요."
              action={
                <Link
                  href="/recommend"
                  className="inline-flex min-h-11 items-center justify-center rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  AI 추천 시작하기
                </Link>
              }
            />
          )}
        </section>

        <section className="grid gap-3 md:grid-cols-2 md:gap-4" aria-label="내 정보와 안내">
          <ProfileSummary
            name={data.profile.name}
            email={data.profile.email}
            phone={data.profile.phone}
            provider={data.profile.provider}
            channelRelation={data.profile.channelRelation}
            marketingConsent={data.profile.marketingConsent}
            channelAddUrl={channelAddUrl}
          />
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-card md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-status-info-soft text-status-info">
                <ShieldCheck size={20} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[17px] font-extrabold text-text-strong">심사·서류 안내</h2>
                <p className="mt-1 text-[14px] leading-6 text-text-body">
                  심사 진행 시 필요한 인증과 서류는 상담 단계에서 안전하게 안내해 드려요.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-[14px] bg-surface-soft px-3.5 py-3 text-[13px] leading-5 text-text-body">
              민감한 인증·서류 원본은 이 화면에 노출하지 않으며, 안내받은 절차에서만 확인할 수 있어요.
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
