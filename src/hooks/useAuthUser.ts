"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * 현재 Supabase 세션의 로그인 사용자를 구독한다.
 * 회원/비회원 분기에 사용 (user === null 이면 비회원).
 *
 * Header.tsx 의 getUser + onAuthStateChange 패턴을 재사용 가능하도록 추출한 훅.
 */
export function useAuthUser(): { user: User | null; isLoading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, isLoading };
}
