export interface ExternalFile {
  readonly url1?: string;
  readonly url2?: string;
  readonly url3?: string;
  readonly kind?: string;
  readonly name?: string;
  readonly count?: number;
  readonly dir?: string;
}

type ExternalRange = {
  readonly min?: string;
  readonly max?: string;
};

type ExternalEfficiency = Record<
  string,
  { readonly name?: string; readonly min?: string; readonly max?: string; readonly unit?: string }
>;

export interface ExternalModel {
  readonly name?: string;
  readonly open?: string;
  readonly update?: string;
  readonly state?: string;
  readonly cartype?: string;
  readonly image?: string;
  readonly imageL?: string;
  readonly cover?: string;
  readonly delivery?: string;
  readonly deliveryShip?: string;
  readonly catalogF?: string;
  readonly priceF?: string;
  readonly summary?: string;
  readonly homepage?: string;
  readonly warranty?: string;
  readonly brand?: string;
  readonly lineup?: string;
  readonly option?: string;
  readonly colorExt?: string;
  readonly colorInt?: string;
  readonly spec?: Readonly<Record<string, string>>;
  readonly price?: { readonly min?: number | string; readonly max?: number | string };
  readonly displace?: ExternalRange;
  readonly power?: { readonly min?: number; readonly max?: number };
  readonly engine?: string;
  readonly efficiency?: ExternalEfficiency;
}

export interface ExternalLineup {
  readonly catalogF?: string;
  readonly priceF?: string;
  readonly cover?: string;
  readonly imageL?: string;
  readonly image?: string;
  readonly model?: string;
  readonly open?: string;
  readonly state?: string;
  readonly cartype?: string;
  readonly name?: string;
  readonly year?: string;
  readonly trim?: string;
  readonly price?: { readonly min?: number | string; readonly max?: number | string };
  readonly displace?: ExternalRange;
  readonly engine?: string;
  readonly colorExt?: string;
  readonly colorInt?: string;
  readonly spec?: Readonly<Record<string, string>>;
  readonly efficiency?: ExternalEfficiency;
  readonly power?: { readonly min?: number; readonly max?: number };
  readonly items?: string;
}

export interface ExternalTrim {
  readonly lineup?: string;
  readonly name?: string;
  readonly tm?: string;
  readonly state?: string;
  readonly cartype?: string;
  readonly open?: string;
  readonly division?: string;
  readonly extra?: string;
  readonly engine?: string;
  readonly displace?: string;
  readonly person?: string;
  readonly carry?: string;
  readonly price?: string;
  readonly tax?: string;
  readonly option?: string;
  readonly colorExt?: string;
  readonly colorInt?: string;
  readonly items?: string;
  readonly itemsLink?: string;
  readonly spec?: Readonly<Record<string, string>>;
  readonly specoption?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface ExternalOption {
  readonly name?: string;
  readonly kind?: string;
  readonly apply?: string;
  readonly extNot?: string;
  readonly intNot?: string;
  readonly extJoin?: string;
  readonly intJoin?: string;
  readonly guide?: string;
  readonly package?: string;
  readonly packageRemark?: string;
  readonly change?: string;
  readonly items?: string;
}

export interface ExternalColorExt {
  readonly name?: string;
  readonly code?: string;
  readonly group?: string;
  readonly rgb?: string;
  readonly rgb2?: string;
  readonly optionJoin?: string;
  readonly optionNot?: string;
  readonly intNot?: string;
}

export interface ExternalColorInt {
  readonly name?: string;
  readonly group?: string;
  readonly rgb?: string;
  readonly rgb2?: string;
  readonly optionJoin?: string;
  readonly optionNot?: string;
  readonly extNot?: string;
}

export interface ExternalDocument {
  readonly content?: string;
  readonly remark?: string;
  readonly link?: string;
  readonly table?: string;
  readonly tableIdx?: string;
}

export interface ExternalModelEntry {
  readonly modelId: string;
  readonly listMeta?: {
    readonly name?: string;
    readonly state?: string;
    readonly image?: string;
    readonly cartype?: string;
    readonly priceMin?: string;
    readonly priceMax?: string;
    readonly recentMY?: string;
  };
  readonly detail: {
    readonly brand?: Readonly<Record<string, { readonly name?: string; readonly logo?: string; readonly local?: string }>>;
    readonly cartype?: Readonly<Record<string, { readonly name?: string }>>;
    readonly engine?: Readonly<Record<string, { readonly name?: string }>>;
    readonly model?: Readonly<Record<string, ExternalModel>>;
    readonly lineup?: Readonly<Record<string, ExternalLineup>>;
    readonly trim?: Readonly<Record<string, ExternalTrim>>;
    readonly option?: Readonly<Record<string, ExternalOption>>;
    readonly colorExt?: Readonly<Record<string, ExternalColorExt>>;
    readonly colorInt?: Readonly<Record<string, ExternalColorInt>>;
    readonly document?: Readonly<Record<string, ExternalDocument>>;
    readonly spec?: Readonly<Record<string, Readonly<Record<string, string>>>>;
    readonly specGroup?: Readonly<Record<string, { readonly name?: string; readonly list?: string }>>;
    readonly specDefine?: Readonly<Record<string, { readonly name?: string; readonly unit?: string; readonly group?: string }>>;
    readonly files?: Readonly<Record<string, ExternalFile>>;
  };
}

export interface ExternalBrand {
  readonly brandId: string;
  readonly name: string;
  readonly meta?: { readonly logo?: string };
  readonly models: Readonly<Record<string, ExternalModelEntry>>;
}

export interface ExternalFileFormat {
  readonly meta: { readonly source: string; readonly brandCount: number; readonly modelCount: number };
  readonly lookups: Readonly<Record<string, unknown>>;
  readonly brands: Readonly<Record<string, ExternalBrand>>;
}

export interface LegacyImportStats {
  modelsProcessed: number;
  modelsCreated: number;
  modelsUpdated: number;
  modelsSkipped: number;
  lineups: number;
  trims: number;
  options: number;
  colors: number;
  errors: { modelId: string; error: string }[];
}

export function createLegacyImportStats(): LegacyImportStats {
  return {
    modelsProcessed: 0,
    modelsCreated: 0,
    modelsUpdated: 0,
    modelsSkipped: 0,
    lineups: 0,
    trims: 0,
    options: 0,
    colors: 0,
    errors: [],
  };
}
