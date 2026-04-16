"use client";

import { AlertCircle, CheckCircle2, MessageSquare, Plus, RefreshCw } from "lucide-react";

export type ActivityType = 'create' | 'update' | 'delete' | 'alert' | 'info';

export interface AdminActivity {
  id: string;
  text: string;
  time: string;
  timestamp: number;
  type: ActivityType;
  color: string;
}

const STORAGE_KEY = "im_dealer_admin_activities";

export const logActivity = (text: string, type: ActivityType = 'info') => {
  if (typeof window === "undefined") return;

  const activities = getActivities();
  const colorMap: Record<ActivityType, string> = {
    create: "#059669",
    update: "#0EA5E9",
    delete: "#E11D48",
    alert: "#D97706",
    info: "#6B7399",
  };

  const newActivity: AdminActivity = {
    id: Math.random().toString(36).substring(2, 9),
    text,
    time: "방금 전",
    timestamp: Date.now(),
    type,
    color: colorMap[type],
  };

  const updated = [newActivity, ...activities].slice(0, 15);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // 다른 컴포넌트에 변경 알림
  window.dispatchEvent(new Event("activity_updated"));
};

export const getActivities = (): AdminActivity[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const list = JSON.parse(stored) as AdminActivity[];
    // 시간 정보 업데이트 (데모용 단순화)
    return list.map(item => {
      const diff = Date.now() - item.timestamp;
      if (diff < 60000) return { ...item, time: "방금 전" };
      if (diff < 3600000) return { ...item, time: `${Math.floor(diff / 60000)}분 전` };
      return { ...item, time: "오늘" };
    });
  } catch (e) {
    return [];
  }
};
