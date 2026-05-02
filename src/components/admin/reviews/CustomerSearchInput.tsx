"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import type { CustomerSearchResult } from "@/types/review";

interface CustomerSearchInputProps {
  selected: CustomerSearchResult | null;
  onSelect: (result: CustomerSearchResult) => void;
  onClear: () => void;
}

export function CustomerSearchInput({
  selected,
  onSelect,
  onClear,
}: CustomerSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) return;
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/saved-quotes/search?q=${encodeURIComponent(query.trim())}`
        );
        const json = await res.json();
        setResults(json.data ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="inline-flex items-center gap-2 bg-[#F2F4FF] border border-[#CCCCF5] rounded-[8px] px-3 py-2 max-w-full">
        <span className="text-[12px] font-medium text-[#000666]">
          {selected.customerName}
        </span>
        <span className="text-[11px] text-[#71749A]">
          {selected.phoneMasked}
        </span>
        {selected.vehicleName && (
          <span className="text-[11px] text-[#71749A]">· {selected.vehicleName}</span>
        )}
        <span className="text-[11px] text-[#71749A]">· {selected.createdAt}</span>
        <span className="text-[10px] bg-white border border-[#CCCCF5] text-[#000666] px-1.5 py-0.5 rounded">
          {selected.statusLabel}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[#71749A] hover:text-[#CC0000]"
          aria-label="연결 해제"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="고객 이름 검색 (예: 김진규)"
          className="w-full pl-8 pr-9 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE]"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0] animate-spin"
          />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#E8EAF2] rounded-[8px] shadow-lg max-h-[280px] overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.savedQuoteId}
              type="button"
              onClick={() => {
                onSelect(r);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F8F9FC] border-b border-[#F0F0F0] last:border-b-0"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-[#1A1A2E]">
                  {r.customerName}
                </span>
                <span className="text-[11px] text-[#71749A]">{r.phoneMasked}</span>
                {r.vehicleName && (
                  <span className="text-[11px] text-[#71749A]">· {r.vehicleName}</span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#9BA4C0]">
                <span>{r.createdAt}</span>
                <span>·</span>
                <span className="text-[#000666]">{r.statusLabel}</span>
                <span>·</span>
                <span>{r.customerType === "corporate" ? "법인" : "개인"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= 1 && results.length === 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#E8EAF2] rounded-[8px] shadow-lg p-4 text-center text-[12px] text-[#9BA4C0]">
          일치하는 고객이 없습니다.
        </div>
      )}
    </div>
  );
}
