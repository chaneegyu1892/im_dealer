export const CARPAN2_IMAGE_TYPES = {
  MAIN: "MAIN",
  COVER: "COVER",
  EXTERIOR_COLOR: "EXTERIOR_COLOR",
  INTERIOR_COLOR: "INTERIOR_COLOR",
  SPEC_EXTERIOR: "SPEC_EXTERIOR",
  SPEC_INTERIOR: "SPEC_INTERIOR",
  SPEC_SEAT: "SPEC_SEAT",
  SPEC_OPTION: "SPEC_OPTION",
  CATALOG_PAGE: "CATALOG_PAGE",
} as const;

export type Carpan2ImageType = (typeof CARPAN2_IMAGE_TYPES)[keyof typeof CARPAN2_IMAGE_TYPES];

export type ImageMetadata = Readonly<Record<string, string | number | boolean>>;

export type Carpan2ImageCandidate = {
  readonly vehicleExternalId: string;
  readonly type: Carpan2ImageType;
  readonly title: string | null;
  readonly sourceUrl: string;
  readonly sourceKey: string;
  readonly displayOrder: number;
  readonly metadata: ImageMetadata;
};

export type Carpan2ImageColor = {
  readonly colorId: string;
  readonly name: string | null;
};

export type Carpan2CatalogFile = {
  readonly fileId: string;
  readonly name: string | null;
  readonly dir: string | null;
  readonly count: number | null;
};

export type Carpan2ModelItemFeature = {
  readonly name: string | null;
  readonly photo: string | null;
};

export type Carpan2ModelItemFile = {
  readonly image: string | null;
  readonly title: string | null;
  readonly linkItem: string | null;
};

export type Carpan2ModelItemOption = {
  readonly photo: string | null;
};

export type Carpan2ColorExtImage = {
  readonly url: string | null;
};

export type Carpan2ColorIntImage = {
  readonly url: string | null;
  readonly subject: string | null;
};

export type Carpan2ModelItem = {
  readonly item: Readonly<Record<string, Carpan2ModelItemFeature>>;
  readonly model: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly kind: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, Carpan2ModelItemFile>>;
  readonly option: Readonly<Record<string, Carpan2ModelItemOption>>;
  readonly colorExt: Readonly<Record<string, Readonly<Record<string, Carpan2ColorExtImage>>>>;
  readonly colorInt: Readonly<Record<string, readonly Carpan2ColorIntImage[]>>;
};

export type Carpan2ImageVehicle = {
  readonly modelId: string;
  readonly brandName: string;
  readonly modelName: string;
  readonly image: string | null;
  readonly imageLarge: string | null;
  readonly cover: string | null;
  readonly catalogFiles: readonly Carpan2CatalogFile[];
  readonly exteriorColors: readonly Carpan2ImageColor[];
  readonly interiorColors: readonly Carpan2ImageColor[];
  readonly modelItem: Carpan2ModelItem | null;
};

export type ImageExtractionOptions = {
  readonly includeOptionImages: boolean;
};
