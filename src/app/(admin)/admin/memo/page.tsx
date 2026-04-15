"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Plus, Search, Filter, Pin,
  Clock, User, MoreVertical, X, Trash2, Edit2, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_MEMOS, type AdminMemo, type MemoCategory } from "@/constants/mock-data";

// ─── 카테고리별 스타일 ──────────────────────────────────────────────
const CATEGORY_STYLE: Record<MemoCategory, { bg: string; text: string; border: string }> = {
  "이슈/긴급": { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  "공지사항": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  "업무/인수인계": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "일반": { bg: "bg-[#F4F5F8]", text: "text-[#6B7399]", border: "border-[#E8EAF0]" },
};

const CATEGORIES: MemoCategory[] = ["이슈/긴급", "공지사항", "업무/인수인계", "일반"];

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "일반" as MemoCategory,
  isPinned: false,
};

// ─── 포맷팅 유틸 ────────────────────────────────────────────────
function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const yy = d.getFullYear().toString().slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hr = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hr}:${mn}`;
}

export default function MemoPage() {
  const [memos, setMemos] = useState<AdminMemo[]>(MOCK_MEMOS);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<MemoCategory | "전체">("전체");

  // Drawer 상태
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminMemo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  // ─── 필터링 ───
  const filteredMemos = useMemo(() => {
    return memos.filter(m => {
      const q = search.toLowerCase();
      const matchSearch = String(m.title).toLowerCase().includes(q) || String(m.content).toLowerCase().includes(q);
      const matchCat = filterCategory === "전체" || m.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [memos, search, filterCategory]);

  const pinnedMemos = filteredMemos.filter(m => m.isPinned).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const normalMemos = filteredMemos.filter(m => !m.isPinned).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ─── 액션 ───
  const openNew = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (memo: AdminMemo) => {
    setEditTarget(memo);
    setForm({
      title: memo.title,
      content: memo.content,
      category: memo.category,
      isPinned: memo.isPinned,
    });
    setDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("정말로 이 메모를 삭제하시겠습니까?")) {
      setMemos(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) return;

    if (editTarget) {
      setMemos(prev => prev.map(m => m.id === editTarget.id ? {
        ...m,
        ...form,
        updatedAt: new Date().toISOString(),
      } : m));
    } else {
      const newMemo: AdminMemo = {
        id: `MEMO-${Date.now()}`,
        ...form,
        author: "관리자", // 임시 하드코딩
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMemos(prev => [newMemo, ...prev]);
    }
    setDrawerOpen(false);
  };

  const togglePin = (id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m));
  };

  // ─── 메모 카드 컴포넌트 ───
  const MemoCard = ({ memo }: { memo: AdminMemo }) => {
    const s = CATEGORY_STYLE[memo.category];
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="group bg-white rounded-[12px] border border-[#E8EAF0] p-5 flex flex-col hover:border-[#000666]/30 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-[4px] border", s.bg, s.text, s.border)}>
              {memo.category}
            </span>
            {memo.isPinned && (
              <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-[4px] border border-amber-200">
                <Pin size={10} className="mr-0.5 fill-amber-600" /> 고정됨
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => togglePin(memo.id)} className="p-1.5 text-[#9BA4C0] hover:text-amber-500 hover:bg-amber-50 rounded-[6px]" title={memo.isPinned ? "고정 해제" : "상단 고정"}>
              <Pin size={13} className={memo.isPinned ? "fill-amber-500 text-amber-500" : ""} />
            </button>
            <button onClick={() => openEdit(memo)} className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F4F5F8] rounded-[6px]" title="수정">
              <Edit2 size={13} />
            </button>
            <button onClick={() => handleDelete(memo.id)} className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px]" title="삭제">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-2 leading-snug">{memo.title}</h3>
        <p className="text-[13px] text-[#4A5270] leading-relaxed whitespace-pre-wrap flex-1 mb-4 line-clamp-4">
          {memo.content}
        </p>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#F0F2F8] text-[11px] text-[#9BA4C0]">
          <div className="flex items-center gap-1.5">
            <User size={11} />
            <span>{memo.author}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={11} />
            <span>{formatDateTime(memo.updatedAt)}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-6 flex flex-col gap-6" style={{ minHeight: "100vh" }}>
      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-[#8890AA] mb-1">{today}</p>
          <h1 className="text-[22px] font-bold text-[#1A1A2E] flex items-center gap-2">
            <ClipboardList size={22} className="text-[#000666]" strokeWidth={2.5} />
            운영 메모
          </h1>
          <p className="text-[13px] text-[#6B7399] mt-1.5">
            팀원 간의 주요 이슈, 공지사항 및 업무 인수인계 내역을 공유합니다.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#000666] text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={14} strokeWidth={2.5} /> 메모 작성
        </button>
      </div>

      {/* ── 필터바 ────────────────────────────────────────── */}
      <div className="bg-white rounded-[10px] p-2 border border-[#E8EAF0] shadow-sm flex items-center gap-2">
        <div className="relative flex-1 max-w-[300px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목이나 내용을 검색해보세요"
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-[#F4F5F8] rounded-[6px] outline-none text-[#1A1A2E] placeholder:text-[#9BA4C0] focus:ring-1 focus:ring-[#000666]/20 transition-all"
          />
        </div>
        
        <div className="w-px h-5 bg-[#E8EAF0] mx-2" />
        
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-[#9BA4C0] mx-1" />
          {(["전체", ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-all duration-200",
                filterCategory === cat
                  ? "bg-[#1A1A2E] text-white"
                  : "text-[#6B7399] hover:bg-[#F4F5F8]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── 보드 영역 ──────────────────────────────────────── */}
      <div className="flex-1">
        {filteredMemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9BA4C0] bg-white border border-dashed border-[#D0D4E8] rounded-[12px]">
            <ClipboardList size={40} className="mb-3 opacity-50" />
            <p className="text-[14px] font-medium">표시할 메모가 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* 고정된 메모 */}
            {pinnedMemos.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Pin size={14} className="text-amber-500 fill-amber-500" />
                  <h2 className="text-[14px] font-bold text-[#1A1A2E]">고정된 메모</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {pinnedMemos.map(memo => (
                      <MemoCard key={memo.id} memo={memo} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* 일반 메모 */}
            {normalMemos.length > 0 && (
              <section>
                {pinnedMemos.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-[14px] font-bold text-[#1A1A2E]">일반 메모</h2>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {normalMemos.map(memo => (
                      <MemoCard key={memo.id} memo={memo} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── 작성/수정 Drawer ───────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed top-0 right-0 bottom-0 w-[500px] bg-white z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F2F8]">
                <h2 className="text-[16px] font-bold text-[#1A1A2E]">
                  {editTarget ? "메모 수정" : "새 메모 작성"}
                </h2>
                <button onClick={() => setDrawerOpen(false)} className="p-1 text-[#9BA4C0] hover:text-[#1A1A2E] rounded-full hover:bg-[#F4F5F8] transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block text-[12px] font-bold text-[#4A5270] mb-2">카테고리 <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => {
                      const isActive = form.category === cat;
                      const s = CATEGORY_STYLE[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => setForm(f => ({ ...f, category: cat }))}
                          className={cn(
                            "px-3 py-1.5 rounded-[6px] text-[12px] font-bold border transition-all",
                            isActive ? cn(s.bg, s.text, s.border, "ring-2 ring-offset-1", `ring-[${s.text.replace('text-', '')}]`) : "bg-white text-[#6B7399] border-[#E8EAF0] hover:border-[#C0C5DC]"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#4A5270] mb-2">제목 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="제목을 입력하세요"
                    className="w-full px-4 py-2.5 bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#000666] focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#4A5270] mb-2">내용 <span className="text-red-500">*</span></label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="메모 내용을 입력하세요..."
                    rows={12}
                    className="w-full px-4 py-3 bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[13px] text-[#1A1A2E] leading-relaxed resize-none focus:outline-none focus:border-[#000666] focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isPinned: !f.isPinned }))}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-[6px] text-[12px] font-bold transition-colors border",
                      form.isPinned ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white text-[#9BA4C0] border-[#E8EAF0]"
                    )}
                  >
                    <Pin size={14} className={form.isPinned ? "fill-amber-600" : ""} />
                    상단 고정
                  </button>
                  <p className="text-[11px] text-[#9BA4C0]">중요한 메모는 상단에 고정해두세요.</p>
                </div>
              </div>

              <div className="p-6 border-t border-[#F0F2F8] flex items-center justify-end gap-3">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="px-5 py-2.5 rounded-[8px] text-[13px] font-semibold text-[#6B7399] hover:bg-[#F4F5F8] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.title.trim() || !form.content.trim()}
                  className="px-6 py-2.5 rounded-[8px] text-[13px] font-semibold text-white bg-[#000666] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  저장하기
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
