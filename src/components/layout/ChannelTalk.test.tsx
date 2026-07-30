import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  }),
}));

import { ChannelTalk } from "./ChannelTalk";

function loadedPluginScripts(): Element[] {
  return Array.from(document.querySelectorAll('script[src*="cdn.channel.io"]'));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY", "test-plugin-key");
  navigation.pathname = "/";
});

afterEach(() => {
  vi.unstubAllEnvs();
  loadedPluginScripts().forEach((script) => script.remove());
  delete window.ChannelIO;
  delete window.ChannelIOInitialized;
});

describe("ChannelTalk third-party script boundary", () => {
  it("loads the plugin on ordinary public pages", async () => {
    navigation.pathname = "/cars";

    render(<ChannelTalk />);

    await waitFor(() => expect(loadedPluginScripts()).toHaveLength(1));
    expect(window.ChannelIO).toBeTypeOf("function");
  });

  it("never loads the plugin on the resident registration input page", async () => {
    navigation.pathname = "/verify";

    render(<ChannelTalk />);

    await waitFor(() => expect(loadedPluginScripts()).toHaveLength(0));
    expect(window.ChannelIO).toBeUndefined();
  });

  it("shuts down an already-booted widget when entering the verification page", async () => {
    navigation.pathname = "/quote";
    const { unmount } = render(<ChannelTalk />);
    await waitFor(() => expect(window.ChannelIO).toBeTypeOf("function"));
    unmount();

    const calls: unknown[][] = [];
    window.ChannelIO = ((...args: unknown[]) => {
      calls.push(args);
    }) as NonNullable<Window["ChannelIO"]>;
    window.ChannelIOInitialized = true;
    navigation.pathname = "/verify";

    render(<ChannelTalk />);

    await waitFor(() => expect(window.ChannelIO).toBeUndefined());
    expect(calls).toEqual([["shutdown"]]);
    expect(window.ChannelIOInitialized).toBeUndefined();
  });
});
