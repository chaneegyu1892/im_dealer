import { describe, expect, it } from "vitest";
import { parseCarpan2Vehicles } from "./parse";

describe("parseCarpan2Vehicles", () => {
  it("크롤링 JSON을 동기화 계획용 snapshot으로 정규화한다", () => {
    const vehicles = parseCarpan2Vehicles({
      meta: { source: "카판2 / carpan.kr", scrapedAt: "2026-07-05T05:41:05.811Z" },
      vehicles: [
        {
          modelId: "11573",
          brandName: "기아",
          modelName: "더 뉴 쏘렌토 HEV",
          cartypeCode: "R5",
          engineCode: "GX",
          state: "2",
          summary: "summary",
          price: { min: 38240000, max: "50410000" },
          imageLarge: "https://www.carpan.co.kr/img/model/169824-L.png",
          cover: "https://www.carpan.co.kr/img/model/46829.png",
          catalogFiles: [
            {
              fileId: "146845",
              name: "catalog.pdf",
              kind: "catalog",
              url1: "https://p.ca8.kr/catalog",
              count: "16",
            },
          ],
          priceFiles: [
            { fileId: "188625", name: "price.pdf", url1: "https://p.ca8.kr/price" },
            { fileId: "145517", name: "price-old.pdf", url1: "https://p.ca8.kr/price-old" },
          ],
          options: [{ optionId: "109406", name: "6인승", kind: "F", change: "6인승 ▶" }],
          exteriorColors: [
            {
              colorId: "10778",
              name: "스노우 화이트 펄",
              code: "SWP",
              price: "80000",
              rgb: "e6e7e6",
              flag: "0",
            },
          ],
          interiorColors: [{ colorId: "10869", name: "올리브 브라운", price: 0, rgb: "786f5c" }],
          lineups: [
            {
              lineupId: "115087",
              name: "2025년형 가솔린 1.6T HEV",
              year: "2025년형",
              state: "3",
            },
          ],
          trims: [
            {
              trimId: "1048737",
              lineupId: "115087",
              name: "프레스티지",
              price: "40280000",
              state: "2",
              engineCode: "GX",
              displace: "1598",
              person: "5",
              carry: "0",
              options: [{ optionId: "109406", name: "6인승", price: "0", condition: "", flag: "0" }],
            },
          ],
        },
      ],
    });

    expect(vehicles).toEqual([
      {
        modelId: "11573",
        brandName: "기아",
        modelName: "더 뉴 쏘렌토 HEV",
        cartypeCode: "R5",
        engineCode: "GX",
        state: "2",
        summary: "summary",
        priceMin: 38240000,
        imageLarge: "https://www.carpan.co.kr/img/model/169824-L.png",
        cover: "https://www.carpan.co.kr/img/model/46829.png",
        catalogFileCount: 1,
        priceFileCount: 2,
        catalogFiles: [
          {
            fileId: "146845",
            name: "catalog.pdf",
            kind: "catalog",
            url1: "https://p.ca8.kr/catalog",
            url2: null,
            url3: null,
            dir: null,
            count: 16,
          },
        ],
        priceFiles: [
          {
            fileId: "188625",
            name: "price.pdf",
            kind: null,
            url1: "https://p.ca8.kr/price",
            url2: null,
            url3: null,
            dir: null,
            count: null,
          },
          {
            fileId: "145517",
            name: "price-old.pdf",
            kind: null,
            url1: "https://p.ca8.kr/price-old",
            url2: null,
            url3: null,
            dir: null,
            count: null,
          },
        ],
        options: [
          {
            optionId: "109406",
            name: "6인승",
            kind: "F",
            apply: null,
            guide: null,
            package: null,
            change: "6인승 ▶",
          },
        ],
        exteriorColors: [
          {
            colorId: "10778",
            name: "스노우 화이트 펄",
            code: "SWP",
            price: 80000,
            rgb: "e6e7e6",
            rgb2: null,
            flag: "0",
          },
        ],
        interiorColors: [
          {
            colorId: "10869",
            name: "올리브 브라운",
            code: null,
            price: 0,
            rgb: "786f5c",
            rgb2: null,
            flag: null,
          },
        ],
        lineups: [
          {
            lineupId: "115087",
            name: "2025년형 가솔린 1.6T HEV",
            year: "2025년형",
            state: "3",
          },
        ],
        trims: [
          {
            trimId: "1048737",
            lineupId: "115087",
            name: "프레스티지",
            price: 40280000,
            state: "2",
            engineCode: "GX",
            displace: "1598",
            person: "5",
            carry: "0",
            options: [
              {
                optionId: "109406",
                name: "6인승",
                price: 0,
                condition: "",
                flag: "0",
              },
            ],
          },
        ],
      },
    ]);
  });
});
