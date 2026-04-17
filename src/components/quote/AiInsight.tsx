import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiInsightProps {
  reason: string;
  highlights: string[];
  className?: string;
}

export function AiInsight({ reason, highlights, className }: AiInsightProps) {
  return (
    <div
      className={cn(
        "rounded-btn p-4 border border-primary-200 bg-primary-100",
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary">
          <Sparkles size={11} className="text-white" />
        </span>
        <span className="text-[12px] font-medium text-primary">AI 추천 이유</span>
      </div>

      {/* 이유 텍스트 */}
      <div className="text-[13px] text-ink leading-relaxed space-y-1">
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
              className="text-[11px] font-medium text-primary bg-white border border-primary-200 rounded-pill px-2.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
