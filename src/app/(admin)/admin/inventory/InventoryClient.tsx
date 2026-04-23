"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import {
  Package, Search, Plus, X, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, Pencil,
  Trash2, Building2, Car, ToggleLeft, ToggleRight,
  Layers, Settings,
} from "lucide-react";
import {
  MOCK_INVENTORY,
  FINANCE_COMPANIES,
  type InventoryItem,
  type InventoryStatus,
} from "@/constants/mock-data";
import type { VehicleForInventory } from "./page";
import { logActivity } from "@/lib/activity-store";

// ─── 상태별 스타일 ──────────────────────────────────────────────
const STATUS_STYLE: Record<InventoryStatus, { bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  정상: { bg: "bg-emerald-50",   text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  부족: { bg: "bg-amber-50",     text: "text-amber-700",   border: "border-amber-200",   icon: AlertTriangle },
  소진: { bg: "bg-red-50",       text: "text-red-600",     border: "border-red-200",     icon: XCircle },
};

const calcStatus = (q: number): InventoryStatus => {
  if (q === 0) return "소진";
  if (q <= 2)  return "부족";
  return "정상";
};

// ─── DB 차량 데이터 → 재고 등록 드로어용 구조로 변환 ──────────────
type VehicleOption = { label: string; short: string; brand: string; slug: string };

type VehicleDetails = Record<string, {
  trims: string[];           // 트림 전체 이름 목록
  options: string[];         // 옵션 이름 목록 (중복 제거)
}>;

/**
 * DB 트림 이름(예: "2025년형 가솔린 1.6T HEV 2WD 7인승 노블레스")을
 * 그대로 트림 선택 옵션으로 사용합니다.
 * 옵션은 해당 차량의 모든 TrimOption을 중복 없이 합산합니다.
 */
function buildVehicleData(vehicles: VehicleForInventory[]): {
  vehicleOptions: VehicleOption[];
  vehicleDetails: VehicleDetails;
  brands: string[];
} {
  const vehicleOptions: VehicleOption[] = vehicles.map((v) => ({
    label: v.name,
    short: v.name,
    brand: v.brand,
    slug: v.slug,
  }));

  const vehicleDetails: VehicleDetails = {};

  for (const v of vehicles) {
    const trims = v.trims.map((t) => t.name);

    const optionSet = new Set<string>();
    for (const t of v.trims) {
      for (const o of t.options) {
        // [엑세서리] 접두사 제외하고 싶으면 필터 추가 가능
        optionSet.add(o.name);
      }
    }

    vehicleDetails[v.name] = {
      trims,
      options: Array.from(optionSet).sort(),
    };
  }

  // 브랜드 순서: DB 순서 유지하면서 중복 제거
  const brandSet = new Set(vehicles.map((v) => v.brand));
  const brands = Array.from(brandSet);

  return { vehicleOptions, vehicleDetails, brands };
}

const EMPTY_FORM = {
  vehicleName: "",
  vehicleShort: "",
  brand: "",
  financeCompany: "",
  quantity: 0,
  immediateDelivery: true,
  memo: "",
  trim: "",
  color: "",         // 자유 입력 텍스트
  options: [] as string[],
};

// ─── 서브 컴포넌트 ───────────────────────────────────────────────

function KPIMini({ label, value, unit, highlight, color }: { label: string; value: string | number; unit: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex flex-col px-6">
      <span className="text-[11px] font-semibold text-[#9BA4C0] mb-0.5">{label}</span>
      <span className={cn("text-[20px] font-bold tracking-tight", highlight ? "text-[#000666]" : color || "text-[#1A1A2E]")}>
        {value}<span className="text-[12px] font-normal ml-0.5 opacity-60 font-sans">{unit}</span>
      </span>
    </div>
  );
}

function QuantityCell({
  value, onSave,
}: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onSave(n);
    else setDraft(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-16 text-center text-[13px] font-bold text-[#1A1A2E] border border-[#000666] rounded-[4px] outline-none px-1 py-0.5"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="클릭하여 수량 수정"
      className="group flex items-center justify-center gap-1 w-full text-[13px] font-bold text-[#1A1A2E] hover:text-[#000666] transition-colors"
    >
      <span>{value}대</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  );
}

function DeliveryToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-center gap-1.5 w-full transition-colors"
      title={value ? "즉시 출고 가능" : "즉시 출고 불가"}
    >
      {value
        ? <ToggleRight size={22} className="text-[#000666]" strokeWidth={1.5} />
        : <ToggleLeft  size={22} className="text-[#C0C5DC]" strokeWidth={1.5} />}
      <span className={cn("text-[11px] font-semibold", value ? "text-[#000666]" : "text-[#9BA4C0]")}>
        {value ? "가능" : "불가"}
      </span>
    </button>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#4A5270] mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusPreview({ status }: { status: InventoryStatus }) {
  const SS = STATUS_STYLE[status];
  const SIcon = SS.icon;
  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border", SS.bg, SS.text, SS.border)}>
      <SIcon size={10} strokeWidth={2.5} /> 자동 판정: {status}
    </div>
  );
}

// ─── 메인 클라이언트 컴포넌트 ────────────────────────────────────

