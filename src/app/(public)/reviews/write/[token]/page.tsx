import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { maskAuthorName, formatReviewDate } from "@/lib/review-utils";
import { ReviewWriteForm } from "./ReviewWriteForm";

export const metadata: Metadata = {
  title: "후기 작성 | 아임딜러",
  description: "차량 이용 경험을 남겨주세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type TokenState =
  | { kind: "ok"; vehicleName: string | null; customerDisplayName: string; quoteCreatedAt: string | null }
  | { kind: "not_found" }
  | { kind: "used" }
  | { kind: "revoked" }
  | { kind: "expired" };

async function loadTokenState(token: string): Promise<TokenState> {
  const row = await prisma.reviewRequestToken.findUnique({
    where: { token },
    include: {
      savedQuote: {
        select: {
          customerName: true,
          createdAt: true,
          vehicleId: true,
        },
      },
    },
  });

  if (!row) return { kind: "not_found" };
  if (row.usedAt) return { kind: "used" };
  if (row.revokedAt) return { kind: "revoked" };
  if (row.expiresAt.getTime() <= Date.now()) return { kind: "expired" };

  let vehicleName: string | null = null;
  if (row.savedQuote?.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: row.savedQuote.vehicleId },
      select: { name: true, brand: true },
    });
    if (vehicle) vehicleName = `${vehicle.brand} ${vehicle.name}`;
  }

  return {
    kind: "ok",
    vehicleName,
    customerDisplayName: row.savedQuote?.customerName
      ? maskAuthorName(row.savedQuote.customerName)
      : "고객",
    quoteCreatedAt: row.savedQuote?.createdAt
      ? formatReviewDate(row.savedQuote.createdAt)
      : null,
  };
}

const INVALID_COPY: Record<
  Exclude<TokenState["kind"], "ok">,
  { title: string; body: string }
> = {
  not_found: {
    title: "유효하지 않은 링크예요",
    body: "주소가 잘못되었거나 더 이상 사용할 수 없는 링크입니다. 담당 딜러에게 새 링크를 요청해 주세요.",
  },
  used: {
    title: "이미 후기를 남기셨어요",
    body: "이 링크는 한 번만 사용할 수 있습니다. 작성하신 후기는 어드민 검토 후 공개됩니다.",
  },
  expired: {
    title: "링크가 만료되었어요",
    body: "사용 기간이 지난 링크입니다. 담당 딜러에게 새 링크를 요청해 주세요.",
  },
  revoked: {
    title: "사용이 중단된 링크예요",
    body: "담당 딜러가 링크 사용을 중단했어요. 새 링크가 필요하시면 담당 딜러에게 문의해 주세요.",
  },
};

function InvalidNotice({ kind }: { kind: Exclude<TokenState["kind"], "ok"> }) {
  const copy = INVALID_COPY[kind];
  return (
    <div className="rounded-card border border-[#F0F0F0] bg-white p-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-[#FFF4E5] flex items-center justify-center">
        <AlertTriangle size={22} className="text-[#D17C00]" />
      </div>
      <p className="mt-4 text-[16px] font-semibold text-ink">{copy.title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-caption">
        {copy.body}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-btn border border-[#E0E0E0] bg-white px-4 py-2 text-[13px] font-medium text-ink hover:border-primary/30"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}

export default async function ReviewWritePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await loadTokenState(token);

  return (
    <div className="bg-[#FAFAFA] min-h-screen">
      <div className="bg-white border-b border-[#F0F0F0] py-6">
        <div className="page-container max-w-md mx-auto">
          <h1 className="text-title-sm text-ink font-medium">후기 작성</h1>
          <p className="text-label text-ink-label mt-1">
            차량을 이용하신 경험을 짧게 남겨주세요.
          </p>
        </div>
      </div>

      <div className="page-container max-w-md mx-auto py-8 space-y-4">
        {state.kind === "ok" ? (
          <>
            <div className="rounded-card border border-[#F0F0F0] bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">
                    {state.customerDisplayName} 고객님
                  </p>
                  <p className="text-[12px] text-ink-caption mt-0.5">
                    {state.vehicleName ?? "차량"}
                    {state.quoteCreatedAt ? ` · ${state.quoteCreatedAt} 견적` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-ink-caption">
                작성하신 후기는 담당 어드민 검토 후 공개됩니다. 다른 이용자에게 보일 때는 이름이 마스킹 처리돼요.
              </p>
            </div>

            <ReviewWriteForm
              token={token}
              vehicleName={state.vehicleName}
              customerDisplayName={state.customerDisplayName}
            />
          </>
        ) : (
          <InvalidNotice kind={state.kind} />
        )}
      </div>
    </div>
  );
}
