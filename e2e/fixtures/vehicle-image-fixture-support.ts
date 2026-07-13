export const E2E_RATE_MATRIX = {
  "36_10000": 0.02, "36_20000": 0.02, "36_30000": 0.02,
  "48_10000": 0.02, "48_20000": 0.02, "48_30000": 0.02,
  "60_10000": 0.02, "60_20000": 0.02, "60_30000": 0.02,
} as const;

function bestScores(keys: readonly string[]): Readonly<Record<string, "best">> {
  return Object.fromEntries(keys.map((key) => [key, "best"]));
}

export function e2eRecommendationProfile() {
  return {
    version: "overlap-v2",
    fuelGroup: "ICE",
    companyPriority: 1,
    profitPriority: 1,
    scores: {
      industry: bestScores(["법인", "개인사업자", "개인"]),
      primaryPreference: bestScores(["안정감", "주차편의", "경제성", "고급"]),
      additionalCondition: {
        family: { default: "best", details: bestScores(["영유아", "미취학", "초등", "중학생+"]) },
        cargo: { default: "best", details: bestScores(["소형 박스", "대형 화물"]) },
      },
      annualMileage: bestScores(["10000", "20000", "30000"]),
      region: bestScores(["일반", "강원·산간", "제주"]),
    },
  } as const;
}

export async function installNoLinkPrefetch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g" },
    });
    const NativeIntersectionObserver = window.IntersectionObserver;
    class E2EIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null;
      readonly rootMargin: string;
      readonly thresholds: readonly number[];
      private readonly native: IntersectionObserver;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.native = new NativeIntersectionObserver(callback, options);
        this.root = this.native.root;
        this.rootMargin = this.native.rootMargin;
        this.thresholds = this.native.thresholds;
      }

      disconnect(): void { this.native.disconnect(); }
      observe(target: Element): void {
        if (!(target instanceof HTMLAnchorElement)) this.native.observe(target);
      }
      takeRecords(): IntersectionObserverEntry[] { return this.native.takeRecords(); }
      unobserve(target: Element): void { this.native.unobserve(target); }
    }
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: E2EIntersectionObserver });
  });
}
import type { Page } from "@playwright/test";
