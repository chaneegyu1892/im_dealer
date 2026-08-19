"use client";

import { useEffect, useState } from "react";

export const CHANNEL_TALK_STATUS_ATTR = "data-channel-talk-status" as const;

export const CHANNEL_TALK_STATUSES = ["loading", "ready", "failed"] as const;
export type ChannelTalkStatus = (typeof CHANNEL_TALK_STATUSES)[number];

export function setChannelTalkStatus(status: ChannelTalkStatus): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(CHANNEL_TALK_STATUS_ATTR, status);
}

export function clearChannelTalkStatus(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(CHANNEL_TALK_STATUS_ATTR);
}

export function readChannelTalkStatus(): ChannelTalkStatus | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.getAttribute(CHANNEL_TALK_STATUS_ATTR);
  switch (value) {
    case "loading":
    case "ready":
    case "failed":
      return value;
    default:
      return null;
  }
}

export function isChannelTalkEnabled(status: ChannelTalkStatus | null): boolean {
  return status !== "loading" && status !== "failed";
}

export function useChannelTalkStatus(): ChannelTalkStatus | null {
  const [status, setStatus] = useState<ChannelTalkStatus | null>(readChannelTalkStatus);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      setStatus(readChannelTalkStatus());
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [CHANNEL_TALK_STATUS_ATTR],
    });
    sync();
    return () => observer.disconnect();
  }, []);

  return status;
}
