import { UserRound } from "lucide-react";
import { MarketingConsentToggle } from "@/components/mypage/MarketingConsentToggle";
import { maskEmail, maskPhone } from "@/lib/member-queries/mypage-format";

export function ProfileSummary({
  name,
  email,
  phone,
  provider,
  channelRelation,
  marketingConsent,
  channelAddUrl,
}: {
  name: string;
  email: string | null;
  phone: string | null;
  provider: string | null;
  channelRelation: string | null;
  marketingConsent: boolean;
  channelAddUrl: string | null;
}) {
  const channelLabel =
    channelRelation === "ADDED"
      ? "채널 추가됨"
      : channelRelation === "BLOCKED"
        ? "채널 차단됨"
        : "채널 추가 전";
  // 아직 채널을 추가하지 않은 회원에게 추가를 유도한다(차단 회원은 제외).
  const showChannelAdd = channelRelation !== "ADDED" && channelRelation !== "BLOCKED" && Boolean(channelAddUrl);

  return (
    <section
      id="profile"
      className="scroll-mt-24 rounded-card border border-border-subtle bg-surface p-5 shadow-card md:p-6"
    >
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
      <MarketingConsentToggle initial={marketingConsent} />
      {showChannelAdd && channelAddUrl ? (
        <a
          href={channelAddUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-[var(--color-kakao-action)] px-4 text-[13px] font-extrabold text-[var(--color-kakao-ink)] transition-colors hover:bg-[var(--color-kakao-action-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          카카오 채널 추가하고 견적·상담 소식 받기
        </a>
      ) : null}
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
