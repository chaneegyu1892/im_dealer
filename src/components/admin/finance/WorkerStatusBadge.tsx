"use client";

import { useEffect, useState } from "react";

interface Presence {
  online: boolean;
  lastSeenAt: string | null;
  unknown: boolean;
}

const POLL_MS = 10000;

/**
 * 수집 PC(워커)가 켜져 있는지 보여준다.
 *
 * 워커가 꺼진 채로 수집을 시작하면 작업이 큐에만 쌓이고 아무 일도 일어나지 않는데,
 * 화면에는 "대기 중"으로만 보여 원인을 알기 어렵다. 그 혼선을 없애기 위한 표시.
 */
export default function WorkerStatusBadge() {
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/worker-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Presence;
        if (!canceled) setPresence(data);
      } catch {
        // 네트워크 오류는 무시 — 다음 주기에 다시 시도한다.
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, []);

  if (!presence || presence.unknown) return null;

  if (presence.online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        수집 PC 연결됨
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"
      title="수집 PC 에서 '수집 시작' 프로그램을 실행해야 작업이 진행됩니다."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      수집 PC 꺼짐 — &lsquo;수집 시작&rsquo; 실행 필요
    </span>
  );
}
