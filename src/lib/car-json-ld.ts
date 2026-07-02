interface CarJsonLdInput {
  readonly siteUrl: string;
  readonly slug: string;
  readonly name: string;
  readonly brand: string;
  readonly category: string;
  readonly description: string | null;
  readonly thumbnailUrl: string | null;
  readonly trims: readonly { readonly price: number }[];
  readonly basePrice: number;
}

export function buildCarJsonLd(v: CarJsonLdInput): Record<string, unknown>[] {
  const url = `${v.siteUrl}/cars/${v.slug}`;
  const prices = v.trims.length > 0 ? v.trims.map((t) => t.price) : [v.basePrice];
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const offerCount = prices.length;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${v.brand} ${v.name}`,
      description: v.description ?? `${v.brand} ${v.name} 장기렌트·리스 견적`,
      brand: { "@type": "Brand", name: v.brand },
      category: v.category,
      url,
      ...(v.thumbnailUrl ? { image: v.thumbnailUrl } : {}),
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "KRW",
        lowPrice,
        highPrice,
        offerCount,
        url,
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: v.siteUrl },
        { "@type": "ListItem", position: 2, name: "차량", item: `${v.siteUrl}/cars` },
        { "@type": "ListItem", position: 3, name: v.brand },
        { "@type": "ListItem", position: 4, name: v.name, item: url },
      ],
    },
  ];
}
