"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import { FeaturedCard } from "@/components/cars/FeaturedCard";

/**
 * "주목할 차량" 슬라이더 — 어드민이 지정한(isSpotlight) 차량을 가로 슬라이드로 노출.
 * - 좌우 이전/다음 버튼으로 수동 이동 (자동 넘김 없음)
 * - 카드 호버 시 살짝 확대 + 강조
 * - 데스크톱·태블릿 2장 / 모바일 1장 노출(scroll-snap)
 */
export function FeaturedCarsSlider({ vehicles }: { vehicles: VehicleListItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const edgeTolerance = 16;
    const max = el.scrollWidth - el.clientWidth;
    setScrollable(max > 4);
    setAtStart(el.scrollLeft <= edgeTolerance);
    setAtEnd(el.scrollLeft >= max - edgeTolerance);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, vehicles.length]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.clientWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (vehicles.length === 0) return null;

  return (
    <div className="relative overflow-visible">
      {/* 이전 버튼 */}
      {scrollable && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="이전 차량"
          className={cn(
            "absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 md:flex",
            "h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-text-strong shadow-float",
            "transition-all duration-200",
            atStart ? "pointer-events-none opacity-0" : "opacity-100 hover:scale-105 hover:border-brand/35 hover:text-brand",
          )}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
      )}

      {/* 트랙 (가로 스크롤 + snap). py-4 로 호버 확대 시 세로 클리핑 방지 */}
      <div
        ref={scrollRef}
        className="-mx-2 flex snap-x snap-mandatory gap-5 overflow-x-auto px-2 py-5 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className={cn(
              "snap-start shrink-0 transition-transform duration-300 ease-out hover:z-10",
              "w-[calc(100%-4px)] sm:w-[calc(50%-10px)]",
            )}
          >
            <FeaturedCard vehicle={vehicle} size="small" />
          </div>
        ))}
      </div>

      {/* 다음 버튼 */}
      {scrollable && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="다음 차량"
          className={cn(
            "absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 md:flex",
            "h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-text-strong shadow-float",
            "transition-all duration-200",
            atEnd ? "pointer-events-none opacity-0" : "opacity-100 hover:scale-105 hover:border-brand/35 hover:text-brand",
          )}
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
