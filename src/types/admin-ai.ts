import type { RecommendationExclusion } from "@/lib/recommend/excluded-vehicles";
import type { OperationalEligibilityStatus } from "@/lib/recommend/operational-eligibility";
import type { FuelGroup } from "@/lib/recommend/overlap-profile";

export interface VehicleAiConfigDto {
  readonly vehicle: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly brand: string;
    readonly category: string;
    readonly isVisible: boolean;
  };
  readonly config: null | {
    readonly id: string;
    readonly profile: unknown;
    readonly isActive: boolean;
    readonly highlights: readonly string[];
    readonly aiCaption: string | null;
    readonly updatedAt: string;
  };
  readonly profileState: "missing" | "valid" | "legacy" | "invalid";
  readonly fuelGroup: FuelGroup | null;
  readonly exclusion: RecommendationExclusion | null;
  readonly coverage: Readonly<Record<"10000" | "20000" | "30000", OperationalEligibilityStatus>>;
}
