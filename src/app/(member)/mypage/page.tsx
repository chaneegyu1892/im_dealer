import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CarFront,
  Clock3,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MyPageConsultationButton } from "@/components/mypage/MyPageConsultationButton";
import { QuoteConditionDialog } from "@/components/mypage/QuoteConditionDialog";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { getMyPageData, type MyPageQuote, type MyPageStatusTone } from "@/lib/member-queries/mypage";
import { requireMember } from "@/lib/require-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "마이페이지 | 아임딜러",
  description: "저장한 견적과 상담 진행 상황을 확인하세요.",
};

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

const statusToneClasses: Record<MyPageStatusTone, string> = {
  neutral: "bg-surface-soft text-text-body",
  info: "bg-status-info-soft text-status-info",
  warning: "bg-status-warning-soft text-status-warning",
  positive: "bg-status-positive-soft text-status-positive",
  danger: "bg-status-danger-soft text-status-danger",
};

export default async function MyPage() {
  const access = await requireMember();
  if (!access.userId) redirect("/login");

  const data = await getMyPageData(access.userId);

  return (
    <main className="public-app-page min-h-[100dvh] pb-[calc(112px+env(safe-area-inset-bottom,0px))] lg:pb-14">
      <div className="page-container mx-auto max-w-[960px] py-7 md:py-10">
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

function ActiveQuoteSection({ quote }: { quote: MyPageQuote }) {
  const quoteHref = getQuoteHref(quote);
  const deliveryLabel = getDeliveryLabel(quote);

  return (
    <section
      className="mb-10 overflow-hidden rounded-card-lg border border-brand/20 bg-surface-raised shadow-mobile-float md:mb-12"
      aria-labelledby="active-quote-heading"
    >
      <div className="bg-gradient-to-br from-brand to-brand-dark px-5 py-5 text-white md:px-7 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-white/75">현재 진행 중인 견적</p>
            <h2 id="active-quote-heading" className="mt-1 text-[22px] font-extrabold text-white tracking-[-0.02em] md:text-[26px]">
              {quote.vehicleBrand ? `${quote.vehicleBrand} ` : ""}{quote.vehicleName}
            </h2>
          </div>
          <StatusPill quote={quote} inverse />
        </div>
        <p className="mt-2 text-[14px] font-medium text-white/80">{quote.trimName} · {quote.productType} · {quote.contractMonths}개월</p>
      </div>

      <div className="p-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] md:gap-7 md:p-7">
        <div>
          <p className="text-[13px] font-bold text-text-muted">현재 상태</p>
          <p className="mt-1 text-[19px] font-extrabold text-text-strong">{quote.statusInfo.label}</p>
          <p className="mt-1 text-[14px] leading-6 text-text-body">{quote.statusInfo.description}</p>

          <ProgressSteps currentIndex={quote.statusInfo.progressIndex} status={quote.status} />

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label="월 납입금" value={quote.pricingStatus === "CALCULATED" ? `${moneyFormatter.format(quote.monthlyPayment)}원` : "상담 확인"} emphasis />
            <Metric label="약정 거리" value={`연 ${formatMileage(quote.annualMileage)}`} />
            <Metric label="보증금" value={`${quote.depositRate}%`} />
            <Metric label="선납금" value={`${quote.prepayRate}%`} />
          </div>
        </div>

        <aside className="mt-5 rounded-card border border-border-subtle bg-surface-soft p-4 md:mt-0">
          <div className="flex items-center gap-2 text-[13px] font-bold text-text-body">
            <Clock3 size={15} strokeWidth={2.2} className="text-brand" />
            견적 {getExpiryLabel(quote.expiresAt)}
          </div>
          <p className="mt-2 text-[13px] leading-5 text-text-muted">
            마지막 업데이트 {dateFormatter.format(quote.updatedAt)}
          </p>
          <div className="mt-4 grid gap-2">
            <QuoteConditionDialog
              quote={quote}
              quoteHref={quoteHref}
              label="견적 조건 보기"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
            <MyPageConsultationButton
              quoteId={quote.id}
              sessionId={quote.sessionId}
              vehicleName={quote.vehicleName}
              trimName={quote.trimName}
              productType={quote.productType}
              contractMonths={quote.contractMonths}
              annualMileage={quote.annualMileage}
              className="min-h-11 !w-full bg-text-strong"
            />
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3 text-[12px] font-semibold text-text-muted">
            <Send size={14} strokeWidth={2} className="text-status-info" />
            {deliveryLabel}
          </div>
        </aside>
      </div>
    </section>
  );
}

function QuoteCard({ quote }: { quote: MyPageQuote }) {
  const quoteHref = getQuoteHref(quote);

  return (
    <article className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card transition-shadow duration-state hover:shadow-card-hover">
      <div className="flex gap-3 p-4 md:p-5">
        <div className="relative flex h-[76px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-surface-soft">
          {quote.thumbnailUrl ? (
            <Image
              src={quote.thumbnailUrl}
              alt={`${quote.vehicleBrand ? `${quote.vehicleBrand} ` : ""}${quote.vehicleName}`}
              fill
              sizes="96px"
              unoptimized={isSupabaseStorageUrl(quote.thumbnailUrl)}
              className="object-cover"
            />
          ) : (
            <CarFront size={26} strokeWidth={1.6} className="text-text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[12px] font-bold text-text-muted">{quote.vehicleBrand ?? "아임딜러 견적"}</p>
            <StatusPill quote={quote} />
          </div>
          <h3 className="mt-0.5 line-clamp-1 text-[18px] font-extrabold text-text-strong">{quote.vehicleName}</h3>
          <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-text-body">{quote.trimName}</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="tabular-nums text-[20px] font-extrabold tracking-[-0.02em] text-text-strong">
              {quote.pricingStatus === "CALCULATED" ? moneyFormatter.format(quote.monthlyPayment) : "상담 확인"}
            </span>
            {quote.pricingStatus === "CALCULATED" && <span className="pb-0.5 text-[12px] font-bold text-text-muted">원/월</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border-subtle bg-surface-soft/70 text-[12px] font-semibold text-text-body">
        <span className="px-4 py-3">{quote.productType} · {quote.contractMonths}개월</span>
        <span className="border-l border-border-subtle px-4 py-3 text-right">{getExpiryLabel(quote.expiresAt)}</span>
      </div>
      <div className="flex items-center gap-2 border-t border-border-subtle p-3">
        <QuoteConditionDialog
          quote={quote}
          quoteHref={quoteHref}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-btn border border-border-strong bg-surface px-3 text-[12px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          iconSize={14}
        />
        <MyPageConsultationButton
          quoteId={quote.id}
          sessionId={quote.sessionId}
          vehicleName={quote.vehicleName}
          trimName={quote.trimName}
          productType={quote.productType}
          contractMonths={quote.contractMonths}
          annualMileage={quote.annualMileage}
          label="상담"
          className="min-h-10 !w-auto px-3"
        />
      </div>
    </article>
  );
}

function ProfileSummary({
  name,
  email,
  phone,
  provider,
  channelRelation,
  marketingConsent,
}: {
  name: string;
  email: string | null;
  phone: string | null;
  provider: string | null;
  channelRelation: string | null;
  marketingConsent: boolean;
}) {
  const channelLabel =
    channelRelation === "ADDED"
      ? "채널 추가됨"
      : channelRelation === "BLOCKED"
        ? "채널 차단됨"
        : "채널 추가 전";

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
          <UserRound size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold text-text-strong">내 정보</h2>
          <p className="mt-1 text-[14px] text-text-body">{name}님 계정 정보</p>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-border-subtle rounded-[14px] border border-border-subtle bg-surface-soft px-3.5">
        <ProfileRow label="로그인" value={provider === "kakao" ? "카카오 계정" : "연결된 계정"} />
        <ProfileRow label="연락처" value={maskPhone(phone) ?? "미등록"} />
        <ProfileRow label="이메일" value={maskEmail(email) ?? "미등록"} />
        <ProfileRow label="알림 채널" value={channelLabel} />
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
        <span className="font-semibold text-text-muted">마케팅 수신 동의</span>
        <span className={marketingConsent ? "font-extrabold text-status-positive" : "font-extrabold text-text-body"}>
          {marketingConsent ? "동의함" : "미동의"}
        </span>
      </div>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-2.5 text-[13px]">
      <dt className="shrink-0 font-semibold text-text-muted">{label}</dt>
      <dd className="truncate text-right font-bold text-text-strong">{value}</dd>
    </div>
  );
}

function StatusPill({ quote, inverse = false }: { quote: MyPageQuote; inverse?: boolean }) {
  const className = inverse
    ? "bg-white/15 text-white ring-1 ring-inset ring-white/20"
    : statusToneClasses[quote.statusInfo.tone];

  return (
    <span className={`inline-flex shrink-0 items-center rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${className}`}>
      {quote.pricingStatus === "CONSULTATION_REQUIRED" && quote.status === "NEW" ? "상담 필요" : quote.statusInfo.label}
    </span>
  );
}

function ProgressSteps({ currentIndex, status }: { currentIndex: number; status: MyPageQuote["status"] }) {
  if (status === "LOST") {
    return (
      <p className="mt-5 rounded-[14px] bg-surface-soft px-3.5 py-3 text-[13px] leading-5 text-text-body">
        이 견적의 진행은 종료되었어요. 차량과 조건을 바꿔 새로 비교해 보세요.
      </p>
    );
  }

  const steps = ["견적 접수", "상담 진행", "심사·계약", "계약 완료"];
  return (
    <ol className="mt-5 grid grid-cols-4 gap-1" aria-label="견적 진행 단계">
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step} className="min-w-0">
            <span
              className={`mb-2 block h-1.5 rounded-full ${complete || current ? "bg-brand" : "bg-border-subtle"}`}
              aria-hidden="true"
            />
            <span className={`block break-keep text-[10.5px] font-bold leading-4 ${current ? "text-brand" : complete ? "text-text-body" : "text-text-muted"}`}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-[14px] bg-surface-soft px-3 py-3">
      <p className="text-[11px] font-bold text-text-muted">{label}</p>
      <p className={`mt-1 break-keep tabular-nums text-[13px] font-extrabold ${emphasis ? "text-brand" : "text-text-strong"}`}>
        {value}
      </p>
    </div>
  );
}

function getQuoteHref(quote: MyPageQuote): string | null {
  if (!quote.vehicleSlug) return null;

  const params = new URLSearchParams({
    vehicle: quote.vehicleSlug,
    trim: quote.trimId,
    customerType: quote.customerType,
    productType: quote.productType,
    contractMonths: String(quote.contractMonths),
    annualMileage: String(quote.annualMileage),
  });
  if (quote.selectedOptionIds.length > 0) {
    params.set("options", quote.selectedOptionIds.join(","));
  }
  return `/quote?${params.toString()}`;
}

function getExpiryLabel(expiresAt: Date): string {
  if (expiresAt.getTime() <= Date.now()) return "견적 만료";
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘 만료";
  return `유효기간 D-${days}`;
}

function getDeliveryLabel(quote: MyPageQuote): string {
  if (!quote.delivery) return "견적서가 필요하면 조건 확인 화면에서 카카오톡으로 전송할 수 있어요.";
  if (quote.delivery.status === "SENT") {
    return `카카오톡 전송 완료 · ${dateFormatter.format(quote.delivery.sentAt ?? quote.delivery.createdAt)}`;
  }
  if (quote.delivery.status === "FAILED") return "최근 카카오톡 전송에 실패했어요. 조건 확인 화면에서 다시 시도해 주세요.";
  return "카카오톡 전송을 준비하고 있어요.";
}

function formatMileage(mileage: number): string {
  if (mileage > 0 && mileage % 10_000 === 0) return `${mileage / 10_000}만km`;
  return `${moneyFormatter.format(mileage)}km`;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "등록됨";
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "등록됨";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
