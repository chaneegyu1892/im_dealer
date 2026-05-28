import Link from "next/link";

export const metadata = {
  title: "접근 권한 없음 | 아임딜러",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-[#1A1A2E] mb-3">
        접근 권한이 없습니다
      </h1>
      <p className="text-sm text-[#6B7280] mb-8">
        이 페이지를 볼 수 있는 권한이 없어요. 다른 계정으로 로그인하거나 홈으로 돌아가 주세요.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-[#000666] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          홈으로
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#1A1A2E] hover:bg-[#F8F9FC] transition-colors"
        >
          로그인
        </Link>
      </div>
    </div>
  );
}
