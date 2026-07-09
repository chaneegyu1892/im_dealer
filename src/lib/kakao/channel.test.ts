import { describe, it, expect } from "vitest";
import { parseChannelRelation } from "./channel";

const UUID = "abcd-1234-uuid";
const ENCODED = "_leExpb";

describe("parseChannelRelation", () => {
  it("channel_uuid 매칭 시 ADDED 를 반환한다", () => {
    const json = { channels: [{ channel_uuid: UUID, relation: "ADDED" }] };
    expect(parseChannelRelation(json, UUID)).toBe("ADDED");
  });

  it("encoded_id 로도 매칭한다", () => {
    const json = { channels: [{ encoded_id: ENCODED, relation: "ADDED" }] };
    expect(parseChannelRelation(json, ENCODED)).toBe("ADDED");
  });

  it("relation 대소문자를 정규화한다", () => {
    const json = { channels: [{ channel_uuid: UUID, relation: "added" }] };
    expect(parseChannelRelation(json, UUID)).toBe("ADDED");
  });

  it("BLOCKED 를 반환한다", () => {
    const json = { channels: [{ channel_uuid: UUID, relation: "BLOCKED" }] };
    expect(parseChannelRelation(json, UUID)).toBe("BLOCKED");
  });

  it("매칭 채널이 없으면 NONE", () => {
    const json = { channels: [{ channel_uuid: "other", relation: "ADDED" }] };
    expect(parseChannelRelation(json, UUID)).toBe("NONE");
  });

  it("channels 가 없거나 배열이 아니면 NONE", () => {
    expect(parseChannelRelation({}, UUID)).toBe("NONE");
    expect(parseChannelRelation({ channels: null }, UUID)).toBe("NONE");
    expect(parseChannelRelation(null, UUID)).toBe("NONE");
  });

  it("알 수 없는 relation 값은 NONE", () => {
    const json = { channels: [{ channel_uuid: UUID, relation: "UNKNOWN" }] };
    expect(parseChannelRelation(json, UUID)).toBe("NONE");
  });
});
