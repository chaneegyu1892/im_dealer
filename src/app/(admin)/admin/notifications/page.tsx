"use client";

import { useState, useEffect } from "react";
import { 
  Bell, Clock, MessageSquare, Check, Trash2, 
  ChevronLeft, AlertCircle, Search, Filter 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AdminNotification } from "@/types/admin";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications?limit=100");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await fetch(`/api/admin/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const deleteNotification = async (id: string) => {
    // 알림 삭제 API가 아직 없으므로 일단 클라이언트에서만 제거 (또는 나중에 API 추가)
    // await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.isRead;
    if (filter === "quote") return n.type === "NEW_QUOTE";
    return true;
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[16px] border border-[#E8EAF0] shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 hover:bg-[#F4F5F8] rounded-full transition-colors text-[#9BA4C0]">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-[#1A1A2E] flex items-center gap-2">
              <Bell size={20} className="text-[#000666]" /> 알림 전체보기
            </h1>
            <p className="text-[13px] text-[#6B7399] mt-1">시스템에서 발생한 모든 알림 기록을 확인하세요.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={fetchNotifications}
             className="px-4 py-2 bg-[#F4F5F8] text-[#4A5270] text-[13px] font-bold rounded-[8px] hover:bg-[#E8EAF0] transition-colors"
           >
             새로고침
           </button>
        </div>
      </div>

      {/* 필터 및 목록 */}
      <div className="bg-white rounded-[16px] border border-[#E8EAF0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F2F8] flex items-center justify-between bg-[#FAFBFF]">
          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "전체" },
              { id: "unread", label: "안 읽음" },
              { id: "quote", label: "견적 신청" },
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[12px] font-bold transition-all",
                  filter === f.id ? "bg-[#000666] text-white shadow-md" : "bg-white text-[#6B7399] border border-[#E8EAF0] hover:border-[#C0C5DC]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-[#9BA4C0]">
            총 <span className="font-bold text-[#1A1A2E]">{filtered.length}</span>개의 알림
          </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-[#000666]/10 border-t-[#000666] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[13px] text-[#9BA4C0]">알림 기록을 불러오는 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <Bell size={48} className="text-[#E8EAF0] mx-auto mb-4" />
              <p className="text-[14px] text-[#9BA4C0]">표시할 알림이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F2F8]">
              {filtered.map((n, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={n.id} 
                  className={cn(
                    "px-8 py-5 flex items-start justify-between group transition-colors",
                    !n.isRead ? "bg-blue-50/20" : "hover:bg-[#F8F9FC]"
                  )}
                >
                  <div className="flex gap-4 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                      !n.isRead ? "bg-white border-[#C0C5DC]" : "bg-[#F4F5F8] border-transparent"
                    )}>
                      {n.type === "NEW_QUOTE" ? <MessageSquare size={18} className="text-[#000666]" /> : <Bell size={18} className="text-[#6B7399]" />}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider",
                          n.type === "NEW_QUOTE" ? "bg-[#E5E5FA] text-[#000666]" : "bg-[#F4F5F8] text-[#9BA4C0]"
                        )}>
                          {n.type}
                        </span>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </div>
                      <h3 className={cn("text-[15px] text-[#1A1A2E] leading-tight", !n.isRead && "font-bold")}>{n.title}</h3>
                      <p className="text-[13px] text-[#6B7399] mt-1.5 leading-relaxed">{n.content}</p>
                      <p className="text-[11px] text-[#9BA4C0] mt-3 flex items-center gap-1.5">
                        <Clock size={11} /> {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {n.linkUrl && (
                      <Link 
                        href={n.linkUrl}
                        onClick={() => !n.isRead && markAsRead(n.id)}
                        className="px-3 py-1.5 bg-[#000666] text-white text-[12px] font-bold rounded-[6px] hover:opacity-90 transition-opacity"
                      >
                        이동하기
                      </Link>
                    )}
                    <button 
                      onClick={() => !n.isRead && markAsRead(n.id)}
                      disabled={n.isRead}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        n.isRead ? "text-[#D4D8EC] cursor-default" : "text-[#6B7399] hover:bg-[#E8EAF0] hover:text-[#1A1A2E]"
                      )}
                      title="읽음 처리"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="p-2 text-[#6B7399] hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-5 rounded-[16px] flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-800 leading-relaxed">
          알림 기록은 최근 100건까지만 보관됩니다. 중요한 비즈니스 데이터는 견적 데이터 페이지에서 관리하시기 바랍니다.
        </p>
      </div>
    </div>
  );
}
