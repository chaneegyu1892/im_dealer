'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    ChannelIO?: ((...args: unknown[]) => void) & { q?: unknown[]; c?: (...args: unknown[]) => void };
    ChannelIOInitialized?: boolean;
  }
}

type ChannelIdentity =
  | { anonymous: true }
  | {
      anonymous: false;
      memberId: string;
      memberHash?: string;
      profile: { name: string; email?: string; mobileNumber?: string };
    };

export function ChannelTalk() {
  useEffect(() => {
    const pluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;
    if (!pluginKey || window.ChannelIO) return;

    const ch: NonNullable<Window['ChannelIO']> = function (...args: unknown[]) {
      ch.q!.push(args);
    } as NonNullable<Window['ChannelIO']>;
    ch.q = [] as unknown[];
    ch.c = function (...args: unknown[]) {
      ch.q!.push(args);
    };
    window.ChannelIO = ch;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
    document.head.appendChild(script);

    // 로그인 회원이면 memberId·memberHash·profile 을 실어 boot, 아니면 익명 boot.
    // 로그인 완료 시점에 memberId 를 포함해 다시 boot 해야 익명 데이터와 회원 데이터가 통합된다.
    function boot(identity: ChannelIdentity) {
      if (identity.anonymous) {
        window.ChannelIO?.('boot', { pluginKey, hideChannelButtonOnBoot: true });
        return;
      }
      window.ChannelIO?.('boot', {
        pluginKey,
        hideChannelButtonOnBoot: true,
        memberId: identity.memberId,
        ...(identity.memberHash ? { memberHash: identity.memberHash } : {}),
        profile: identity.profile,
      });
    }

    let cancelled = false;
    // 마지막으로 부팅한 신원 키. 토큰 리프레시로 SIGNED_IN 이 반복돼도 불필요한 재부팅을 막는다.
    let bootedKey: string | null = null;
    async function reboot() {
      try {
        const res = await fetch('/api/channel-talk/identity', { cache: 'no-store' });
        const identity: ChannelIdentity = res.ok ? await res.json() : { anonymous: true };
        if (cancelled) return;
        const key = identity.anonymous ? 'anonymous' : identity.memberId;
        if (key === bootedKey) return;
        bootedKey = key;
        window.ChannelIO?.('shutdown');
        boot(identity);
      } catch {
        if (!cancelled && bootedKey === null) {
          bootedKey = 'anonymous';
          boot({ anonymous: true });
        }
      }
    }

    // INITIAL_SESSION(마운트) 로 최초 부팅, SIGNED_IN/SIGNED_OUT 으로 재부팅 → 회원 전환·익명 데이터 통합.
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        reboot();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      window.ChannelIO?.('shutdown');
      delete window.ChannelIO;
      delete window.ChannelIOInitialized;
    };
  }, []);

  return null;
}
