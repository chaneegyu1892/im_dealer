'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isChannelTalkSuppressedPath } from '@/lib/channel-talk';
import { clearChannelTalkStatus, setChannelTalkStatus } from '@/lib/channel-talk-status';

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

export const CHANNEL_TALK_IDENTITY_RETRY_MS = 2000;

export function ChannelTalk() {
  const pathname = usePathname() ?? '';
  const suppressed = isChannelTalkSuppressedPath(pathname);

  useEffect(() => {
    if (suppressed) {
      window.ChannelIO?.('shutdown');
      delete window.ChannelIO;
      delete window.ChannelIOInitialized;
      clearChannelTalkStatus();
      return;
    }

    const pluginKey = process.env.NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY;
    // A host-provided ChannelIO (E2E stub or an already-booted widget) is ready
    // even when the plugin key is unset — do not overwrite that with `failed`.
    if (window.ChannelIO) {
      setChannelTalkStatus('ready');
      return;
    }
    if (!pluginKey) {
      setChannelTalkStatus('failed');
      return;
    }

    const ch: NonNullable<Window['ChannelIO']> = function (...args: unknown[]) {
      ch.q!.push(args);
    } as NonNullable<Window['ChannelIO']>;
    ch.q = [] as unknown[];
    ch.c = function (...args: unknown[]) {
      ch.q!.push(args);
    };
    window.ChannelIO = ch;
    setChannelTalkStatus('loading');

    let cancelled = false;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
    script.onload = () => {
      if (!cancelled) setChannelTalkStatus('ready');
    };
    script.onerror = () => {
      if (!cancelled) setChannelTalkStatus('failed');
    };
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
    // 마지막으로 부팅한 신원 키. 토큰 리프레시로 SIGNED_IN 이 반복돼도 불필요한 재부팅을 막는다.
    // 'anonymous' 는 확정 익명이다. 이후 member identity 가 오면 같은 키라도 재부팅한다.
    let bootedKey: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;

    function clearRetry() {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function applyIdentity(identity: ChannelIdentity) {
      const key = identity.anonymous ? 'anonymous' : identity.memberId;
      // 익명 고착 복구: anonymous 로 확정된 뒤에도 member 가 오면 재부팅한다.
      // bootedKey 를 boot 호출 전에 갱신해 같은 신원으로 중복 boot 하지 않는다.
      if (key === bootedKey) return;
      bootedKey = key;
      window.ChannelIO?.('shutdown');
      boot(identity);
    }

    async function fetchIdentity(): Promise<ChannelIdentity | null> {
      try {
        const res = await fetch('/api/channel-talk/identity', { cache: 'no-store' });
        if (!res.ok) return null;
        return (await res.json()) as ChannelIdentity;
      } catch {
        return null;
      }
    }

    async function reboot(allowRetry: boolean) {
      clearRetry();
      const gen = ++generation;
      const identity = await fetchIdentity();
      if (cancelled || gen !== generation) return;
      if (identity) {
        applyIdentity(identity);
        return;
      }
      // 일시 실패는 1회만 재시도한다. 재시도까지 실패하면 익명으로 확정하되
      // 다음 auth 이벤트의 member identity 는 막지 않는다.
      if (allowRetry) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void reboot(false);
        }, CHANNEL_TALK_IDENTITY_RETRY_MS);
        return;
      }
      applyIdentity({ anonymous: true });
    }

    // INITIAL_SESSION(마운트) 로 최초 부팅, SIGNED_IN/SIGNED_OUT 으로 재부팅 → 회원 전환·익명 데이터 통합.
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // 로그인 완료 등 새 auth 이벤트는 재시도 예산을 다시 연다.
        void reboot(true);
      }
    });

    return () => {
      cancelled = true;
      generation += 1;
      clearRetry();
      listener.subscription.unsubscribe();
      window.ChannelIO?.('shutdown');
      delete window.ChannelIO;
      delete window.ChannelIOInitialized;
      clearChannelTalkStatus();
    };
  }, [suppressed]);

  return null;
}
