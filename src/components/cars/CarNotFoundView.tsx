import { CarFront, Home, Search } from "lucide-react";
import Link from "next/link";

export function CarNotFoundView() {
  return (
    <section className="flex min-h-[calc(100dvh-56px)] items-center justify-center bg-app-bg px-4 py-12 text-text-body lg:min-h-[calc(100dvh-72px)]">
      <div className="w-full max-w-md rounded-card-lg border border-border-subtle bg-surface p-6 text-center shadow-card md:p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Search size={24} strokeWidth={2.2} />
        </div>
        <p className="mb-2 text-[52px] font-extrabold leading-none tracking-normal text-brand md:text-[60px]">
          404
        </p>
        <h1 className="mb-2 text-[20px] font-extrabold text-text-strong">
          차량을 찾을 수 없습니다
        </h1>
        <p className="mb-8 text-[14px] leading-relaxed text-text-body">
          판매가 중단되었거나 주소가 변경된 차량입니다.
          <br />
          현재 비교 가능한 차량 목록에서 다시 선택해 주세요.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
          <Link
            href="/cars"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[14px] font-bold text-white transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <CarFront size={16} />
            차량 탐색하기
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-border-subtle bg-surface-soft px-5 text-[14px] font-bold text-text-strong transition-all duration-state hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <Home size={16} />
            홈으로
          </Link>
        </div>
      </div>
    </section>
  );
}
