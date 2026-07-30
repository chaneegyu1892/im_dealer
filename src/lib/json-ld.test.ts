import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("preserves JSON data while removing HTML script delimiters", () => {
    const value = {
      description: "</script><script>globalThis.xss = true</script>",
      separator: "\u2028\u2029",
    };

    const serialized = serializeJsonLd(value);

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    expect(JSON.parse(serialized)).toEqual(value);
  });
});
