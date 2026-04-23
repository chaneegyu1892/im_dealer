import { Search, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 아이콘 */}
        <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-5">
          <Search size={24} className="text-primary" />
        </div>

        {/* 404 숫자 */}
        <p className="text-[64px] font-light text-primary leading-none mb-2">
          404
        </p>

        {/* 메시지 */}
        <h1 className="text-[20px] font-medium text-ink mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-[14px] text-ink-body leading-relaxed mb-8">
          요청하신 페이지가 존재하지 않거나,
          <br />
          주소가 변경되었을 수 있습니다.
        </p>

        {/* 액션 */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2"
          >
            <Home size={16} />
            홈으로 돌아가기
          </Link>
          <Link
            href="/cars"
            className="btn-secondary inline-flex items-center gap-2"
          >
            차량 탐색하기
          </Link>
        </div>
      </div>
    </div>
  );
}

