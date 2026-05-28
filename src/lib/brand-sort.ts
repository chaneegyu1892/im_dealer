/**
 * 브랜드 정렬 SSOT — 어드민과 공개 페이지 전반에서 동일하게 사용한다.
 *
 * 정렬 규칙:
 *   1) isFeatured = true 그룹이 항상 먼저 (인기 브랜드)
 *   2) 인기 그룹 안에서는 displayOrder ASC (운영자가 어드민에서 직접 통제)
 *      └ displayOrder 동률이면 차량 수 DESC, 그것도 동률이면 가나다
 *   3) 일반 그룹 안에서는 차량 수 DESC, 동률이면 가나다
 *      └ 자동 정렬: 우리 플랫폼에 차량을 많이 등록한 브랜드가 위로
 *
 * 신호가 없는 브랜드(맵에 미등록 = Brand 테이블에 없는 잔여 문자열)는
 * 가장 뒤로 보낸다.
 *
 * 사용 패턴:
 *   const cmp = makeBrandComparator(signals);
 *   brandNames.sort(cmp);
 */

export interface BrandSignal {
  /** 인기 브랜드 그룹 여부 (Brand.isFeatured) */
  isFeatured: boolean;
  /** 인기 그룹 내 운영자 지정 순서 (Brand.displayOrder, 작을수록 위) */
  displayOrder: number;
  /** 해당 브랜드를 사용하는 차량(Vehicle) 수 */
  vehicleCount: number;
}

export type BrandSignalMap = ReadonlyMap<string, BrandSignal>;

/**
 * BrandSignalMap 을 받아 (a, b) => number 형태의 비교 함수를 만든다.
 * Array.prototype.sort 등에 바로 전달 가능.
 */
export function makeBrandComparator(
  signals: BrandSignalMap
): (a: string, b: string) => number {
  return function compareBrands(a: string, b: string): number {
    const sa = signals.get(a);
    const sb = signals.get(b);

    // 신호가 없는 브랜드는 모두 뒤로 (예외적 상황 — Brand 테이블 누락)
    if (!sa && !sb) return a.localeCompare(b, "ko");
    if (!sa) return 1;
    if (!sb) return -1;

    // 1) isFeatured 우선
    if (sa.isFeatured !== sb.isFeatured) {
      return sa.isFeatured ? -1 : 1;
    }

    if (sa.isFeatured) {
      // 인기 그룹: displayOrder ASC 가 1차 (운영자 통제)
      if (sa.displayOrder !== sb.displayOrder) {
        return sa.displayOrder - sb.displayOrder;
      }
      // 동률이면 차량 수 DESC
      if (sa.vehicleCount !== sb.vehicleCount) {
        return sb.vehicleCount - sa.vehicleCount;
      }
    } else {
      // 일반 그룹: 차량 수 DESC 가 1차 (자동)
      if (sa.vehicleCount !== sb.vehicleCount) {
        return sb.vehicleCount - sa.vehicleCount;
      }
    }

    // 마지막 안정성: 가나다
    return a.localeCompare(b, "ko");
  };
}
