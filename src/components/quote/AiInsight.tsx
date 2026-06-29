import { cn } from "@/lib/utils";
import { AiBadge } from "@/components/ui/AiBadge";

interface AiInsightProps {
  reason: string;
  highlights: string[];
  className?: string;
}

export function AiInsight({ reason, highlights, className }: AiInsightProps) {
  return (
    <div
      className={cn(
        "rounded-card p-4 border border-brand/30 bg-brand-soft",
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <AiBadge />
        <span className="text-[13px] font-bold text-brand">추천 이유</span>
      </div>

      {/* 이유 텍스트 */}
      <div className="text-[14px] text-ink leading-relaxed space-y-1">
        {reason.split(/(?<=\.) /).map((sentence, i) => (
          sentence.trim() && <p key={i}>{sentence.trim()}</p>
        ))}
      </div>

      {/* 특징 배지 */}
      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {highlights.map((tag) => (
            <span
              key={tag}
              className="text-[12.5px] font-bold text-brand bg-white border border-brand/30 rounded-pill px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
