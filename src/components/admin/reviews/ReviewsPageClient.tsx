"use client";

import { useState } from "react";
import { MessageSquare, Link2 } from "lucide-react";
import type {
  AdminReview,
  AdminReviewVehicleOption,
  ReviewRequestTokenSummary,
} from "@/types/review";
import { ReviewManager } from "./ReviewManager";
import { ReviewLinkManager } from "./ReviewLinkManager";

interface ReviewsPageClientProps {
  initialReviews: AdminReview[];
  vehicleOptions: AdminReviewVehicleOption[];
  initialTokens: ReviewRequestTokenSummary[];
}

type Tab = "reviews" | "tokens";

export function ReviewsPageClient({
  initialReviews,
  vehicleOptions,
  initialTokens,
}: ReviewsPageClientProps) {
  const [tab, setTab] = useState<Tab>("reviews");

  const pendingCount = initialReviews.filter((r) => !r.isPublic).length;
  const unusedCount = initialTokens.filter((t) => t.status === "unused").length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="bg-white border-b border-[#E8EAF2] px-5 pt-4">
        <div className="flex gap-1">
          <TabButton
            active={tab === "reviews"}
            onClick={() => setTab("reviews")}
            icon={<MessageSquare size={14} />}
            label="후기"
            badge={pendingCount > 0 ? pendingCount : undefined}
            badgeTitle="승인 대기 후기"
          />
          <TabButton
            active={tab === "tokens"}
            onClick={() => setTab("tokens")}
            icon={<Link2 size={14} />}
            label="요청 링크"
            badge={unusedCount > 0 ? unusedCount : undefined}
            badgeTitle="미사용 링크"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "reviews" ? (
          <ReviewManager
            initialReviews={initialReviews}
            vehicleOptions={vehicleOptions}
          />
        ) : (
          <ReviewLinkManager initialTokens={initialTokens} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeTitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors " +
        (active
          ? "text-[#000666] border-[#000666]"
          : "text-[#6B7399] border-transparent hover:text-[#1A1A2E]")
      }
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span
          title={badgeTitle}
          className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFF4E5] text-[#D17C00] text-[10px] font-semibold"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
