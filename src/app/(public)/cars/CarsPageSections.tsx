import { FeaturedCarsSlider } from "@/components/cars/FeaturedCarsSlider";
import type { VehicleListItem } from "@/types/api";

type CarsPageHeroProps = {
  readonly totalCount: number;
};

type FeaturedVehiclesSectionProps = {
  readonly vehicles: VehicleListItem[];
};

export function CarsPageHero({ totalCount }: CarsPageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_18%_14%,rgba(var(--color-brand-soft-rgb),1),transparent_42%),radial-gradient(circle_at_84%_0%,rgba(var(--color-status-info-soft-rgb),0.9),transparent_36%)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[min(760px,90vw)] -translate-x-1/2 rounded-[100%] bg-brand/10 blur-3xl" />
      <div className="page-container relative py-9 md:py-14">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold tracking-[0.02em] text-brand">
            차량 탐색 · 총 {totalCount}개 차종
          </p>
          <h1 className="break-keep text-[34px] font-extrabold leading-[1.08] tracking-[-0.04em] text-text-strong md:text-[54px]">
            월 납입금이 보이는
            <br />
            차량 리스트
          </h1>
          <p className="mt-4 max-w-xl break-keep text-[16px] font-semibold leading-relaxed text-text-body md:text-[18px]">
            관심 차종을 고르면 초기 비용과 주행거리 조건별 견적 흐름으로 바로 이어집니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FeaturedVehiclesSection({ vehicles }: FeaturedVehiclesSectionProps) {
  if (vehicles.length === 0) return null;

  return (
    <section className="mb-9 md:mb-11">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="t-kick mb-1.5">주목할 차량</p>
          <h2 className="text-[21px] font-extrabold text-text-strong md:text-[26px]">
            지금 가장 많이 비교하는 모델
          </h2>
        </div>
      </div>
      <FeaturedCarsSlider vehicles={vehicles} />
    </section>
  );
}
