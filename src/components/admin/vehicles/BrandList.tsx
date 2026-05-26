"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminBrand } from "@/types/admin";
import { BrandFormModal } from "./BrandFormModal";

interface BrandListProps {
  brands: AdminBrand[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export function BrandList({ brands, selected, onSelect }: BrandListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const featured = brands.filter((b) => b.isFeatured);
  const others = brands.filter((b) => !b.isFeatured);

  const handleReorder = async (current: AdminBrand, direction: "up" | "down") => {
    const idx = featured.findIndex((b) => b.id === current.id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= featured.length) return;
    const target = featured[targetIdx];

    setActionError(null);
    setReorderingId(current.id);
    try {
      const res = await fetch("/api/admin/brands/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aId: current.id, bId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "순서 변경 실패");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "순서 변경 중 오류");
    } finally {
      setReorderingId(null);
    }
  };

  const handleDelete = async (brand: AdminBrand) => {
    if (brand.vehicleCount > 0) {
      setActionError(
        `이 브랜드를 사용하는 차량이 ${brand.vehicleCount}대 있어 삭제할 수 없습니다. 먼저 차량을 다른 브랜드로 옮기거나 삭제해 주세요.`
      );
      return;
    }
    if (!confirm(`'${brand.name}' 브랜드를 삭제하시겠습니까?`)) return;

    setActionError(null);
    setDeletingId(brand.id);
    try {
      const res = await fetch(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "브랜드 삭제 실패");
      }
      if (selected === brand.name) {
        onSelect("");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "브랜드 삭제 중 오류");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFeatured = async (brand: AdminBrand) => {
    setActionError(null);
    setTogglingId(brand.id);
    try {
      const res = await fetch(`/api/admin/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !brand.isFeatured }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "인기 브랜드 설정 실패");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "인기 브랜드 설정 중 오류");
    } finally {
      setTogglingId(null);
    }
  };

  // 단일 브랜드 행 렌더러 — 데스크탑(리스트) / 모바일(그리드 카드) 공유
  const renderActions = (
    b: AdminBrand,
    variant: "desktop" | "mobile",
    reorderCtx?: { canUp: boolean; canDown: boolean }
  ) => (
    <div className={cn("flex items-center", variant === "desktop" ? "gap-0.5" : "gap-0.5")}>
      {b.isFeatured && reorderCtx && (
        <>
          <button
            type="button"
            disabled={!reorderCtx.canUp || reorderingId === b.id}
            onClick={(e) => {
              e.stopPropagation();
              handleReorder(b, "up");
            }}
            title="위로 이동"
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded-[6px] disabled:opacity-30",
              variant === "desktop"
                ? "text-[#6B7399] hover:text-[#000666] hover:bg-[#F0F2F8]"
                : "bg-white border border-[#E8EAF0] text-[#6B7399]"
            )}
            aria-label={`${b.name} 위로 이동`}
          >
            <ArrowUp size={variant === "desktop" ? 12 : 11} />
          </button>
          <button
            type="button"
            disabled={!reorderCtx.canDown || reorderingId === b.id}
            onClick={(e) => {
              e.stopPropagation();
              handleReorder(b, "down");
            }}
            title="아래로 이동"
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded-[6px] disabled:opacity-30",
              variant === "desktop"
                ? "text-[#6B7399] hover:text-[#000666] hover:bg-[#F0F2F8]"
                : "bg-white border border-[#E8EAF0] text-[#6B7399]"
            )}
            aria-label={`${b.name} 아래로 이동`}
          >
            <ArrowDown size={variant === "desktop" ? 12 : 11} />
          </button>
        </>
      )}
      <button
        type="button"
        disabled={togglingId === b.id}
        onClick={(e) => {
          e.stopPropagation();
          handleToggleFeatured(b);
        }}
        title={b.isFeatured ? "인기 브랜드에서 제외" : "인기 브랜드로 지정"}
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-[6px] disabled:opacity-40",
          variant === "desktop"
            ? b.isFeatured
              ? "text-amber-500 hover:bg-amber-50"
              : "text-[#C0C5DC] hover:text-amber-500 hover:bg-[#F0F2F8]"
            : "bg-white border border-[#E8EAF0]",
          variant === "mobile" && (b.isFeatured ? "text-amber-500" : "text-[#C0C5DC]")
        )}
        aria-label={b.isFeatured ? "인기 브랜드 해제" : "인기 브랜드 지정"}
      >
        <Star size={variant === "desktop" ? 12 : 11} fill={b.isFeatured ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActionError(null);
          setEditing(b);
        }}
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-[6px] text-[#6B7399] hover:text-[#000666]",
          variant === "desktop" ? "hover:bg-[#F0F2F8]" : "bg-white border border-[#E8EAF0]"
        )}
        aria-label={`${b.name} 수정`}
      >
        <Pencil size={variant === "desktop" ? 12 : 11} />
      </button>
      <button
        type="button"
        disabled={deletingId === b.id}
        onClick={(e) => {
          e.stopPropagation();
          handleDelete(b);
        }}
        title={b.vehicleCount > 0 ? "차량이 등록된 브랜드는 삭제할 수 없습니다" : "브랜드 삭제"}
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-[6px] disabled:opacity-40",
          b.vehicleCount > 0
            ? "text-[#C8CDDD] cursor-not-allowed"
            : variant === "desktop"
            ? "text-[#6B7399] hover:text-red-500 hover:bg-red-50"
            : "text-[#6B7399] bg-white border border-[#E8EAF0]"
        )}
        aria-label={`${b.name} 삭제`}
      >
        <Trash2 size={variant === "desktop" ? 12 : 11} />
      </button>
    </div>
  );

  const renderDesktopRow = (b: AdminBrand, ctx?: { canUp: boolean; canDown: boolean }) => {
    const isSelected = selected === b.name;
    return (
      <div
        key={b.name}
        onClick={() => onSelect(b.name)}
        className={cn(
          "group flex items-center justify-between px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors border",
          isSelected
            ? "bg-white border-[#000666] shadow-sm"
            : "border-transparent hover:bg-white hover:border-[#E8EAF0]"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center p-1.5 shrink-0 border border-[#E8EAF0]">
            {b.logoUrl ? (
              <Image
                src={b.logoUrl}
                alt={b.name}
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[9px] font-bold text-[#6B7399] tracking-tighter">
                {b.name.substring(0, 2)}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[13px] font-medium truncate",
              isSelected ? "text-[#000666]" : "text-[#4A5270]"
            )}
          >
            {b.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-[#9BA4C0] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px] group-hover:hidden">
            {b.vehicleCount}
          </span>
          <div className="hidden group-hover:flex">{renderActions(b, "desktop", ctx)}</div>
        </div>
      </div>
    );
  };

  const renderMobileCard = (b: AdminBrand, ctx?: { canUp: boolean; canDown: boolean }) => {
    const isSelected = selected === b.name;
    return (
      <div
        key={b.name}
        onClick={() => onSelect(b.name)}
        className={cn(
          "relative flex flex-col items-center gap-2 p-3 rounded-[10px] cursor-pointer transition-all border",
          isSelected
            ? "bg-white border-[#000666] shadow-sm"
            : "bg-white border-[#E8EAF0] hover:border-[#C0C5DC]"
        )}
      >
        <div className="w-12 h-12 bg-[#F8F9FC] rounded-[10px] flex items-center justify-center p-2 border border-[#E8EAF0]">
          {b.logoUrl ? (
            <Image
              src={b.logoUrl}
              alt={b.name}
              width={48}
              height={48}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-[11px] font-bold text-[#6B7399]">{b.name.substring(0, 2)}</span>
          )}
        </div>
        <div className="text-center">
          <p
            className={cn(
              "text-[13px] font-semibold",
              isSelected ? "text-[#000666]" : "text-[#1A1A2E]"
            )}
          >
            {b.name}
          </p>
          <p className="text-[11px] text-[#9BA4C0]">{b.vehicleCount}대</p>
        </div>
        <div className="absolute top-1 right-1">{renderActions(b, "mobile", ctx)}</div>
      </div>
    );
  };

  const renderSectionLabel = (label: string) => (
    <div className="flex items-center gap-2 px-1 mt-3 mb-1 first:mt-0">
      <span className="text-[10px] font-semibold text-[#9BA4C0] uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#E8EAF0]" />
    </div>
  );

  return (
    <div className="w-full md:w-[280px] h-full border-r border-[#E8EAF0] flex flex-col shrink-0 min-h-0 bg-[#FAFBFF]">
      <div className="px-4 py-3 border-b border-[#E8EAF0] bg-white z-10 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[#1A1A2E]">차량 브랜드</h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#F0F2F8] text-[#000666] transition-colors"
          aria-label="브랜드 추가"
        >
          <Plus size={15} />
        </button>
      </div>
      {actionError && (
        <div className="mx-3 mt-2 px-3 py-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-[6px]">
          {actionError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        {brands.length === 0 ? (
          <p className="text-[12px] text-center text-[#9BA4C0] mt-10">등록된 브랜드가 없습니다</p>
        ) : (
          <>
            {/* 모바일: 2열 그리드, 섹션 라벨 위/아래에 한 줄씩 */}
            <div className="md:hidden">
              {featured.length > 0 && (
                <>
                  {renderSectionLabel("인기 브랜드")}
                  <div className="grid grid-cols-2 gap-2">
                    {featured.map((b, i) =>
                      renderMobileCard(b, { canUp: i > 0, canDown: i < featured.length - 1 })
                    )}
                  </div>
                </>
              )}
              {others.length > 0 && (
                <>
                  {renderSectionLabel("전체 브랜드")}
                  <div className="grid grid-cols-2 gap-2">{others.map((b) => renderMobileCard(b))}</div>
                </>
              )}
            </div>

            {/* 데스크탑: 리스트 */}
            <div className="hidden md:flex flex-col">
              {featured.length > 0 && (
                <>
                  {renderSectionLabel("인기 브랜드")}
                  <div className="flex flex-col gap-1">
                    {featured.map((b, i) =>
                      renderDesktopRow(b, { canUp: i > 0, canDown: i < featured.length - 1 })
                    )}
                  </div>
                </>
              )}
              {others.length > 0 && (
                <>
                  {renderSectionLabel("전체 브랜드")}
                  <div className="flex flex-col gap-1">{others.map((b) => renderDesktopRow(b))}</div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <BrandFormModal
          existingNames={brands.map((b) => b.name)}
          onClose={() => setCreateOpen(false)}
          onSaved={(name) => {
            setCreateOpen(false);
            router.refresh();
            onSelect(name);
          }}
        />
      )}

      {editing && (
        <BrandFormModal
          mode="edit"
          brand={{ id: editing.id, name: editing.name, logoUrl: editing.logoUrl }}
          existingNames={brands.map((b) => b.name)}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            const wasSelected = selected === editing.name;
            setEditing(null);
            router.refresh();
            if (wasSelected) onSelect(name);
          }}
        />
      )}
    </div>
  );
}
