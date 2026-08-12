import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ProfileSummary } from "@/components/mypage/ProfileSummary";
import { WithdrawalSection } from "@/components/mypage/WithdrawalSection";
import { getMyPageData } from "@/lib/member-queries/mypage";
import { requireMember } from "@/lib/require-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 정보",
  description: "계정 정보와 마케팅 동의를 관리하세요.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MyProfilePage() {
  const access = await requireMember();
  if (!access.userId) redirect("/login");

  const data = await getMyPageData(access.userId);

  const kakaoChannelId = process.env.KAKAO_CHANNEL_ID?.trim();
  const channelAddUrl = kakaoChannelId?.startsWith("_")
    ? `https://pf.kakao.com/${kakaoChannelId}/friend`
    : null;

  return (
    <>
      <section className="mb-6">
        <p className="mb-2 text-[13px] font-extrabold text-brand">MY PROFILE</p>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-strong md:text-[34px]">
          내 정보
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-text-body">
          계정 정보와 마케팅 수신 동의를 확인하세요.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
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
            민감한 인증·서류 원본은 이 화면에 노출하지 않으며, 안내받은 절차에서만 확인할 수
            있어요.
          </div>
        </section>
      </div>
      {data.profile.provider === "kakao" ? <WithdrawalSection /> : null}
    </>
  );
}
