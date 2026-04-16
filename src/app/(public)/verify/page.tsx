import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "./VerifyClient";

export const metadata: Metadata = {
  title: "서류 간편 확인 | 아임딜러",
  description: "공공기관 서류를 비대면으로 간편하게 확인하세요.",
};

function VerifyLoadingSkeleton() {
  return (
    <div className="page-container py-10 max-w-md mx-auto animate-pulse">
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              {i > 1 && <div className="h-[2px] w-16 bg-neutral-800 rounded-sm" />}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-neutral-800" />
                <div className="w-8 h-2 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-32 rounded-card bg-neutral-800" />
        <div className="h-12 rounded-card bg-neutral-800" />
        <div className="h-12 rounded-card bg-neutral-800" />
        <div className="h-12 rounded-btn bg-neutral-800 mt-8" />
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="bg-white border-b border-[#F0F0F0] py-6">
        <div className="page-container max-w-md mx-auto">
          <h1 className="text-title-sm text-ink font-medium">서류 간편 확인</h1>
          <p className="text-label text-ink-label mt-1">
            비대면으로 공공기관 서류를 안전하게 확인해요.
          </p>
        </div>
      </div>

      <Suspense fallback={<VerifyLoadingSkeleton />}>
        <VerifyClient />
      </Suspense>
    </div>
  );
}
