import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileImage } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { quoteImagePublicUrl } from "@/lib/quote-delivery/public-url";

export const dynamic = "force-dynamic";

type QuoteDeliveryPageProps = {
  readonly params: Promise<{
    readonly id: string;
  }>;
};

const noIndexRobots = {
  index: false,
  follow: false,
} as const;

export async function generateMetadata({
  params,
}: QuoteDeliveryPageProps): Promise<Metadata> {
  const { id } = await params;
  const delivery = await findQuoteDelivery(id);
  if (!delivery || delivery.status === "FAILED") {
    return {
      title: "견적서 | 아임딜러",
      robots: noIndexRobots,
    };
  }

  const title = `${delivery.vehicleName} 견적서`;
  const description = "선택하신 조건으로 계산된 아임딜러 견적서입니다.";
  return {
    title,
    description,
    robots: noIndexRobots,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: quoteImagePublicUrl(delivery.imagePath),
          width: 1240,
          height: 1754,
          alt: title,
        },
      ],
    },
  };
}

export default async function QuoteDeliveryPage({ params }: QuoteDeliveryPageProps) {
  const { id } = await params;
  const delivery = await findQuoteDelivery(id);

  if (!delivery || delivery.status === "FAILED") {
    notFound();
  }

  const imageUrl = quoteImagePublicUrl(delivery.imagePath);

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 md:py-14">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
            <FileImage size={21} />
          </span>
          <div>
            <p className="text-[12px] font-bold text-text-muted">아임딜러 견적서</p>
            <h1 className="break-keep text-[24px] font-extrabold tracking-[-0.03em] text-text-strong md:text-[30px]">
              {delivery.vehicleName} 견적서
            </h1>
          </div>
        </div>

        <div className="overflow-hidden rounded-[20px] border border-border-subtle bg-surface shadow-card">
          <Image
            src={imageUrl}
            alt={`${delivery.vehicleName} 견적서`}
            width={1240}
            height={1754}
            unoptimized
            className="block h-auto w-full"
          />
        </div>

        <p className="mt-4 break-keep text-center text-[13px] leading-relaxed text-text-muted">
          실제 계약 조건과 프로모션에 따라 최종 금액이 달라질 수 있습니다.
        </p>

        <Link
          href="/cars"
          className="mx-auto mt-6 flex min-h-[52px] w-full max-w-sm items-center justify-center gap-2 rounded-[14px] bg-brand px-5 text-[15px] font-extrabold text-white shadow-card transition-colors hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
        >
          새 견적 확인하기
          <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}

function findQuoteDelivery(id: string) {
  return prisma.quoteDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      vehicleName: true,
      imagePath: true,
      status: true,
    },
  });
}
