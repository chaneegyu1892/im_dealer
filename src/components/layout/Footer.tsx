import Image from "next/image";
import Link from "next/link";

const PRIMARY_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

const LEGAL_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/finance-terms", label: "금융상품 고지" },
] as const;

const BUSINESS_LINES = [
  "상호: (주)메타키움",
  "대표: 조수형",
  "사업자등록번호: 781-87-01147",
  "주소: 서울시 금천구 디지털로 178 퍼블릭가산 B동 1322호 메타키움",
] as const;

function FooterLink({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center rounded-btn text-[13px] font-bold text-text-body transition-colors duration-state hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
    >
      {label}
    </Link>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="home-showroom-scope border-t border-border-subtle bg-surface pb-[calc(96px+env(safe-area-inset-bottom,0px))] text-text-body lg:pb-0">
      <div className="mx-auto w-full max-w-[1120px] px-5 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-7 lg:grid-cols-[1.12fr_0.88fr_0.88fr] lg:items-start">
          <div>
            <Image
              src="/images/brand/main-logo.svg"
              alt="아임딜러"
              width={137}
              height={28}
              unoptimized
              className="h-5 w-auto lg:h-6"
            />
            <p className="mt-2 max-w-[280px] break-keep text-[12.5px] font-medium leading-relaxed text-text-muted lg:mt-3 lg:text-[13px]">
              허위견적 없이, 장기렌트·리스 조건을 먼저 비교하는 견적 서비스
            </p>
            <div className="mt-4 flex flex-wrap gap-2 lg:mt-5">
              <a
                href="mailto:contact@metakium.co.kr"
                className="inline-flex min-h-8 items-center rounded-pill bg-surface-soft px-3 text-[12px] font-bold text-text-body transition-colors duration-state hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 lg:min-h-9 lg:text-[12.5px]"
              >
                contact@metakium.co.kr
              </a>
              <span className="inline-flex min-h-8 items-center rounded-pill bg-surface-soft px-3 text-[12px] font-bold text-text-muted lg:min-h-9 lg:text-[12.5px]">
                평일 08:30-17:30
              </span>
            </div>
          </div>

          <nav className="hidden grid-cols-2 gap-6 lg:grid" aria-label="푸터 메뉴">
            <div>
              <h2 className="mb-2 text-[12px] font-extrabold text-text-muted">서비스</h2>
              <ul className="space-y-1">
                {PRIMARY_LINKS.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-[12px] font-extrabold text-text-muted">고객 지원</h2>
              <ul className="space-y-1">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="hidden rounded-[20px] border border-border-subtle bg-surface-soft px-5 py-4 lg:block">
            <h2 className="text-[12px] font-extrabold text-text-muted">사업자 정보</h2>
            <div className="mt-3 space-y-1.5 text-[12px] font-medium leading-relaxed text-text-body">
              {BUSINESS_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-border-subtle pt-4 lg:hidden">
          <FooterLink href="/about" label="아임딜러 소개" />
          {LEGAL_LINKS.map((link) => (
            <FooterLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        <div className="mt-3 rounded-[18px] border border-border-subtle bg-surface-soft lg:hidden">
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[12.5px] font-extrabold text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40">
              사업자·금융 고지
              <span className="text-[11.5px] font-bold text-text-muted group-open:hidden">보기</span>
              <span className="hidden text-[11.5px] font-bold text-text-muted group-open:inline">닫기</span>
            </summary>
            <div className="space-y-3 px-4 pb-4 text-[11.5px] font-medium leading-relaxed text-text-body">
              <div>
              {BUSINESS_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
              </div>
              <p>
                (주)메타키움은 금융상품판매대리·중개업자로서 제휴 금융사의 자동차 렌트·리스 상품을 안내합니다.
              </p>
              <Link
                href="/finance-terms"
                className="inline-flex min-h-8 items-center font-extrabold text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              >
                법적 고지 전문 보기
              </Link>
            </div>
          </details>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-[11px] font-medium leading-relaxed text-text-muted lg:mt-7 lg:border-t lg:border-border-subtle lg:pt-5 lg:text-[11.5px] lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} 아임딜러. All rights reserved.</p>
          <p>아임딜러는 고객에게 별도의 수수료를 요구하거나 수취하지 않습니다.</p>
        </div>
      </div>
    </footer>
  );
}
