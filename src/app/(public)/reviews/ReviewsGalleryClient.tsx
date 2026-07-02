"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessageSquareText } from "lucide-react";
import { BestReviewSection } from "@/components/reviews/BestReviewSection";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import {
  ReviewFilterBar,
  type ReviewFilterState,
  type VehicleFilterOption,
} from "@/components/reviews/ReviewFilterBar";
import type { PublicReview, ReviewSort } from "@/types/review";

interface ReviewsGalleryClientProps {
  bestReviews: PublicReview[];
  initialItems: PublicReview[];
  initialNextCursor: string | null;
  vehicles: VehicleFilterOption[];
  brands: string[];
}

const VALID_SORTS: ReviewSort[] = ["recent", "rating", "popular"];

function readFilterFromQuery(
  params: URLSearchParams,
  vehicles: VehicleFilterOption[]
): ReviewFilterState {
  const sortRaw = params.get("sort");
  const sort: ReviewSort = VALID_SORTS.includes(sortRaw as ReviewSort)
    ? (sortRaw as ReviewSort)
    : "recent";

  const vehicleId = params.get("vehicleId") ?? "";
  const brand = params.get("brand") ?? "";

  const ratingsRaw = params.get("ratings") ?? "";
  const ratings = Array.from(
    new Set(
      ratingsRaw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
    )
  ).sort((a, b) => b - a);

  const withImages =
    params.get("withImages") === "1" || params.get("withImages") === "true";

  const validVehicleId = vehicles.some((v) => v.id === vehicleId)
    ? vehicleId
    : "";
  const validBrand = brand && vehicles.some((v) => v.brand === brand)
    ? brand
    : "";

  return {
    vehicleId: validVehicleId,
    brand: validBrand,
    ratings,
    withImages,
    sort,
  };
}

function filterToQueryString(state: ReviewFilterState): string {
  const params = new URLSearchParams();
  if (state.vehicleId) params.set("vehicleId", state.vehicleId);
  if (state.brand && !state.vehicleId) params.set("brand", state.brand);
  if (state.ratings.length > 0) params.set("ratings", state.ratings.join(","));
  if (state.withImages) params.set("withImages", "1");
  if (state.sort !== "recent") params.set("sort", state.sort);
  return params.toString();
}

export function ReviewsGalleryClient({
  bestReviews,
  initialItems,
  initialNextCursor,
  vehicles,
  brands,
}: ReviewsGalleryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = useMemo(
    () => readFilterFromQuery(new URLSearchParams(searchParams?.toString() ?? ""), vehicles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [filter, setFilter] = useState<ReviewFilterState>(initialFilter);
  const [items, setItems] = useState<PublicReview[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInitialFilter = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildApiUrl = useCallback(
    (cursor: string | null, current: ReviewFilterState) => {
      const params = new URLSearchParams();
      if (current.vehicleId) params.set("vehicleId", current.vehicleId);
      else if (current.brand) params.set("brand", current.brand);
      if (current.ratings.length > 0)
        params.set("ratings", current.ratings.join(","));
      if (current.withImages) params.set("withImages", "1");
      params.set("sort", current.sort);
      params.set("limit", "12");
      if (cursor) params.set("cursor", cursor);
      return `/api/public/reviews?${params.toString()}`;
    },
    []
  );

  // Sync filter changes to URL + refetch
  useEffect(() => {
    if (isInitialFilter.current) {
      isInitialFilter.current = false;
      return;
    }

    const queryString = filterToQueryString(filter);
    const targetUrl = queryString ? `/reviews?${queryString}` : "/reviews";
    router.replace(targetUrl, { scroll: false });

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(buildApiUrl(null, filter), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          success: boolean;
          data: { items: PublicReview[]; nextCursor: string | null };
        };
        if (cancelled) return;
        if (json.success) {
          setItems(json.data.items);
          setNextCursor(json.data.nextCursor);
        }
      })
      .catch(() => {
        if (!cancelled) setError("후기를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, router, buildApiUrl]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildApiUrl(nextCursor, filter), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        success: boolean;
        data: { items: PublicReview[]; nextCursor: string | null };
      };
      if (json.success) {
        setItems((prev) => [...prev, ...json.data.items]);
        setNextCursor(json.data.nextCursor);
      }
    } catch {
      setError("추가 후기를 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loading, filter, buildApiUrl]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-10">
      <BestReviewSection reviews={bestReviews} />

      <section className="space-y-5">
        <ReviewFilterBar
          vehicles={vehicles}
          brands={brands}
          state={filter}
          onChange={setFilter}
          resultCount={items.length}
        />

        {error && (
          <InlineAlert variant="danger" title="후기를 불러오지 못했습니다">
            {error}
          </InlineAlert>
        )}

        {loading && items.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-card border border-border-subtle bg-surface text-[13px] font-bold text-text-muted">
            <Loader2 className="animate-spin mr-2" size={18} /> 불러오는 중
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText size={26} />}
            title="조건에 맞는 후기가 없습니다"
            description="차량, 브랜드, 별점 필터를 줄이면 더 많은 후기를 볼 수 있어요."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-12 flex items-center justify-center">
          {loadingMore && (
            <span className="inline-flex items-center text-[12px] font-bold text-g2">
              <Loader2 className="animate-spin mr-1.5" size={14} /> 더
              불러오는 중
            </span>
          )}
          {!nextCursor && items.length > 0 && !loading && (
            <span className="text-[12px] text-g2">
              마지막 후기입니다.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
