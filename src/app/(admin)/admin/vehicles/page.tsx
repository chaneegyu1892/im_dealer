"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Star,
  X,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_VEHICLES } from "@/constants/mock-vehicles";
import type { MockVehicle } from "@/constants/mock-vehicles";
import type { VehicleCategory, EngineType } from "@/types/vehicle";

// ─── 타입 ────────────────────────────────────────────────
interface VehicleRow extends MockVehicle {
  visible: boolean;
}

const ENGINE_COLORS: Record<EngineType, string> = {
  EV: "bg-[#E5E5FA] text-[#000666]",
  하이브리드: "bg-green-50 text-green-700",
  가솔린: "bg-[#F4F5F8] text-[#4A5270]",
  디젤: "bg-amber-50 text-amber-700",
};

// ─── 삭제 확인 모달 ───────────────────────────────────────
function DeleteConfirmModal({
  vehicle,
  onConfirm,
  onCancel,
}: {
  vehicle: VehicleRow;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-[12px] p-6 w-[380px] shadow-xl"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1A2E]">
              차량을 삭제하시겠어요?
            </h3>
            <p className="text-[13px] text-[#6B7399] mt-1">
              <span className="font-medium text-[#1A1A2E]">
                {vehicle.brand} {vehicle.name}
              </span>{" "}
              을(를) 삭제하면 복구할 수 없습니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[8px] text-[13px] font-medium bg-[#F4F5F8] text-[#4A5270] hover:bg-[#EAEDF5] transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-[8px] text-[13px] font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            삭제
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── 차량 추가/수정 모달 ──────────────────────────────────
function VehicleFormModal({
  vehicle,
  onClose,
}: {
  vehicle?: VehicleRow | null;
  onClose: () => void;
}) {
  const isEdit = !!vehicle;
  const [form, setForm] = useState({
    brand: vehicle?.brand ?? "",
    name: vehicle?.name ?? "",
    category: vehicle?.category ?? ("세단" as VehicleCategory),
    engineType: vehicle?.engineType ?? ("가솔린" as EngineType),
    basePrice: vehicle?.basePrice ? String(vehicle.basePrice / 10_000) : "",
    monthlyFrom: vehicle?.monthlyFrom ? String(vehicle.monthlyFrom / 10_000) : "",
    shortDesc: vehicle?.shortDesc ?? "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-[14px] w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F2F8]">
          <h2 className="text-[16px] font-semibold text-[#1A1A2E]">
            {isEdit ? "차량 수정" : "차량 추가"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#F4F5F8] transition-colors"
          >
            <X size={15} className="text-[#6B7399]" />
          </button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="브랜드">
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="예: 현대"
                className={inputClass}
              />
            </FormField>
            <FormField label="차량명">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="예: 아이오닉 6"
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="차종">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value as VehicleCategory }))
                }
                className={selectClass}
              >
                {["세단", "SUV", "밴", "트럭"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="구동방식">
              <select
                value={form.engineType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, engineType: e.target.value as EngineType }))
                }
                className={selectClass}
              >
                {["가솔린", "디젤", "하이브리드", "EV"].map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="기준가격 (만원)">
              <input
                type="number"
                value={form.basePrice}
                onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
                placeholder="예: 5500"
                className={inputClass}
              />
            </FormField>
            <FormField label="월납입 시작가 (만원)">
              <input
                type="number"
                value={form.monthlyFrom}
                onChange={(e) => setForm((p) => ({ ...p, monthlyFrom: e.target.value }))}
                placeholder="예: 72"
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="한줄 설명">
            <input
              type="text"
              value={form.shortDesc}
              onChange={(e) => setForm((p) => ({ ...p, shortDesc: e.target.value }))}
              placeholder="고객에게 보여줄 짧은 설명"
              className={inputClass}
            />
          </FormField>

          <div className="pt-1 p-3 rounded-[8px] bg-[#FFFBEB] border border-amber-200">
            <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              Supabase 연동 전까지 실제 저장이 되지 않습니다. UI 확인 용도로만 사용하세요.
            </p>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#F0F2F8]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[8px] text-[13px] font-medium bg-[#F4F5F8] text-[#4A5270] hover:bg-[#EAEDF5] transition-colors"
          >
            취소
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-[8px] text-[13px] font-medium bg-[#000666] text-white hover:opacity-90 transition-opacity"
          >
            {isEdit ? "수정 완료" : "추가"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

// ─── 메인 페이지 ─────────────────────────────────────────
export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>(
    MOCK_VEHICLES.map((v) => ({ ...v, visible: true }))
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [editTarget, setEditTarget] = useState<VehicleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(() => {
    let result = vehicles;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "전체") {
      result = result.filter((v) => v.category === categoryFilter);
    }
    return result;
  }, [vehicles, search, categoryFilter]);

  const toggleVisible = (id: string) =>
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, visible: !v.visible } : v))
    );

  const togglePopular = (id: string) =>
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isPopular: !v.isPopular } : v))
    );

  const deleteVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setDeleteTarget(null);
  };

  const visibleCount = vehicles.filter((v) => v.visible).length;

  return (
    <>
      <div className="p-8 max-w-[1100px]">
        {/* 페이지 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between mb-6"
        >
          <div>
            <h1 className="text-[24px] font-semibold text-[#1A1A2E]">차량 관리</h1>
            <p className="text-[13px] text-[#6B7399] mt-0.5">
              총 {vehicles.length}대 등록 · 노출 중 {visibleCount}대
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#000666] text-white text-[13px] font-medium
                       px-4 py-2.5 rounded-[8px] hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2.5} />
            차량 추가
          </button>
        </motion.div>

        {/* 검색 + 필터 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="flex flex-wrap items-center gap-3 mb-5"
        >
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8D0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="브랜드·차량명 검색"
              className="w-full pl-8 pr-3 py-2 text-[13px] bg-white border border-[#E8EAF0] rounded-[8px]
                         outline-none focus:border-[#000666] transition-colors placeholder:text-[#B0B8D0] text-[#1A1A2E]"
            />
          </div>

          {/* 카테고리 필터 */}
          <div className="flex gap-1.5">
            {["전체", "세단", "SUV", "밴", "트럭"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-all duration-150",
                  categoryFilter === cat
                    ? "bg-[#000666] text-white"
                    : "bg-white border border-[#E8EAF0] text-[#6B7399] hover:text-[#1A1A2E] hover:border-[#C0C5DC]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 테이블 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 bg-[#F8F9FC] border-b border-[#F0F2F8]">
            {["차량", "차종", "구동", "시작가", "인기", "노출", "액션"].map((h) => (
              <span key={h} className="text-[11px] font-semibold text-[#9BA4C0] uppercase tracking-wide">
                {h}
              </span>
            ))}
          </div>

          {/* 테이블 바디 */}
          <AnimatePresence>
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[14px] text-[#9BA4C0]">조건에 맞는 차량이 없어요</p>
              </div>
            ) : (
              filtered.map((v, idx) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15, delay: idx * 0.03 }}
                  className={cn(
                    "grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5",
                    "border-b border-[#F0F2F8] last:border-0",
                    "hover:bg-[#FAFBFF] transition-colors duration-100",
                    !v.visible && "opacity-50"
                  )}
                >
                  {/* 차량 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                      style={{ background: "#000666" }}
                    >
                      {v.brand[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A2E] truncate">
                        {v.brand} {v.name}
                      </p>
                      <p className="text-[11px] text-[#9BA4C0] truncate">{v.shortDesc}</p>
                    </div>
                  </div>

                  {/* 차종 */}
                  <span className="text-[12px] text-[#4A5270]">{v.category}</span>

                  {/* 구동 */}
                  <span
                    className={cn(
                      "inline-block text-[11px] font-medium px-2 py-0.5 rounded-[4px] w-fit",
                      ENGINE_COLORS[v.engineType]
                    )}
                  >
                    {v.engineType}
                  </span>

                  {/* 시작가 */}
                  <span className="text-[13px] font-medium text-[#1A1A2E]">
                    {Math.round(v.monthlyFrom / 10_000)}만~
                  </span>

                  {/* 인기 토글 */}
                  <button
                    onClick={() => togglePopular(v.id)}
                    className="transition-colors duration-150"
                    aria-label="인기 토글"
                  >
                    <Star
                      size={16}
                      strokeWidth={1.8}
                      className={cn(
                        "transition-colors",
                        v.isPopular ? "fill-amber-400 text-amber-400" : "text-[#D0D5E8]"
                      )}
                    />
                  </button>

                  {/* 노출 토글 */}
                  <button
                    onClick={() => toggleVisible(v.id)}
                    className="transition-colors duration-150"
                    aria-label="노출 토글"
                  >
                    {v.visible ? (
                      <Eye size={16} strokeWidth={1.8} className="text-[#000666]" />
                    ) : (
                      <EyeOff size={16} strokeWidth={1.8} className="text-[#C0C5DC]" />
                    )}
                  </button>

                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditTarget(v)}
                      className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#E5E5FA] transition-colors"
                      aria-label="수정"
                    >
                      <Pencil size={13} className="text-[#000666]" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(v)}
                      className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-red-50 transition-colors"
                      aria-label="삭제"
                    >
                      <Trash2 size={13} className="text-red-500" strokeWidth={1.8} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 모달들 */}
      <AnimatePresence>
        {(showAddModal || editTarget) && (
          <VehicleFormModal
            vehicle={editTarget}
            onClose={() => {
              setShowAddModal(false);
              setEditTarget(null);
            }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            vehicle={deleteTarget}
            onConfirm={() => deleteVehicle(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
