import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { ReferralShareCard } from "@/components/mypage/ReferralShareCard";
import { requireMember } from "@/lib/require-access";
import { getReferralPageData } from "@/lib/member-queries/referral";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "추천인",
  description: "내 추천 코드와 공유 링크, 이번 달 추천 현황을 확인하세요.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReferralPage() {
  const access = await requireMember();
  if (!access.userId) redirect("/login");

  const data = await getReferralPageData(access.userId);

  return (
    <>
      <section className="mb-7">
        <p className="mb-2 text-[13px] font-extrabold text-brand">MY PAGE</p>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-strong md:text-[36px]">
          추천인
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-text-body">
          나만의 추천 링크로 친구를 초대하고 보상을 받아요.
        </p>
      </section>

      <ReferralShareCard code={data.code} link={data.link} />

      <section
        className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2"
        aria-label="이번 달 추천 현황"
      >
        <MonthlyTile
          label="이번 달 추천"
          value={`${data.monthlyCount}회`}
        />
        <MonthlyTile
          label="남은 추천 한도"
          value={`${data.remainingQuota}회`}
          emphasis
          note="매월 1일 남은 횟수가 초기화돼요"
        />
      </section>

      <section className="mt-6 rounded-card border border-border-subtle bg-surface-soft p-4 text-[13px] leading-6 text-text-body md:p-5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Users size={16} strokeWidth={2} className="text-brand" aria-hidden />
          <p className="font-extrabold text-text-strong">추천인 제도 안내</p>
        </div>
        <ul className="list-disc pl-4">
          <li>
            자기 자신을 추천할 수 없어요. 본인 추천으로는 보상이 지급되지 않아요.
          </li>
          <li>한 달에 추천 보상을 받을 수 있는 횟수는 최대 10회예요.</li>
          <li>
            추천인에게 <strong>5만원</strong>, 추천받은 분에게{" "}
            <strong>3만원</strong> 상당의 혜택을 드려요.
          </li>
          <li>
            보상은 해당 계약이 성사된 뒤 영업담당자 확인을 거쳐 지급돼요.
          </li>
          <li>추천인은 1인당 1회만 귀속돼요.</li>
        </ul>
      </section>
    </>
  );
}

function MonthlyTile({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        emphasis ? "border-brand/25 bg-brand-soft" : "border-border-subtle bg-surface"
      }`}
    >
      <p
        className={`text-[12px] font-bold ${
          emphasis ? "text-brand" : "text-text-muted"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 tabular-nums text-[24px] font-extrabold ${
          emphasis ? "text-brand" : "text-text-strong"
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-1 text-[11px] font-semibold text-text-muted">{note}</p>
      )}
    </div>
  );
}
