import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL_HREF } from "@/lib/contact";

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Footer 대표전화", () => {
  it("대표번호 표시와 tel: 발신 링크를 노출한다", () => {
    render(<Footer />);

    expect(screen.getAllByText(SUPPORT_PHONE_DISPLAY).length).toBeGreaterThan(0);
    const telLinks = screen.getAllByRole("link", { name: new RegExp(SUPPORT_PHONE_DISPLAY) });
    expect(telLinks.length).toBeGreaterThan(0);
    for (const link of telLinks) {
      expect(link).toHaveAttribute("href", SUPPORT_PHONE_TEL_HREF);
    }
  });
});
