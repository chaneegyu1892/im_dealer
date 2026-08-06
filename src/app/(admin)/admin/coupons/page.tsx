import type { Metadata } from "next";
import { CouponsClient } from "@/components/admin/coupons/CouponsClient";
import { requireAccess } from "@/lib/require-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "쿠폰 관리",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminCouponsPage() {
  await requireAccess("/admin/coupons");
  return <CouponsClient />;
}
