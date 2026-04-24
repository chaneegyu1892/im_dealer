"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, X, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AdminNotification } from "@/types/admin";

export function AdminHeader() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=5");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        setUnreadCount(json.data.filter((n: any) => !n.isRead).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000); // 30초마다 폴링
    return () => clearInterval(timer);
  }, []);

  const markAsRead = async (id: string) => {
    await fetch(`/api/admin/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    fetchNotifications();
  };

  return (
    <header className="h-16 bg-white border-b border-[#E8EAF0] flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] group-focus-within:text-[#000666] transition-colors" />
          <input 
            type="text" 
            placeholder="전체 검색 (차량, 고객, 견적...)"
            className="w-full bg-[#F8F9FC] border border-transparent focus:border-[#C0C5DC] focus:bg-white rounded-full py-2 pl-10 pr-4 text-[13px] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button 
            onClick={() => setOpen(!open)}
            className={cn(
              "p-2 rounded-full hover:bg-[#F4F5F8] transition-colors relative",
              open && "bg-[#F4F5F8]"
            )}
          >
            <Bell size={20} className="text-[#4A5270]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <>
                <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-[320px] bg-white rounded-[12px] border border-[#E8EAF0] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-10 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[#E8EAF0] flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#1A1A2E]">최신 알림</span>
                    <button className="text-[11px] text-[#6B7399] hover:text-[#000666]">전체 읽음</button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-[12px] text-[#9BA4C0]">알림이 없습니다.</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={cn(
                            "px-4 py-3 hover:bg-[#F8F9FC] transition-colors cursor-pointer border-b border-[#F0F2F8] last:border-0",
                            !n.isRead && "bg-blue-50/30"
                          )}
                          onClick={() => {
                            if (!n.isRead) markAsRead(n.id);
                            if (n.linkUrl) router.push(n.linkUrl);
                            setOpen(false);
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-white border border-[#E8EAF0] flex items-center justify-center shrink-0">
                              {n.type === "NEW_QUOTE" ? <MessageSquare size={14} className="text-[#000666]" /> : <Bell size={14} className="text-[#6B7399]" />}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[12px] text-[#1A1A2E] leading-tight", !n.isRead && "font-bold")}>{n.title}</p>
                              <p className="text-[11px] text-[#6B7399] mt-1 line-clamp-2">{n.content}</p>
                              <p className="text-[10px] text-[#9BA4C0] mt-1.5 flex items-center gap-1">
                                <Clock size={10} /> {new Date(n.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link 
                    href="/admin/notifications" 
                    className="block py-2.5 text-center text-[12px] font-medium text-[#000666] bg-[#F8F9FC] hover:bg-[#F4F5F8] transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    알림 전체보기 <ArrowRight size={12} className="inline ml-1" />
                  </Link>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="w-[1px] h-4 bg-[#E8EAF0] mx-2" />

        <div className="flex items-center gap-2 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-bold text-[#1A1A2E]">최고관리자</p>
            <p className="text-[10px] text-[#6B7399]">운영 권한</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#000666] flex items-center justify-center text-white text-[12px] font-bold">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
