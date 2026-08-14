import { describe, expect, it } from "vitest";
import { toAlimtalkRecipient } from "./enqueue";

// 비즈톡 recipient 는 하이픈 있는 형식도 받지만, 저장·조회를 하나로 맞추려고
// 01012345678 로 통일한다. 카카오에서 온 원본은 "+82 10-1234-5678" 형태다.
describe("toAlimtalkRecipient", () => {
  it.each([
    ["+82 10-1234-5678", "01012345678"],
    ["010-1234-5678", "01012345678"],
    ["01012345678", "01012345678"],
    ["+821012345678", "01012345678"],
  ])("%s → %s", (input, expected) => {
    expect(toAlimtalkRecipient(input)).toBe(expected);
  });

  it.each([null, undefined, "", "02-123-4567", "010-123-456"])(
    "유효하지 않은 값(%s)은 null",
    (input) => {
      expect(toAlimtalkRecipient(input)).toBeNull();
    }
  );
});
