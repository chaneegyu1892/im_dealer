export type DbTrimSnapshot = {
  readonly externalId: string;
  readonly name: string;
  readonly price: number;
  readonly isVisible: boolean;
  readonly activeRateSheetCount: number;
};

export type DbVehicleSnapshot = {
  readonly externalId: string;
  readonly brand: string;
  readonly name: string;
  readonly isVisible: boolean;
  readonly trims: readonly DbTrimSnapshot[];
};

export type CrawlLineupSnapshot = {
  readonly lineupId: string;
  readonly name: string;
  readonly year: string | null;
  readonly state: string | null;
};

export type CrawlTrimSnapshot = {
  readonly trimId: string;
  readonly lineupId: string | null;
  readonly name: string | null;
  readonly price: number | null;
  readonly state: string | null;
  readonly engineCode: string | null;
  readonly displace: string | null;
  readonly person: string | null;
  readonly carry: string | null;
  readonly options: readonly CrawlTrimOptionSnapshot[];
};

export type CrawlVehicleSnapshot = {
  readonly modelId: string;
  readonly brandName: string;
  readonly modelName: string;
  readonly cartypeCode: string | null;
  readonly engineCode: string | null;
  readonly state: string | null;
  readonly summary: string | null;
  readonly priceMin: number | null;
  readonly imageLarge: string | null;
  readonly cover: string | null;
  readonly catalogFileCount: number;
  readonly priceFileCount: number;
  readonly catalogFiles: readonly CrawlFileSnapshot[];
  readonly priceFiles: readonly CrawlFileSnapshot[];
  readonly options: readonly CrawlOptionDefinitionSnapshot[];
  readonly exteriorColors: readonly CrawlColorSnapshot[];
  readonly interiorColors: readonly CrawlColorSnapshot[];
  readonly lineups: readonly CrawlLineupSnapshot[];
  readonly trims: readonly CrawlTrimSnapshot[];
};

export type CrawlFileSnapshot = {
  readonly fileId: string;
  readonly name: string | null;
  readonly kind: string | null;
  readonly url1: string | null;
  readonly url2: string | null;
  readonly url3: string | null;
  readonly dir: string | null;
  readonly count: number | null;
};

export type CrawlOptionDefinitionSnapshot = {
  readonly optionId: string;
  readonly name: string | null;
  readonly kind: string | null;
  readonly apply: string | null;
  readonly guide: string | null;
  readonly package: string | null;
  readonly change: string | null;
};

export type CrawlTrimOptionSnapshot = {
  readonly optionId: string;
  readonly name: string | null;
  readonly price: number;
  readonly condition: string | null;
  readonly flag: string | null;
};

export type CrawlColorSnapshot = {
  readonly colorId: string;
  readonly name: string | null;
  readonly code: string | null;
  readonly price: number;
  readonly rgb: string | null;
  readonly rgb2: string | null;
  readonly flag: string | null;
};

export type BuildCarpan2SyncPlanInput = {
  readonly dbVehicles: readonly DbVehicleSnapshot[];
  readonly crawlVehicles: readonly CrawlVehicleSnapshot[];
};

export type InvalidVehicleCandidate = {
  readonly vehicleExternalId: string;
  readonly brand: string;
  readonly name: string;
  readonly reason: string;
};

export type InvalidTrimCandidate = {
  readonly vehicleExternalId: string;
  readonly trimExternalId: string;
  readonly name: string;
  readonly reason: string;
};

export type RatedTrimRisk = {
  readonly vehicleExternalId: string;
  readonly trimExternalId: string;
  readonly dbName: string;
  readonly crawlName: string | null;
  readonly crawlState: string | null;
  readonly activeRateSheetCount: number;
};

export type Carpan2SyncPlan = {
  readonly totals: {
    readonly dbVehicles: number;
    readonly crawlVehicles: number;
    readonly dbTrims: number;
    readonly crawlTrims: number;
    readonly crawlLineups: number;
    readonly catalogFiles: number;
    readonly priceFiles: number;
    readonly vehiclesWithImageLarge: number;
    readonly vehiclesWithCover: number;
  };
  readonly vehicleActions: {
    readonly insertNew: number;
    readonly updateExisting: number;
    readonly preserveDbOnly: number;
    readonly skipInvalid: readonly InvalidVehicleCandidate[];
  };
  readonly trimActions: {
    readonly insertNew: number;
    readonly updateExisting: number;
    readonly preserveDbOnly: number;
    readonly rewriteVisibilityCandidates: number;
    readonly skipInvalid: readonly InvalidTrimCandidate[];
  };
  readonly ratedSafety: {
    readonly ratedVehicles: number;
    readonly ratedTrims: number;
    readonly missingRatedVehicles: readonly string[];
    readonly missingRatedTrims: readonly RatedTrimRisk[];
    readonly stateChangedRatedTrims: readonly RatedTrimRisk[];
    readonly valueChangedRatedTrims: readonly RatedTrimRisk[];
  };
};