export function InventoryClient({ vehicles }: { vehicles: VehicleForInventory[] }) {
  const searchParams = useSearchParams();

  // DB 데이터 기반으로 초기값 구성
  const { vehicleOptions: initialVehicleOptions, vehicleDetails: initialVehicleDetails, brands: initialBrands } =
    useMemo(() => buildVehicleData(vehicles), [vehicles]);

  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [finances, setFinances] = useState<string[]>(FINANCE_COMPANIES);
  const [selectedFC, setSelectedFC] = useState("전체");

  const [vehicleOptions, setVehicleOptions] = useState(initialVehicleOptions);
  const [vehicleDetails, setVehicleDetails] = useState(initialVehicleDetails);

  const [brands, setBrands] = useState(initialBrands);
  const [selectedBrand, setSelectedBrand] = useState("");

  const [isFinanceManageOpen, setIsFinanceManageOpen] = useState(false);
  const [editTargetBrand, setEditTargetBrand] = useState<string | null>(null);
  const [editTargetModel, setEditTargetModel] = useState<VehicleOption | null>(null);

  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    setBrands(prev => [...prev, newBrandName.trim()]);
    setSelectedBrand(newBrandName.trim());
    setAddBrandOpen(false);
    setNewBrandName("");
  };

  const [brandDeleteConfirm, setBrandDeleteConfirm] = useState<string | null>(null);
  const [vehicleDeleteConfirm, setVehicleDeleteConfirm] = useState<{ label: string; short: string } | null>(null);

  const handleDeleteFinance = (fcName: string) => {
    if (!window.confirm(`'${fcName}' 금융사를 삭제하시겠습니까?\n해당 금융사에 등록된 모든 재고 데이터가 함께 삭제됩니다.`)) return;
    setFinances(prev => prev.filter(f => f !== fcName));
    setItems(prev => prev.filter(i => i.financeCompany !== fcName));
    if (selectedFC === fcName) setSelectedFC("전체");
  };

  const handleRenameFinance = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setFinances(prev => prev.map(f => f === oldName ? newName : f));
    setItems(prev => prev.map(i => i.financeCompany === oldName ? { ...i, financeCompany: newName } : i));
    if (selectedFC === oldName) setSelectedFC(newName);
  };

  const [addFCName, setAddFCName] = useState("");
  const handleAddFinance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFCName.trim() || finances.includes(addFCName.trim())) return;
    setFinances(prev => [...prev, addFCName.trim()]);
    setAddFCName("");
  };

  const handleDeleteBrand = (brandName: string) => {
    if (!window.confirm(`'${brandName}' 브랜드를 삭제하시겠습니까?\n해당 브랜드의 모든 모델과 재고 데이터가 함께 삭제됩니다.`)) return;
    setBrands(prev => prev.filter(b => b !== brandName));
    setVehicleOptions(prev => prev.filter(v => v.brand !== brandName));
    setItems(prev => prev.filter(i => i.brand !== brandName));
    if (selectedBrand === brandName) {
      setSelectedBrand("");
    }
  };

  const handleRenameBrand = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setBrands(prev => prev.map(b => b === oldName ? newName : b));
    setVehicleOptions(prev => prev.map(v => v.brand === oldName ? { ...v, brand: newName } : v));
    setItems(prev => prev.map(i => i.brand === oldName ? { ...i, brand: newName } : i));
    if (selectedBrand === oldName) setSelectedBrand(newName);
    setEditTargetBrand(null);
  };

  const handleDeleteVehicleModel = (vehicleLabel: string) => {
    setVehicleOptions(prev => prev.filter(v => v.label !== vehicleLabel));
    setItems(prev => prev.filter(i => i.vehicleName !== vehicleLabel));
    if (selectedVehicle?.label === vehicleLabel) {
      setSelectedVehicle(null);
    }
    setVehicleDeleteConfirm(null);
  };

  const handleRenameVehicleModel = (brand: string, oldLabel: string, newLabel: string) => {
    if (!newLabel.trim() || oldLabel === newLabel) return;
    setVehicleOptions(prev => prev.map(v => v.label === oldLabel ? { ...v, label: newLabel, short: newLabel } : v));
    setItems(prev => prev.map(i => i.vehicleName === oldLabel ? { ...i, vehicleName: newLabel, vehicleShort: newLabel } : i));
    if (selectedVehicle?.label === oldLabel) {
      setSelectedVehicle({ ...selectedVehicle, label: newLabel, short: newLabel });
    }
    setEditTargetModel(null);
  };

  const currentBrandOptions = useMemo(() => {
    if (!selectedBrand) return vehicleOptions;
    return vehicleOptions.filter(v => v.brand === selectedBrand);
  }, [vehicleOptions, selectedBrand]);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);

  useEffect(() => {
    // 선택된 차량이 있고, 현재 브랜드의 옵션 목록에 해당 차량이 없는 경우에만 초기화
    if (selectedVehicle !== null && !currentBrandOptions.find(v => v.label === selectedVehicle.label)) {
      setSelectedVehicle(null); // 유효하지 않은 모델 선택 시 '전체'로 안전하게 초기화
    }
  }, [selectedBrand, currentBrandOptions, selectedVehicle]);

  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState("");

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleName.trim()) return;
    const newV: VehicleOption = {
      label: newVehicleName.trim(),
      short: newVehicleName.trim(),
      brand: selectedBrand,
      slug: newVehicleName.trim().toLowerCase().replace(/\s+/g, "-"),
    };
    setVehicleOptions(prev => [...prev, newV]);
    setVehicleDetails(prev => ({
      ...prev,
      [newV.label]: { trims: [], options: [] }
    }));
    setSelectedVehicle(newV);
    setSearch("");
    logActivity(`[차종 추가] '${newVehicleName}' 모델이 ${selectedBrand} 브랜드에 추가되었습니다.`, 'create');
    setAddVehicleOpen(false);
    setNewVehicleName("");
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.vehicleName.includes(search) ||
        item.vehicleShort.includes(search) ||
        (item.trim && item.trim.includes(search)) ||
        (item.options && item.options.some(o => o.includes(search)));
      const matchFC    = selectedFC === "전체" || item.financeCompany === selectedFC;
      // 브랜드 필터: 전체("")이거나 일치하는 경우
      const matchBrand = !selectedBrand || item.brand === selectedBrand;
      // 차량 모델 필터: 전체(null)이거나 일치하는 경우
      const matchVehicle = !selectedVehicle || item.vehicleName === selectedVehicle.label;
      
      return matchSearch && matchFC && matchBrand && matchVehicle;
    });
  }, [items, search, selectedFC, selectedBrand, selectedVehicle]);

  const totalQty       = items.reduce((s, i) => s + i.quantity, 0);
  const immediateCount = items.filter((i) => i.immediateDelivery && i.quantity > 0).length;

  const handleQuantityChange = (id: string, qty: number) => {
    const item = items.find(i => i.id === id);
    if (item) {
      logActivity(`[수량 변경] ${item.vehicleShort}의 재고가 ${qty}대로 조정되었습니다.`, 'update');
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: qty, status: calcStatus(qty), registeredAt: new Date().toISOString().slice(0, 10) }
          : item
      )
    );
  };

  const handleDeliveryToggle = (id: string, val: boolean) => {
    setItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, immediateDelivery: val } : item)
    );
  };

  const currentDetails = selectedVehicle ? vehicleDetails[selectedVehicle.label] : null;

  const openNew = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      financeCompany: selectedFC === "전체" ? "" : selectedFC,
      vehicleName: selectedVehicle?.label || "",
      vehicleShort: selectedVehicle?.short || "",
      brand: selectedVehicle?.brand || selectedBrand || "",
      trim: currentDetails?.trims[0] || "",
    });
    setDrawerOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditTarget(item);
    setForm({
      vehicleName:       item.vehicleName,
      vehicleShort:      item.vehicleShort,
      brand:             item.brand,
      financeCompany:    item.financeCompany,
      quantity:          item.quantity,
      immediateDelivery: item.immediateDelivery,
      memo:              item.memo,
      trim:              item.trim || "",
      color:             item.color || "",
      options:           item.options || [],
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!form.vehicleName || !form.financeCompany) return;
    const qty = Number(form.quantity) || 0;
    if (editTarget) {
      logActivity(`[재고 수정] ${form.vehicleShort} (${form.financeCompany}) 정보가 수정되었습니다.`, 'update');
      setItems((prev) =>
        prev.map((item) =>
          item.id === editTarget.id
            ? {
                ...item,
                ...form,
                quantity: qty,
                status: calcStatus(qty),
                registeredAt: new Date().toISOString().slice(0, 10),
                trim: form.trim,
                color: form.color,
                options: form.options,
              }
            : item
        )
      );
    } else {
      const newId = `INV-${String(items.length + 1).padStart(3, "0")}-NEW`;
      logActivity(`[신규 재고] ${form.vehicleShort} (${form.financeCompany}) 재고가 신규 등록되었습니다.`, 'create');
      setItems((prev) => [
        {
          id: newId,
          vehicleName:       form.vehicleName,
          vehicleShort:      form.vehicleShort,
          brand:             form.brand,
          financeCompany:    form.financeCompany,
          quantity:          qty,
          immediateDelivery: form.immediateDelivery,
          status:            calcStatus(qty),
          registeredAt:      new Date().toISOString().slice(0, 10),
          memo:              form.memo,
          trim:              form.trim,
          color:             form.color,
          options:           form.options,
        },
        ...prev,
      ]);
    }
    
    // 저장 후 해당 카테고리로 자동 이동 (내비게이션)
    setSelectedFC(form.financeCompany);
    setSelectedBrand(form.brand);
    const v = vehicleOptions.find(opt => opt.label === form.vehicleName);
    if (v) setSelectedVehicle(v);
    
    setDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      logActivity(`[재고 삭제] ${item.vehicleShort} (${item.financeCompany}) 재고를 삭제했습니다.`, 'delete');
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
  };

  // 드로어에서 선택된 차량의 상세 정보 (form.vehicleName 기반)
  const formDetails = form.vehicleName ? vehicleDetails[form.vehicleName] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">

      {/* ── 1. 표준 헤더 & KPI ── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 flex items-center justify-between shrink-0 z-20">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] flex items-center gap-2">
            <Package size={20} className="text-[#000666]" strokeWidth={2.5} />
            금융사 재고 현황
          </h1>
          <p className="text-[12px] text-[#6B7399] mt-1">{today} · 실시간 보유 재고 동기화 중</p>
        </div>

        <div className="flex items-center gap-0">
          <KPIMini label="총 재고" value={totalQty} unit="대" highlight />
          <div className="w-[1px] h-10 bg-[#E8EAF0]" />
          <KPIMini label="즉시 출고" value={immediateCount} unit="건" color="text-emerald-600" />
          <div className="w-[1px] h-10 bg-[#E8EAF0]" />
          <KPIMini label="금융사수" value={finances.length} unit="개사" color="text-[#0EA5E9]" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 좌측 금융사 목록 (사이드바) ────────────────────────────────── */}
        <div className="w-[180px] bg-white border-r border-[#E8EAF0] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[#F0F2F8]">
            <h2 className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">캐피탈사 목록</h2>
          </div>
          <div className="flex-1 overflow-y-auto w-full py-2">
            {/* 전체 선택 옵션 추가 */}
            <button
              onClick={() => setSelectedFC("전체")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium transition-colors",
                selectedFC === "전체"
                  ? "bg-[#F4F5F8] text-[#000666] border-r-2 border-[#000666]"
                  : "text-[#4A5270] hover:bg-[#FAFBFF] hover:text-[#1A1A2E]"
              )}
            >
              <span className="truncate">전체 캐피탈사</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-[4px]",
                selectedFC === "전체" ? "bg-[#000666] text-white" : "bg-[#F0F2F8] text-[#9BA4C0]"
              )}>
                {items.filter(i => !selectedBrand || i.brand === selectedBrand).reduce((s, i) => s + i.quantity, 0)}
              </span>
            </button>

            {finances.map((fc) => {
              const count = items
                .filter(i => i.financeCompany === fc && (!selectedBrand || i.brand === selectedBrand))
                .reduce((sum, item) => sum + item.quantity, 0);
              return (
                <button
                  key={fc}
                  onClick={() => setSelectedFC(fc)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium transition-colors",
                    selectedFC === fc
                      ? "bg-[#F4F5F8] text-[#000666] border-r-2 border-[#000666]"
                      : "text-[#4A5270] hover:bg-[#FAFBFF] hover:text-[#1A1A2E]"
                  )}
                >
                  <span className="truncate">{fc}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-[4px]",
                    selectedFC === fc ? "bg-[#000666] text-white" : "bg-[#F0F2F8] text-[#9BA4C0]"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t border-[#F0F2F8]">
            <button 
              onClick={() => setIsFinanceManageOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-[11px] font-bold text-[#6B7399] bg-[#F4F5F8] hover:bg-[#E8EAF0] transition-colors"
            >
              <Settings size={12} /> 금융사 관리
            </button>
          </div>
        </div>

        {/* ── 우측 메인 콘텐츠 ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="px-6 py-4 border-b border-[#E8EAF0] shrink-0 bg-white">
            {/* 브랜드 필터 */}
            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-[#F4F5F8]">
              <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider shrink-0 w-16">브랜드</h3>
              <div className="flex gap-2 flex-wrap">
                {/* 전체 브랜드 버튼 */}
                <button
                  onClick={() => setSelectedBrand("")}
                  className={cn(
                    "px-3 py-1.5 text-[12px] font-bold rounded-[6px] transition-colors flex items-center gap-2",
                    selectedBrand === "" ? "bg-[#000666] text-white" : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                  )}
                >
                  <span>전체</span>
                  {(() => {
                    const totalCount = items
                      .filter(i => selectedFC === "전체" || i.financeCompany === selectedFC)
                      .reduce((sum, item) => sum + item.quantity, 0);
                    return totalCount > 0 && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        selectedBrand === "" ? "bg-white/20 text-white" : "bg-[#E8EAF0] text-[#9BA4C0]"
                      )}>
                        {totalCount}
                      </span>
                    );
                  })()}
                </button>

                {brands.map(brand => (
                  <div key={brand} className="group/br relative">
                    <button
                      onClick={() => setSelectedBrand(brand)}
                      className={cn(
                        "px-3 py-1.5 text-[12px] font-bold rounded-[6px] transition-colors flex items-center gap-2",
                        selectedBrand === brand ? "bg-[#E5E5FA] text-[#000666]" : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                      )}
                    >
                      <span className="truncate max-w-[100px]">{brand}</span>
                      {(() => {
                        const count = items
                          .filter(i => (selectedFC === "전체" || i.financeCompany === selectedFC) && i.brand === brand)
                          .reduce((s, i) => s + i.quantity, 0);
                        return count > 0 && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full",
                            selectedBrand === brand ? "bg-white text-[#000666]" : "bg-[#E8EAF0] text-[#9BA4C0]"
                          )}>{count}</span>
                        );
                      })()}
                    </button>
                    <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover/br:opacity-100 transition-opacity z-10">
                      <button onClick={(e) => { e.stopPropagation(); setEditTargetBrand(brand); }} className="w-5 h-5 rounded-full bg-white border border-[#E8EAF0] flex items-center justify-center text-[#6B7399] hover:text-[#000666] shadow-sm"><Pencil size={9} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteBrand(brand); }} className="w-5 h-5 rounded-full bg-white border border-[#E8EAF0] flex items-center justify-center text-[#6B7399] hover:text-red-500 shadow-sm"><Trash2 size={9} /></button>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setAddBrandOpen(true)}
                  className="px-3 py-1.5 border border-dashed border-[#C0C5DC] text-[#6B7399] rounded-[6px] text-[12px] font-bold hover:bg-white transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> 추가
                </button>
              </div>
            </div>

            {/* 차량 모델 필터 */}
            <div className="flex items-center gap-4">
              <h3 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider shrink-0 w-16">차량 모델</h3>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
                {/* 전체 모델 버튼 */}
                <button
                  onClick={() => { setSelectedVehicle(null); setSearch(""); }}
                  className={cn(
                    "px-4 py-2 text-[13px] font-bold rounded-full whitespace-nowrap transition-colors border flex items-center gap-2",
                    selectedVehicle === null
                      ? "bg-[#1A1A2E] text-white border-[#1A1A2E]"
                      : "bg-white text-[#6B7399] border-[#E8EAF0] hover:border-[#C0C5DC] hover:text-[#1A1A2E]"
                  )}
                >
                  <span>전체</span>
                  {(() => {
                    const totalModelCount = items
                      .filter(i => 
                        (selectedFC === "전체" || i.financeCompany === selectedFC) && 
                        (!selectedBrand || i.brand === selectedBrand)
                      )
                      .reduce((sum, item) => sum + item.quantity, 0);
                    return totalModelCount > 0 && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        selectedVehicle === null ? "bg-white/20 text-white" : "bg-[#F0F2F8] text-[#9BA4C0]"
                      )}>
                        {totalModelCount}
                      </span>
                    );
                  })()}
                </button>

                {currentBrandOptions.map((v) => (
                  <div key={v.label} className="group relative shrink-0">
                    <button
                      onClick={() => { setSelectedVehicle(v); setSearch(""); }}
                      className={cn(
                        "px-4 py-2 text-[13px] font-bold rounded-full whitespace-nowrap transition-colors border pr-8 relative flex items-center gap-2",
                        selectedVehicle?.label === v.label
                          ? "bg-[#1A1A2E] text-white border-[#1A1A2E]"
                          : "bg-white text-[#6B7399] border-[#E8EAF0] hover:border-[#C0C5DC] hover:text-[#1A1A2E]"
                      )}
                    >
                      <span>{v.short}</span>
                      {(() => {
                        const vCount = items
                          .filter(i => (selectedFC === "전체" || i.financeCompany === selectedFC) && i.vehicleName === v.label)
                          .reduce((sum, item) => sum + item.quantity, 0);
                        return vCount > 0 ? (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                            selectedVehicle?.label === v.label ? "bg-white/20 text-white" : "bg-[#F0F2F8] text-[#9BA4C0]"
                          )}>
                            {vCount}
                          </span>
                        ) : null;
                      })()}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setVehicleDeleteConfirm(v); }}
                      className={cn(
                        "absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10",
                        selectedVehicle?.label === v.label ? "text-white/70 hover:text-white" : "text-[#9BA4C0] hover:text-red-500"
                      )}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setAddVehicleOpen(true)}
                  className="px-4 py-2 text-[13px] font-bold rounded-full whitespace-nowrap transition-colors border border-dashed border-[#C0C5DC] text-[#6B7399] hover:bg-[#F4F5F8] hover:text-[#1A1A2E] flex items-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={2.5} /> 차종 추가
                </button>
              </div>
            </div>
          </div>

          {/* 차량 선택 정보 + 검색 + 등록 버튼 */}
          <div className="px-6 py-4 bg-[#FAFBFF] border-b border-[#E8EAF0] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white border border-[#E8EAF0] flex items-center justify-center shadow-sm shrink-0">
                <Car size={24} className="text-[#000666]" strokeWidth={1} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-[#E5E5FA] text-[#000666] px-1.5 py-0.5 rounded-[4px] font-bold">{selectedVehicle?.brand}</span>
                  <h2 className="text-[16px] font-bold text-[#1A1A2E]">{selectedVehicle?.label || "선택된 차량 없음"}</h2>
                </div>
                <p className="text-[12px] text-[#6B7399]">
                  {selectedFC} 보유 재고 <strong className="text-[#1A1A2E]">{filtered.reduce((s, i) => s + i.quantity, 0)}</strong>대 • 즉시 출고 가능 <strong className="text-emerald-600">{filtered.filter(i => i.immediateDelivery && i.quantity > 0).length}</strong>대
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative mr-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="차량명/트림/옵션 검색"
                  className="w-[180px] pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E] shadow-sm transition-colors"
                />
              </div>
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#000666] text-white rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus size={13} strokeWidth={2.5} />
                차량 등록
              </button>
            </div>
          </div>

          {/* 재고 테이블 */}
          <div className="flex-1 overflow-auto min-h-0 relative">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 z-10 border-b border-[#F0F2F8] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <tr>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">ID</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">차량</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">
                    재고 수량 <span className="ml-1 text-[9px] font-normal text-[#B0B5CC] normal-case">(클릭)</span>
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">즉시 출고</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center">상태</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">등록일</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F8]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9BA4C0]">
                        <Package size={32} strokeWidth={1} />
                        <p className="text-[13px]">{selectedFC} 재고 데이터가 없습니다.</p>
                        <button onClick={openNew} className="mt-2 text-[12px] text-[#000666] underline underline-offset-2">
                          재고 등록하기
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const SS = STATUS_STYLE[item.status];
                    const SIcon = SS.icon;
                    return (
                      <tr key={item.id} className="group hover:bg-[#FAFBFF] transition-colors">
                        <td className="py-3.5 px-4 w-[100px]">
                          <span className="text-[11px] font-mono text-[#9BA4C0] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[3px]">
                            {item.id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 min-w-[250px]">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              item.brand === "현대"    ? "bg-[#000666]" :
                              item.brand === "기아"    ? "bg-[#C00]"    :
                                                         "bg-[#7C6E4A]"
                            )} />
                            <div>
                              <p className="text-[13px] font-semibold text-[#1A1A2E]">{item.vehicleShort}</p>
                              <p className="text-[11px] text-[#9BA4C0] truncate max-w-[240px]">{item.vehicleName}</p>
                              {(item.trim || item.color || (item.options && item.options.length > 0)) && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {item.trim && <span className="px-1.5 py-0.5 bg-[#F4F5F8] text-[#6B7399] text-[10px] rounded-[4px] border border-[#E8EAF0]">{item.trim}</span>}
                                  {item.color && <span className="px-1.5 py-0.5 bg-[#F4F5F8] text-[#6B7399] text-[10px] rounded-[4px] border border-[#E8EAF0]">{item.color}</span>}
                                  {(item.options && item.options.length > 0) && <span className="px-1.5 py-0.5 bg-[#E5E5FA] text-[#000666] text-[10px] rounded-[4px] border border-[#D0D4E8]">옵션 {item.options.length}개</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center w-[120px]">
                          <QuantityCell value={item.quantity} onSave={(n) => handleQuantityChange(item.id, n)} />
                        </td>
                        <td className="py-3.5 px-4 text-center w-[100px]">
                          <DeliveryToggle value={item.immediateDelivery} onChange={(v) => handleDeliveryToggle(item.id, v)} />
                        </td>
                        <td className="py-3.5 px-4 text-center w-[100px]">
                          <div className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border", SS.bg, SS.text, SS.border)}>
                            <SIcon size={10} strokeWidth={2.5} />
                            {item.status}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[12px] text-[#6B7399] w-[100px]">
                          {item.registeredAt}
                        </td>
                        <td className="py-3.5 px-4 w-[130px]">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(item)} className="p-1.5 text-[#6B7399] hover:bg-[#E8EAF0] rounded-[4px] transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-[4px] transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="h-16 shrink-0" /> {/* 리스트 끝 여백 */}
          </div>
          {/* 하단 페이드 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 opacity-70" />
        </div>

      </div>

      {/* ── 등록/수정 Drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-[440px] bg-white z-50 flex flex-col border-l border-[#E8EAF0] shadow-[-10px_0_30px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8EAF0] bg-[#FAFBFF]">
                <div>
                  <p className="text-[11px] font-semibold text-[#6B7399] uppercase tracking-wider mb-0.5">
                    {editTarget ? "재고 수정" : "재고 신규 등록"}
                  </p>
                  <h2 className="text-[17px] font-bold text-[#1A1A2E]">
                    {editTarget ? editTarget.vehicleShort : "새 재고 항목"}
                  </h2>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-[6px] text-[#6B7399] hover:bg-[#E8EAF0] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* 금융사 선택 */}
                <FormField label="금융사" required>
                  <div className="relative">
                    <select
                      value={form.financeCompany}
                      onChange={(e) => setForm(f => ({ ...f, financeCompany: e.target.value }))}
                      className="w-full appearance-none pl-10 pr-8 py-2.5 text-[13px] font-semibold bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] cursor-pointer"
                    >
                      <option value="">금융사를 선택하세요</option>
                      {FINANCE_COMPANIES.map(fc => <option key={fc} value={fc}>{fc}</option>)}
                    </select>
                    <Building2 size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                </FormField>

                {/* 브랜드 선택 */}
                <FormField label="브랜드" required>
                  <div className="relative">
                    <select
                      value={form.brand}
                      onChange={(e) => {
                        const newBrand = e.target.value;
                        setForm(f => ({ ...f, brand: newBrand, vehicleName: "", vehicleShort: "", trim: "", options: [] }));
                      }}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-[13px] font-semibold bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] cursor-pointer"
                    >
                      <option value="">브랜드를 선택하세요</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                </FormField>

                {/* 차량명(모델) 선택 */}
                <FormField label="차량 모델" required>
                  <div className="relative">
                    <select
                      value={form.vehicleName}
                      disabled={!form.brand}
                      onChange={(e) => {
                        const modelName = e.target.value;
                        const model = vehicleOptions.find(v => v.label === modelName);
                        if (model) {
                          const details = vehicleDetails[modelName];
                          setForm(f => ({ 
                            ...f, 
                            vehicleName: modelName, 
                            vehicleShort: model.short,
                            trim: details?.trims[0] || "",
                            options: []
                          }));
                        }
                      }}
                      className={cn(
                        "w-full appearance-none pl-10 pr-8 py-2.5 text-[13px] font-semibold border rounded-[8px] outline-none focus:border-[#C0C5DC] cursor-pointer transition-colors",
                        !form.brand ? "bg-[#F4F5F8] border-[#E8EAF0] text-[#9BA4C0] opacity-60" : "bg-[#F8F9FC] border-[#E8EAF0] text-[#1A1A2E]"
                      )}
                    >
                      <option value="">차량 모델을 선택하세요</option>
                      {vehicleOptions
                        .filter(v => v.brand === form.brand)
                        .map(v => <option key={v.label} value={v.label}>{v.label}</option>)
                      }
                    </select>
                    <Car size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                </FormField>

                {/* 트림 선택: DB 데이터 기반 */}
                {formDetails && formDetails.trims.length > 0 && (
                  <FormField label="트림" required>
                    <div className="relative">
                      <select
                        value={form.trim}
                        onChange={(e) => setForm(f => ({ ...f, trim: e.target.value }))}
                        className="w-full appearance-none pl-3 pr-8 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] cursor-pointer"
                      >
                        <option value="">트림을 선택하세요</option>
                        {formDetails.trims.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                    </div>
                  </FormField>
                )}

                {/* 색상: 자유 입력 텍스트 */}
                <FormField label="외장/내장 색상">
                  <input
                    type="text"
                    placeholder="예: 아틀라스 화이트, 어비스 블랙 펄"
                    value={form.color}
                    onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full px-3 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] transition-colors"
                  />
                </FormField>

                {/* 추가 옵션: DB 데이터 기반 체크박스 */}
                {formDetails && formDetails.options.length > 0 && (
                  <FormField label="추가 옵션">
                    <div className="flex flex-wrap gap-2 mt-1 max-h-[200px] overflow-y-auto pr-1">
                      {formDetails.options.map((opt) => {
                        const isSelected = form.options.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setForm((f) => ({
                              ...f,
                              options: isSelected ? f.options.filter(o => o !== opt) : [...f.options, opt]
                            }))}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all",
                              isSelected
                                ? "bg-[#000666] text-white border-[#000666] shadow-sm"
                                : "bg-white text-[#6B7399] border-[#E8EAF0] hover:border-[#C0C5DC]"
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {form.options.length > 0 && (
                      <p className="mt-2 text-[11px] text-[#000666] font-medium">{form.options.length}개 선택됨</p>
                    )}
                  </FormField>
                )}

                {/* 직접 입력 옵션 (DB 옵션이 없는 경우) */}
                {formDetails && formDetails.options.length === 0 && (
                  <FormField label="추가 옵션">
                    <p className="text-[12px] text-[#9BA4C0] py-2">이 차량의 옵션 데이터가 없습니다.</p>
                  </FormField>
                )}

                {/* 재고 수량 */}
                <FormField label="재고 수량 (대)" required>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC]"
                  />
                  {form.quantity >= 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <StatusPreview status={calcStatus(Number(form.quantity))} />
                    </div>
                  )}
                </FormField>

                {/* 즉시 출고 */}
                <FormField label="즉시 출고 가능 여부">
                  <div className="flex items-center gap-3 py-1">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, immediateDelivery: true }))}
                      className={cn(
                        "flex-1 py-2.5 rounded-[8px] text-[12px] font-semibold border transition-all",
                        form.immediateDelivery
                          ? "bg-[#000666] text-white border-[#000666]"
                          : "bg-white text-[#9BA4C0] border-[#E8EAF0] hover:border-[#C0C5DC]"
                      )}
                    >
                      ✓ 즉시 출고 가능
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, immediateDelivery: false }))}
                      className={cn(
                        "flex-1 py-2.5 rounded-[8px] text-[12px] font-semibold border transition-all",
                        !form.immediateDelivery
                          ? "bg-[#F4F5F8] text-[#4A5270] border-[#D0D4E8]"
                          : "bg-white text-[#9BA4C0] border-[#E8EAF0] hover:border-[#C0C5DC]"
                      )}
                    >
                      출고 불가
                    </button>
                  </div>
                </FormField>

                {/* 메모 */}
                <FormField label="관리자 메모">
                  <textarea
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                    placeholder="입고 경위, 특이사항 등을 기록하세요."
                    rows={4}
                    className="w-full px-3 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#4A5270] outline-none focus:border-[#C0C5DC] resize-none transition-colors"
                  />
                </FormField>
              </div>

              <div className="px-6 py-4 border-t border-[#E8EAF0] bg-white flex items-center gap-3">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-[#6B7399] bg-[#F4F5F8] hover:bg-[#E8EAF0] transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.vehicleName || !form.financeCompany}
                  className={cn(
                    "flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold transition-all",
                    form.vehicleName && form.financeCompany
                      ? "bg-[#000666] text-white hover:opacity-90"
                      : "bg-[#E8EAF0] text-[#9BA4C0] cursor-not-allowed"
                  )}
                >
                  {editTarget ? "수정 저장" : "재고 등록"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 삭제 확인 모달 ───────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setDeleteTarget(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 8 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="w-[360px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] pointer-events-auto overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] text-center mb-2">재고 항목 삭제</h3>
                  <p className="text-[13px] text-[#6B7399] text-center leading-relaxed">
                    <strong className="text-[#1A1A2E]">{deleteTarget.financeCompany}</strong>의{" "}
                    <strong className="text-[#1A1A2E]">{deleteTarget.vehicleShort}</strong> 재고를 삭제합니다.
                    <br />이 작업은 되돌릴 수 없습니다.
                  </p>
                </div>
                <div className="flex border-t border-[#E8EAF0]">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-3.5 text-[13px] font-semibold text-[#6B7399] hover:bg-[#F8F9FC] transition-colors"
                  >
                    취소
                  </button>
                  <div className="w-[1px] bg-[#E8EAF0]" />
                  <button
                    onClick={() => handleDelete(deleteTarget.id)}
                    className="flex-1 py-3.5 text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    삭제 확인
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── 신규 차종 추가 모달 ────────────────────────────────────────── */}
      <AnimatePresence>
        {addVehicleOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setAddVehicleOpen(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-[380px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] pointer-events-auto overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-[#E8EAF0] flex items-center justify-between bg-[#FAFBFF]">
                  <div className="flex items-center gap-2">
                    <Car size={16} className="text-[#000666]" />
                    <h3 className="text-[15px] font-bold text-[#1A1A2E]">{selectedBrand} 차종 추가</h3>
                  </div>
                  <button
                    onClick={() => setAddVehicleOpen(false)}
                    className="p-1.5 rounded-[6px] text-[#9BA4C0] hover:text-[#1A1A2E] hover:bg-[#E8EAF0] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleAddVehicle} className="p-6 space-y-5">
                  <FormField label="차량 모델명" required>
                    <input
                      autoFocus
                      placeholder="예: 현대 더 뉴 아반떼 하이브리드"
                      value={newVehicleName}
                      onChange={(e) => setNewVehicleName(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E]"
                    />
                    <p className="mt-2 text-[11px] text-[#9BA4C0] leading-normal">
                      목록에 표시될 모델명을 입력해주세요.<br/>상세 트림, 옵션 정보는 재고 등록 시 입력할 수 있습니다.
                    </p>
                  </FormField>
                  <div className="pt-2 flex gap-3 border-t border-[#E8EAF0] mt-4 w-full">
                    <button type="button" onClick={() => setAddVehicleOpen(false)} className="flex-1 py-3 bg-[#F4F5F8] hover:bg-[#E8EAF0] text-[#6B7399] font-bold text-[13px] rounded-[8px] transition-colors">취소</button>
                    <button type="submit" disabled={!newVehicleName.trim()} className="flex-1 py-3 bg-[#000666] hover:opacity-90 disabled:bg-[#E8EAF0] disabled:text-[#9BA4C0] text-white font-bold text-[13px] rounded-[8px] transition-colors">차종 추가</button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── 신규 브랜드 추가 모달 ────────────────────────────────────────── */}
      <AnimatePresence>
        {addBrandOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setAddBrandOpen(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-[340px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden pointer-events-auto"
              >
                <div className="px-6 py-4 border-b border-[#E8EAF0] flex items-center justify-between bg-[#FAFBFF]">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#000666]" />
                    <h3 className="text-[15px] font-bold text-[#1A1A2E]">신규 브랜드 추가</h3>
                  </div>
                  <button
                    onClick={() => setAddBrandOpen(false)}
                    className="p-1.5 rounded-[6px] text-[#9BA4C0] hover:text-[#1A1A2E] hover:bg-[#E8EAF0] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleAddBrand} className="p-6 space-y-5">
                  <FormField label="브랜드명" required>
                    <input
                      autoFocus
                      placeholder="예: 르노코리아"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E]"
                    />
                  </FormField>
                  <div className="pt-2 flex gap-3 border-t border-[#E8EAF0] mt-4 w-full">
                    <button type="button" onClick={() => setAddBrandOpen(false)} className="flex-1 py-3 bg-[#F4F5F8] hover:bg-[#E8EAF0] text-[#6B7399] font-bold text-[13px] rounded-[8px] transition-colors">취소</button>
                    <button type="submit" disabled={!newBrandName.trim()} className="flex-1 py-3 bg-[#000666] hover:opacity-90 disabled:bg-[#E8EAF0] disabled:text-[#9BA4C0] text-white font-bold text-[13px] rounded-[8px] transition-colors">추가</button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── 브랜드 삭제 확인 모달 ────────────────────────────────────── */}
      <AnimatePresence>
        {brandDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setBrandDeleteConfirm(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-[340px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden pointer-events-auto"
              >
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-2">브랜드 삭제 확인</h3>
                  <p className="text-[13px] text-[#6B7399] leading-relaxed">
                    <strong className="text-[#1A1A2E]">{brandDeleteConfirm}</strong> 브랜드와 관련된 모든 차량 모델 및 재고 데이터가 영구적으로 삭제됩니다.
                  </p>
                </div>
                <div className="flex border-t border-[#E8EAF0]">
                  <button onClick={() => setBrandDeleteConfirm(null)} className="flex-1 py-3.5 text-[13px] font-semibold text-[#6B7399] hover:bg-[#F8F9FC]">취소</button>
                  <div className="w-[1px] bg-[#E8EAF0]" />
                  <button onClick={() => handleDeleteBrand(brandDeleteConfirm)} className="flex-1 py-3.5 text-[13px] font-bold text-red-500 hover:bg-red-50">브랜드 삭제</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── 차종 삭제 확인 모달 ────────────────────────────────────── */}
      <AnimatePresence>
        {vehicleDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setVehicleDeleteConfirm(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-[340px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden pointer-events-auto"
              >
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-2">차종 삭제 확인</h3>
                  <p className="text-[13px] text-[#6B7399] leading-relaxed">
                    <strong className="text-[#1A1A2E]">{vehicleDeleteConfirm.short}</strong> 차종과 관련된 모든 재고 데이터가 영구적으로 삭제됩니다.
                  </p>
                </div>
                <div className="flex border-t border-[#E8EAF0]">
                  <button onClick={() => setVehicleDeleteConfirm(null)} className="flex-1 py-3.5 text-[13px] font-semibold text-[#6B7399] hover:bg-[#F8F9FC]">취소</button>
                  <div className="w-[1px] bg-[#E8EAF0]" />
                  <button onClick={() => handleDeleteVehicleModel(vehicleDeleteConfirm.label)} className="flex-1 py-3.5 text-[13px] font-bold text-red-500 hover:bg-red-50">차종 삭제</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFinanceManageOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFinanceManageOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-[400px] bg-white rounded-[16px] shadow-2xl overflow-hidden pointer-events-auto">
                <div className="px-6 py-4 border-b border-[#F0F2F8] flex items-center justify-between bg-[#FAFBFF]">
                  <h3 className="text-[15px] font-bold text-[#1A1A2E]">금융사(캐피탈) 관리</h3>
                  <button onClick={() => setIsFinanceManageOpen(false)} className="p-1.5 hover:bg-[#E8EAF0] rounded-[6px] text-[#9BA4C0]"><X size={18} /></button>
                </div>
                <div className="p-6">
                  <form onSubmit={handleAddFinance} className="flex gap-2 mb-6">
                    <input value={addFCName} onChange={e => setAddFCName(e.target.value)} placeholder="새 금융사 이름..." className="flex-1 px-3 py-2 text-[13px] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666]" />
                    <button type="submit" className="px-4 py-2 bg-[#000666] text-white text-[12px] font-bold rounded-[6px] hover:opacity-90">추가</button>
                  </form>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {finances.map(fc => (
                      <div key={fc} className="flex items-center justify-between p-3 rounded-[8px] bg-[#F8F9FC] border border-[#F0F2F8] group">
                        <span className="text-[13px] font-medium text-[#1A1A2E]">{fc}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                            const newer = prompt("새 금융사 이름을 입력하세요", fc);
                            if (newer) handleRenameFinance(fc, newer);
                          }} className="p-1.5 text-[#6B7399] hover:text-[#000666] hover:bg-white rounded-[4px] shadow-sm border border-[#E8EAF0]"><Pencil size={12} /></button>
                          <button onClick={() => handleDeleteFinance(fc)} className="p-1.5 text-[#6B7399] hover:text-red-500 hover:bg-white rounded-[4px] shadow-sm border border-[#E8EAF0]"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTargetBrand && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTargetBrand(null)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full max-w-[340px] bg-white rounded-[16px] shadow-2xl p-6 pointer-events-auto">
                <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-4">브랜드 이름 수정</h3>
                <input 
                  defaultValue={editTargetBrand} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameBrand(editTargetBrand, e.currentTarget.value);
                  }}
                  autoFocus
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#000666] mb-4"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditTargetBrand(null)} className="flex-1 py-2.5 bg-[#F4F5F8] text-[#6B7399] text-[13px] font-bold rounded-[8px]">취소</button>
                  <button onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    handleRenameBrand(editTargetBrand, input.value);
                  }} className="flex-1 py-2.5 bg-[#000666] text-white text-[13px] font-bold rounded-[8px]">변경 저장</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTargetModel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTargetModel(null)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
            <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="w-full max-w-[340px] bg-white rounded-[16px] shadow-2xl p-6 pointer-events-auto">
                <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-4">차량 모델명 수정</h3>
                <input 
                  defaultValue={editTargetModel.label} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameVehicleModel(editTargetModel.brand, editTargetModel.label, e.currentTarget.value);
                  }}
                  autoFocus
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E8EAF0] rounded-[8px] outline-none focus:border-[#000666] mb-4"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditTargetModel(null)} className="flex-1 py-2.5 bg-[#F4F5F8] text-[#6B7399] text-[13px] font-bold rounded-[8px]">취소</button>
                  <button onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    handleRenameVehicleModel(editTargetModel.brand, editTargetModel.label, input.value);
                  }} className="flex-1 py-2.5 bg-[#000666] text-white text-[13px] font-bold rounded-[8px]">변경 저장</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      <div className="px-6 py-4 bg-[#FAFBFF] border-t border-[#E8EAF0] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[#6B7399]">전체 <strong className="text-[#1A1A2E]">{filtered.length}</strong>개의 항목이 등록되어 있습니다.</span>
        </div>
        <div className="text-[11px] text-[#B0B5CC] font-bold tracking-tight uppercase">System Status: <span className="text-emerald-500">Live</span> · Update: 2026-04-16</div>
      </div>
    </div>
  );
}
