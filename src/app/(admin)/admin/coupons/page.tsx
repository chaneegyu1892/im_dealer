import type { Metadata } from "next";
import { CouponsClient } from "@/components/admin/coupons/CouponsClient";
import { requireAccess } from "@/lib/require-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "쿠폰 관리",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminCouponsPage() {
  const { role } = await requireAccess("/admin/coupons");
  // 정책 편집(금액 변경)은 admin 이상만 허용한다. staff 는 발급 현황 탭만 본다.
  const canManagePolicies = role === "admin" || role === "superadmin";
  return <CouponsClient canManagePolicies={canManagePolicies} />;
}
