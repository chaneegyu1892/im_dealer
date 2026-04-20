"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, User, ChevronRight, FileEdit, History } from "lucide-react";
import { RecoveryRateHistory } from "@/constants/mock-data";
import { cn } from "@/lib/utils";

interface RateHistoryTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  historyData: RecoveryRateHistory[];
}

export function RateHistoryTimeline({ isOpen, onClose, historyData }: RateHistoryTimelineProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#E8EAF0]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2F8]">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#000666]" />
                <h2 className="text-[15px] font-semibold text-[#1A1A2E]">최근 변경 이력</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F4F5F8] text-[#9BA4C0] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="relative border-l-2 border-[#F0F2F8] ml-3 space-y-8 pb-4">
                {historyData.map((item, index) => {
                  const dateObj = new Date(item.changedAt);
                  const dateStr = dateObj.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
                  const timeStr = dateObj.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={item.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#000666]" />
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-[#1A1A2E]">{item.vehicleName}</span>
                          <span className="text-[10px] text-[#9BA4C0]">{dateStr} {timeStr}</span>
                        </div>
                        <div className="bg-[#F8F9FC] border border-[#E8EAF0] p-3 rounded-[8px] flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#E5E5FA] text-[#000666] text-[10px] font-medium mr-1.5">
                              {item.field}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[13px]">
                            <span className="text-[#6B7399] font-medium">{item.oldValue}%</span>
                            <ChevronRight size={14} className="text-[#9BA4C0]" />
                            <span className={cn(
                                "font-bold",
                                item.newValue > item.oldValue ? "text-emerald-600" : "text-amber-600"
                            )}>
                              {item.newValue}%
                            </span>
                          </div>
                          {item.reason && (
                            <div className="text-[11px] text-[#6B7399] bg-white border border-[#E8EAF0] p-2 rounded-[6px] mt-1 flex items-start gap-1.5">
                              <FileEdit size={12} className="shrink-0 mt-0.5 text-[#9BA4C0]" />
                              <span>{item.reason}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-[#9BA4C0]">
                            <User size={10} />
                            <span>{item.changedBy}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
