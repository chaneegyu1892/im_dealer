"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleFilterOption } from "./ReviewFilterBar";

interface VehicleComboboxProps {
  vehicles: VehicleFilterOption[];
  brand: string;
  value: string;
  onChange: (vehicleId: string, brand: string) => void;
  placeholder?: string;
}

export function VehicleCombobox({
  vehicles,
  brand,
  value,
  onChange,
  placeholder = "차종 검색",
}: VehicleComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === value) ?? null,
    [vehicles, value]
  );

  const candidates = useMemo(
    () => (brand ? vehicles.filter((v) => v.brand === brand) : vehicles),
    [vehicles, brand]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
  }, [open, query, brand]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${highlight}"]`
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const handleSelect = (v: VehicleFilterOption) => {
    onChange(v.id, v.brand);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("", brand);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => (matches.length === 0 ? 0 : (h + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        matches.length === 0 ? 0 : (h - 1 + matches.length) % matches.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = matches[highlight];
      if (v) handleSelect(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="h-11 px-3 pr-2 flex items-center gap-2 bg-brand-soft border border-brand/30 rounded-[12px]">
          <span className="text-[14px] font-extrabold text-brand truncate">
            {selected.brand} {selected.name}
          </span>
          <button
            type="button"
            onClick={handleClear}
            aria-label="차종 선택 해제"
            className="ml-auto shrink-0 w-6 h-6 rounded-full hover:bg-white/70 flex items-center justify-center text-brand"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-g2 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="w-full h-11 pl-9 pr-9 text-[14px] text-ink bg-sec border border-line2 rounded-[12px] focus:outline-none focus:border-brand focus:bg-white"
          />
          <ChevronDown
            size={14}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-g2 transition-transform pointer-events-none",
              open && "rotate-180"
            )}
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-line2 rounded-[14px] shadow-soft overflow-hidden">
          {matches.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] font-bold text-g2">
              검색 결과가 없습니다
            </div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-[280px] overflow-y-auto py-1"
            >
              {matches.map((v, idx) => {
                const isHighlighted = idx === highlight;
                return (
                  <li
                    key={v.id}
                    data-idx={idx}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(v);
                    }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={cn(
                      "px-3 py-2.5 text-[13.5px] cursor-pointer flex items-center gap-2",
                      isHighlighted
                        ? "bg-brand-soft text-brand"
                        : "text-ink hover:bg-sec"
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-g2 shrink-0 w-12">
                      {v.brand}
                    </span>
                    <span className="truncate flex-1 font-bold">{v.name}</span>
                    {value === v.id && (
                      <Check size={14} className="text-brand shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
