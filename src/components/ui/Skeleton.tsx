import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-[6px] bg-[length:200%_100%] animate-shimmer",
        "bg-gradient-to-r from-[#f0f0f0] via-[#e0e0e0] to-[#f0f0f0]",
        className
      )}
    />
  );
}

export function RecommendCardSkeleton() {
  return (
    <div className="bg-white border border-[#F0F0F0] rounded-card shadow-card overflow-hidden">
      {/* 순위 배지 */}
      <div className="bg-neutral px-4 py-2.5">
        <Skeleton className="h-3 w-20" />
      </div>

      <div className="p-4 md:p-5 space-y-5">
        {/* 차량 헤더 */}
        <div className="flex items-center gap-4">
          <Skeleton className="w-24 h-16 rounded-[8px] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* AI 해설 */}
        <div className="rounded-btn p-4 border border-neutral-800 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1.5 mt-1">
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-5 w-20 rounded-pill" />
          </div>
        </div>

        {/* 견적 탭 */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-0">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="flex-1 h-10 rounded-none" />
            ))}
          </div>
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA 버튼 */}
        <Skeleton className="h-10 w-full rounded-btn" />
      </div>
    </div>
  );
}
