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
    <div className="rounded-card border border-border-subtle bg-surface p-6 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-warning-soft">
        <AlertTriangle size={22} className="text-status-warning" />
      </div>
      <p className="mt-4 text-[16px] font-semibold text-text-strong">{copy.title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-text-body">
        {copy.body}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-btn border border-border-subtle bg-surface-soft px-4 py-2 text-[13px] font-bold text-text-strong transition-colors hover:border-brand/40 hover:bg-surface"
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
    <div className="public-app-page min-h-screen">
      <div className="border-b border-border-subtle bg-surface py-6">
        <div className="page-container max-w-md mx-auto">
          <h1 className="text-title-sm font-extrabold text-text-strong">후기 작성</h1>
          <p className="mt-1 text-label text-text-muted">
            차량을 이용하신 경험을 짧게 남겨주세요.
          </p>
        </div>
      </div>

      <div className="page-container mx-auto max-w-md space-y-4 pb-[calc(var(--mobile-fixed-action-height)+env(safe-area-inset-bottom)+32px)] pt-8 md:pb-8">
        {state.kind === "ok" ? (
          <>
            <div className="rounded-card border border-border-subtle bg-surface p-5 shadow-card">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <ShieldCheck size={18} className="text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-text-strong">
                    {state.customerDisplayName} 고객님
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-muted">
                    {state.vehicleName ?? "차량"}
                    {state.quoteCreatedAt ? ` · ${state.quoteCreatedAt} 견적` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-text-body">
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
