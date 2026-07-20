import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuoteDeliveryPage, { generateMetadata } from "./page";

const mocks = vi.hoisted(() => ({
  findDelivery: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quoteDelivery: {
      findUnique: mocks.findDelivery,
    },
  },
}));

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      src,
      alt,
    }: {
      readonly src: string;
      readonly alt: string;
    }) => createElement("img", { src, alt }),
  };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example");
  mocks.findDelivery.mockReset();
  mocks.findDelivery.mockResolvedValue({
    id: "delivery-1",
    vehicleName: "쏘렌토",
    imagePath: "deliveries/quote.png",
    status: "SENT",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("QuoteDeliveryPage", () => {
  it("shows the exact PNG that was sent to Kakao", async () => {
    const page = await QuoteDeliveryPage({
      params: Promise.resolve({ id: "delivery-1" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "쏘렌토 견적서" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "쏘렌토 견적서" })).toHaveAttribute(
      "src",
      "https://storage.example/storage/v1/object/public/quotes/deliveries/quote.png"
    );
    expect(screen.getByRole("link", { name: "새 견적 확인하기" })).toHaveAttribute(
      "href",
      "/cars"
    );
  });

  it("exposes the exact quote image as Open Graph metadata for Kakao scraping", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "delivery-1" }),
    });

    expect(metadata.openGraph).toMatchObject({
      title: "쏘렌토 견적서",
      images: [
        {
          url: "https://storage.example/storage/v1/object/public/quotes/deliveries/quote.png",
          width: 1240,
          height: 1754,
        },
      ],
    });
  });
});
