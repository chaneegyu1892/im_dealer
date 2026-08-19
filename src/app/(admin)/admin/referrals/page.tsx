import { getAdminReferralPage } from "@/lib/admin-queries";
import { ReferralLedgerBoard } from "@/components/admin/referrals/ReferralLedgerBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "추천인 원장 | 아임딜러 어드민" };

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  // 권한은 (admin) 레이아웃의 requireAccess + PAGE_ACCESS 가 처리한다.
  const params = await searchParams;
  const page = await getAdminReferralPage(params);

  return <ReferralLedgerBoard page={page} />;
}
