import {
  NO_SIMPLE_PREFERENCE_VALUE,
  NO_SITUATION_PREFERENCE_VALUE,
} from "@/constants/recommend-options";
import type { RecommendInput } from "@/types/recommendation";
import type { StepId } from "./StepIndicator";

export type ChargingEnvironment = "자택" | "직장" | "외부" | "없음" | "";

export interface RecommendFlowState {
  readonly industry: string;
  readonly budgetMax: number | null;
  readonly simplePreference: string;
  readonly situationPreference: string;
  readonly childDetail: string;
  readonly cargoDetail: string;
  readonly annualMileage: number;
  readonly fuelPreference: string;
  readonly chargingEnvironment: ChargingEnvironment;
  readonly residenceRegion: "일반" | "강원·산간" | "제주";
}

export const INITIAL_RECOMMEND_FLOW_STATE: RecommendFlowState = {
  industry: "",
  budgetMax: null,
  simplePreference: "",
  situationPreference: "",
  childDetail: "",
  cargoDetail: "",
  annualMileage: 0,
  fuelPreference: "",
  chargingEnvironment: "",
  residenceRegion: "일반",
};

export function isRecommendStepValid(
  step: StepId,
  state: RecommendFlowState
): boolean {
  switch (step) {
    case 1:
      return state.industry !== "" && state.budgetMax !== null;
    case 2:
      if (state.simplePreference === "" || state.situationPreference === "") return false;
      if (state.situationPreference === "가족" && state.childDetail === "") return false;
      if (state.situationPreference === "화물" && state.cargoDetail === "") return false;
      return true;
    case 3:
      return state.annualMileage !== 0
        && state.fuelPreference !== ""
        && (state.fuelPreference !== "전기차" || state.chargingEnvironment !== "");
  }
}

export function buildRecommendInput(state: RecommendFlowState): RecommendInput {
  const preferences = [state.simplePreference, state.situationPreference].filter(
    (preference) => preference !== ""
      && preference !== NO_SIMPLE_PREFERENCE_VALUE
      && preference !== NO_SITUATION_PREFERENCE_VALUE
  );

  return {
    industry: state.industry,
    budgetMin: 0,
    budgetMax: state.budgetMax ?? 0,
    preferences,
    annualMileage: state.annualMileage,
    returnType: "미정",
    ...(state.simplePreference !== ""
      && state.simplePreference !== NO_SIMPLE_PREFERENCE_VALUE
      ? { primaryPreference: state.simplePreference }
      : {}),
    ...(state.situationPreference !== ""
      && state.situationPreference !== NO_SITUATION_PREFERENCE_VALUE
      ? { situationPreference: state.situationPreference }
      : {}),
    ...(state.situationPreference === "가족" && state.childDetail !== ""
      ? { childDetail: state.childDetail }
      : {}),
    ...(state.situationPreference === "화물" && state.cargoDetail !== ""
      ? { cargoDetail: state.cargoDetail }
      : {}),
    fuelPreference: state.fuelPreference,
    ...(state.fuelPreference === "전기차" && state.chargingEnvironment !== ""
      ? { chargingEnvironment: state.chargingEnvironment }
      : {}),
    residenceRegion: state.residenceRegion,
  };
}
