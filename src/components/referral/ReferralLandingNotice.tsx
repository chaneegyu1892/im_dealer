"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  persistPendingReferralCode,
  REFERRAL_REDEEM_PATH,
} from "@/lib/referral/pending-code";

/**
 * `/?ref=` 랜딩 안내.
 * 이미 로그인한 회원은 코드가 자동 적용되지 않으므로 쿠폰함 입력으로 보낸다.
 */
export function ReferralLandingNotice() {
  const params = useSearchParams();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    setCode(persistPendingReferralCode(params?.get("ref")));
  }, [params]);

  if (!code) return null;

  const href = `/login?next=${encodeURIComponent(REFERRAL_REDEEM_PATH)}&ref=${code}`;

  return (
    <aside
      role="status"
      className="border-b border-brand/20 bg-brand-soft px-4 py-3 text-center"
    >
      <p className="text-[13px] font-semibold text-text-body">
        추천 코드 {code} 를 적용하려면 쿠폰함에서 입력해 주세요.
      </p>
      <Link
        href={href}
        className="mt-1 inline-flex min-h-11 items-center text-[13px] font-extrabold text-brand underline-offset-4 hover:underline"
      >
        쿠폰함에서 입력
      </Link>
    </aside>
  );
}
