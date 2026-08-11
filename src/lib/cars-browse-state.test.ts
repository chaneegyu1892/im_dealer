import { afterEach, describe, expect, it } from "vitest";
import {
  CARS_BROWSE_STORAGE_KEY,
  DEFAULT_CARS_BROWSE_STATE,
  parseCarsBrowseState,
  readRememberedCarsBrowseUrl,
  rememberCarsBrowseUrl,
  serializeCarsBrowseState,
} from "./cars-browse-state";

describe("cars-browse-state", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("parses valid browse params and falls back safely", () => {
    expect(
      parseCarsBrowseState({
        query: "  쏘렌토  ",
        category: "EV",
        brand: "기아",
        sort: "price-asc",
      }),
    ).toEqual({
      query: "쏘렌토",
      category: "EV",
      brand: "기아",
      sort: "price-asc",
    });

    expect(
      parseCarsBrowseState({
        category: "트럭",
        sort: "hacked",
        brand: "",
      }),
    ).toEqual(DEFAULT_CARS_BROWSE_STATE);

    expect(parseCarsBrowseState({ category: "RV" }).category).toBe("RV");
    expect(parseCarsBrowseState({ category: "HEV" }).category).toBe("HEV");
  });

  it("serializes only non-default keys", () => {
    expect(serializeCarsBrowseState(DEFAULT_CARS_BROWSE_STATE)).toBe("/cars");
    expect(
      serializeCarsBrowseState({
        query: "쏘렌토",
        category: "RV",
        brand: "현대",
        sort: "price-desc",
      }),
    ).toBe(
      "/cars?query=%EC%8F%98%EB%A0%8C%ED%86%A0&category=RV&brand=%ED%98%84%EB%8C%80&sort=price-desc",
    );
  });

  it("remembers only same-origin /cars paths", () => {
    rememberCarsBrowseUrl("/cars?category=RV");
    expect(window.sessionStorage.getItem(CARS_BROWSE_STORAGE_KEY)).toBe(
      "/cars?category=RV",
    );
    expect(readRememberedCarsBrowseUrl()).toBe("/cars?category=RV");

    rememberCarsBrowseUrl("https://evil.example/cars");
    expect(readRememberedCarsBrowseUrl()).toBe("/cars");

    rememberCarsBrowseUrl("//evil.example");
    expect(readRememberedCarsBrowseUrl()).toBe("/cars");
  });
});
