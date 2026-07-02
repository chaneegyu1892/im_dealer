import { Search, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-app-bg px-4 py-12 text-text-body">
      <div className="w-full max-w-md rounded-card-lg border border-border-subtle bg-surface p-6 text-center shadow-card md:p-8">
        {/* 아이콘 */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
          <Search size={24} className="text-brand" />
        </div>

        {/* 404 숫자 */}
        <p className="mb-2 text-[56px] font-extrabold leading-none tracking-normal text-brand md:text-[64px]">
          404
        </p>

        {/* 메시지 */}
        <h1 className="mb-2 text-[20px] font-extrabold text-text-strong">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mb-8 text-[14px] leading-relaxed text-text-body">
          요청하신 페이지가 존재하지 않거나,
          <br />
          주소가 변경되었을 수 있습니다.
        </p>

        {/* 액션 */}
        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[14px] font-bold text-white transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <Home size={16} />
            홈으로 돌아가기
          </Link>
          <Link
            href="/cars"
            className="inline-flex min-h-11 items-center justify-center rounded-btn border border-border-subtle bg-surface-soft px-5 text-[14px] font-bold text-text-strong transition-all duration-state hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            차량 탐색하기
          </Link>
        </div>
      </div>
    </div>
  );
}
