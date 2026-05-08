'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    ChannelIO?: ((...args: unknown[]) => void) & { q?: unknown[]; c?: (...args: unknown[]) => void };
    ChannelIOInitialized?: boolean;
  }
}

export function ChannelTalk() {
  useEffect(() => {
    const pluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;
    if (!pluginKey || window.ChannelIO) return;

    const ch: NonNullable<Window['ChannelIO']> = function (...args) {
      ch.q!.push(args);
    };
    ch.q = [] as unknown[];
    ch.c = function (...args) {
      ch.q!.push(args);
    };
    window.ChannelIO = ch;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
    document.head.appendChild(script);

    window.ChannelIO('boot', { pluginKey, hideChannelButtonOnBoot: true });

    return () => {
      window.ChannelIO?.('shutdown');
      delete window.ChannelIO;
      delete window.ChannelIOInitialized;
    };
  }, []);

  return null;
}
