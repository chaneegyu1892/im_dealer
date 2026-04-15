"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="flex items-center gap-2 text-red-500">
        <AlertCircle size={20} />
        <span className="text-[15px] font-semibold">오류가 발생했습니다</span>
      </div>
      <p className="text-[13px] text-[#9BA4C0] max-w-[300px] text-center">
        {error.message || "페이지를 불러오는 중 문제가 생겼습니다."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-[13px] font-medium bg-[#000666] text-white rounded-[8px] hover:bg-[#0008AA] transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
