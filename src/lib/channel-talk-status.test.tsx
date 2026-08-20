import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHANNEL_TALK_STATUS_ATTR,
  useChannelTalkStatus,
} from "./channel-talk-status";

afterEach(() => {
  document.documentElement.removeAttribute(CHANNEL_TALK_STATUS_ATTR);
});

function Probe({ onRender }: { onRender: (status: ReturnType<typeof useChannelTalkStatus>) => void }) {
  onRender(useChannelTalkStatus());
  return null;
}

describe("useChannelTalkStatus", () => {
  it("starts null so SSR and the first client render match, then syncs from the document", async () => {
    document.documentElement.setAttribute(CHANNEL_TALK_STATUS_ATTR, "failed");
    const seen: Array<ReturnType<typeof useChannelTalkStatus>> = [];

    render(<Probe onRender={(status) => seen.push(status)} />);

    expect(seen[0]).toBeNull();
    await waitFor(() => {
      expect(seen.at(-1)).toBe("failed");
    });
  });
});
