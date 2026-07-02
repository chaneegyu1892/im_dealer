import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Star, X } from "lucide-react";
import type { PublicReview } from "@/types/review";

type HomeReviewModalProps = {
  readonly review: PublicReview;
  readonly showImages: boolean;
  readonly onClose: () => void;
};

export function HomeReviewModal({
  review,
  showImages,
  onClose,
}: HomeReviewModalProps) {
  const images = showImages ? review.imageUrls : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const focusFirst = () => {
      const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(focusFirst, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-text-strong/65 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="후기 상세"
    >
      <div
        ref={dialogRef}
        className="relative flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-card-lg border border-border-subtle bg-surface shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface/90 text-text-strong shadow-card transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
        >
          <X size={16} />
        </button>

        <div className="space-y-5 overflow-y-auto p-6 sm:p-7">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={
                  i < review.rating
                    ? "fill-status-warning text-status-warning"
                    : "text-border-strong"
                }
              />
            ))}
            <span className="ml-2 text-[13px] font-bold text-text-muted">
              {review.rating}/5
            </span>
          </div>

          <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-text-body">
            {review.content}
          </p>

          {images.length > 0 && (
            <div className="space-y-2">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-[12px] border border-border-subtle bg-surface-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[activeIdx]}
                  alt={`첨부 ${activeIdx + 1}`}
                  className="h-full w-full select-none object-contain"
                  draggable={false}
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {images.map((url, idx) => (
                    <button
                      type="button"
                      key={url}
                      onClick={() => setActiveIdx(idx)}
                      className={
                        "h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 " +
                        (idx === activeIdx ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`썸네일 ${idx + 1}`}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border-subtle pt-4">
            <div>
              <p className="text-[14px] font-extrabold text-text-strong">{review.displayName}</p>
              {review.vehicleName && (
                <p className="mt-0.5 text-[12px] text-text-muted">
                  {review.vehicleName}
                </p>
              )}
            </div>
            <p className="text-[12px] text-text-muted">{review.reviewDate}</p>
          </div>

          <Link
            href={`/reviews/${review.id}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill text-[13px] font-extrabold text-brand transition-colors hover:text-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          >
            이 후기 자세히 보기
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
