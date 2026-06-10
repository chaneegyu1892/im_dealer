"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  groupTrimsByLineup,
  type GroupableTrim,
  type GroupedTrim,
} from "@/lib/trim-groups";

// 비교 패널용 커스텀 트림 셀렉터.
// 네이티브 select 는 펼침 레이어 위치를 제어할 수 없어 차량 사진을 덮는 문제가 있어,
// 문서 흐름 안에서 아래로 펼쳐지는 인라인 아코디언으로 대체한다.
// 그룹 구조(라인업 헤더 + 특수형 최하단)는 trim-groups 모듈을 따른다.

function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

interface TrimGroupSelectProps<T extends GroupableTrim> {
  trims: readonly T[];
  selectedTrimId: string | null;
  onChange: (trimId: string) => void;
  placeholder?: string;
}

export function TrimGroupSelect<T extends GroupableTrim>({
  trims,
  selectedTrimId,
  onChange,
  placeholder = "트림을 선택하세요",
}: TrimGroupSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const groups = useMemo(() => groupTrimsByLineup(trims), [trims]);

  const selected = useMemo(() => {
    if (!selectedTrimId) return null;
    for (const group of groups) {
      const found = group.trims.find((t) => t.id === selectedTrimId);
      if (found) return found;
    }
    return null;
  }, [groups, selectedTrimId]);

  // Esc 로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // 펼칠 때 선택된 트림이 보이도록 스크롤
  useEffect(() => {
    if (!isOpen || !selectedTrimId) return;
    const el = listRef.current?.querySelector(`[data-trim-id="${selectedTrimId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen, selectedTrimId]);

  const priceLabel = (g: GroupedTrim<T>) =>
    fmtMan(g.trim.discountPrice ?? g.trim.price);

  return (
    <div>
      {/* 트리거 */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] rounded-[8px] border transition-colors",
          isOpen
            ? "border-primary bg-white"
            : "border-[#E8EAF0] bg-[#F8F9FC] hover:border-primary/40"
        )}
      >
        {selected ? (
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium text-[#1A1A2E] truncate">
              {selected.displayName}
              {selected.extra ? (
                <span className="text-[#9BA4C0] font-normal"> ({selected.extra})</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[#4A5270] tabular-nums">
              {priceLabel(selected)}
            </span>
          </span>
        ) : (
          <span className="text-[#9BA4C0]">{placeholder}</span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-[#9BA4C0] transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 인라인 펼침 리스트 — 레이어가 아니라 흐름 안에서 아래로 확장 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              ref={listRef}
              role="listbox"
              aria-label="트림 선택"
              className="mt-1.5 max-h-[300px] overflow-y-auto rounded-[10px] border border-[#E8EAF0] bg-white"
            >
              {groups.map((group, gi) => (
                <div key={group.lineup ?? `flat-${gi}`}>
                  {group.lineup !== null && (
                    <p className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7399] bg-[#F8F9FC] border-b border-[#F0F2F8]">
                      {group.lineup || "기타"}
                    </p>
                  )}
                  {group.trims.map((g) => {
                    const isSelected = g.id === selectedTrimId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-trim-id={g.id}
                        onClick={() => {
                          onChange(g.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
                          isSelected
                            ? "bg-primary-100 text-primary"
                            : "text-[#1A1A2E] hover:bg-[#F8F9FC]"
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn("block truncate", isSelected && "font-semibold")}>
                            {g.displayName}
                          </span>
                          {g.extra && (
                            <span className="block text-[11px] text-[#9BA4C0] truncate">
                              {g.extra}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 flex items-center gap-1.5 tabular-nums">
                          {g.trim.discountPrice ? (
                            <>
                              <span className="text-[11px] text-[#9BA4C0] line-through">
                                {fmtMan(g.trim.price)}
                              </span>
                              <span className="font-medium">{fmtMan(g.trim.discountPrice)}</span>
                            </>
                          ) : (
                            <span className={cn(isSelected ? "font-semibold" : "text-[#4A5270]")}>
                              {fmtMan(g.trim.price)}
                            </span>
                          )}
                          {isSelected && <Check size={14} className="text-primary" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
