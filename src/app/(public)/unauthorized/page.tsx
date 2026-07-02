import Link from "next/link";
import { Home, LogIn, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "접근 권한 없음 | 아임딜러",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16 text-center">
      <section className="w-full max-w-md rounded-card border border-border-subtle bg-surface p-6 shadow-card md:p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-soft">
          <ShieldAlert size={24} className="text-status-warning" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-[22px] font-extrabold text-text-strong">
          접근 권한이 없습니다
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-text-body">
          이 페이지를 볼 수 있는 권한이 없어요. 다른 계정으로 로그인하거나 홈으로 돌아가 주세요.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-pressed"
        >
          <Home size={16} aria-hidden="true" />
          홈으로
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn border border-border-subtle bg-surface-soft px-5 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
        >
          <LogIn size={16} aria-hidden="true" />
          로그인
        </Link>
      </div>
      </section>
    </div>
  );
}
