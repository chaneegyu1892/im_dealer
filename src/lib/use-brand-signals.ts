"use client";

import { useEffect, useMemo, useState } from "react";
import { makeBrandComparator, type BrandSignal } from "@/lib/brand-sort";

interface UseBrandSignalsResult {
  signals: Map<string, BrandSignal>;
  comparator: (a: string, b: string) => number;
  loaded: boolean;
}

/**
 * 클라이언트 컴포넌트에서 브랜드 정렬에 필요한 신호를 비동기로 가져온다.
 *
 * 첫 렌더에는 빈 Map → 폴백 가나다 비교가 적용되고,
 * fetch 완료 후 정상 신호로 교체되어 SSOT 정렬이 활성화된다.
 *
 * SSR로 신호를 props 전달할 수 있는 경우엔 그쪽이 더 빠르므로 사용하지 않는다.
 */
export function useBrandSignals(): UseBrandSignalsResult {
  const [signals, setSignals] = useState<Map<string, BrandSignal>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let aborted = false;
    fetch("/api/brand-signals")
      .then((r) => r.json())
      .then((res) => {
        if (aborted || !res?.data) return;
        setSignals(new Map(Object.entries(res.data as Record<string, BrandSignal>)));
        setLoaded(true);
      })
      .catch(() => {
        if (!aborted) setLoaded(true);
      });
    return () => {
      aborted = true;
    };
  }, []);

  const comparator = useMemo(() => makeBrandComparator(signals), [signals]);

  return { signals, comparator, loaded };
}
