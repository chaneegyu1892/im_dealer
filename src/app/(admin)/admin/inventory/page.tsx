"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, X, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, Pencil,
  Trash2, Building2, Car, ToggleLeft, ToggleRight,
  RefreshCw, ClipboardList, TrendingDown, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_INVENTORY,
  FINANCE_COMPANIES,
  VEHICLE_BRANDS,
  type InventoryItem,
  type InventoryStatus,
} from "@/constants/mock-data";

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

const VEHICLE_OPTIONS = [
  { label: "현대 아이오닉 6 롱레인지 익스클루시브", short: "아이오닉 6",   brand: "현대" },
  { label: "현대 투싼 하이브리드 인스퍼레이션",     short: "투싼 HEV",    brand: "현대" },
  { label: "기아 EV6 롱레인지 GT-Line",             short: "기아 EV6",    brand: "기아" },
  { label: "기아 쏘렌토 하이브리드 시그니처",       short: "쏘렌토 HEV",  brand: "기아" },
  { label: "기아 K8 하이브리드 노블레스",           short: "K8 HEV",      brand: "기아" },
  { label: "제네시스 GV80 2.5 가솔린 터보 시그나처", short: "GV80",       brand: "제네시스" },
];

const EMPTY_FORM = {
  vehicleName: "",
  vehicleShort: "",
  brand: "",
  financeCompany: "",
  quantity: 0,
  immediateDelivery: true,
  memo: "",
};

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-[#E8EAF0] rounded-[6px] text-[#4A5270] outline-none focus:border-[#C0C5DC] cursor-pointer shadow-sm hover:border-[#C0C5DC] transition-colors"
      >
        <option value="">{label} 전체</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [search, setSearch] = useState("");
  const [selectedFC, setSelectedFC] = useState(FINANCE_COMPANIES[0]);
  const [filterBrand, setFilterBrand] = useState("");

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
        item.vehicleShort.includes(search);
      const matchFC    = item.financeCompany === selectedFC;
      const matchBrand = !filterBrand || item.brand === filterBrand;
      return matchSearch && matchFC && matchBrand;
    });
  }, [items, search, selectedFC, filterBrand]);

  const totalQty       = items.reduce((s, i) => s + i.quantity, 0);
  const immediateCount = items.filter((i) => i.immediateDelivery && i.quantity > 0).length;
  const fcCount        = FINANCE_COMPANIES.length;
  const lastUpdated    = items.reduce((latest, i) => i.registeredAt > latest ? i.registeredAt : latest, "");
  const soginCount     = items.filter((i) => i.status === "소진").length;

  const handleQuantityChange = (id: string, qty: number) => {
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

  const openNew = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, financeCompany: selectedFC });
    setDrawerOpen(true);
  };
  const openEdit = (item: InventoryItem) => {
    setEditTarget(item);
    setForm({
      vehicleName:      item.vehicleName,
      vehicleShort:     item.vehicleShort,
      brand:            item.brand,
      financeCompany:   item.financeCompany,
      quantity:         item.quantity,
      immediateDelivery: item.immediateDelivery,
      memo:             item.memo,
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!form.vehicleName || !form.financeCompany) return;
    const qty = Number(form.quantity) || 0;
    if (editTarget) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editTarget.id
            ? {
                ...item,
                ...form,
                quantity: qty,
                status: calcStatus(qty),
                registeredAt: new Date().toISOString().slice(0, 10),
              }
            : item
        )
      );
    } else {
      const newId = `INV-${String(items.length + 1).padStart(3, "0")}-NEW`;
      setItems((prev) => [
        {
          id: newId,
          vehicleName:      form.vehicleName,
          vehicleShort:     form.vehicleShort,
          brand:            form.brand,
          financeCompany:   form.financeCompany,
          quantity:         qty,
          immediateDelivery: form.immediateDelivery,
          status:           calcStatus(qty),
          registeredAt:     new Date().toISOString().slice(0, 10),
          memo:             form.memo,
        },
        ...prev,
      ]);
    }
    setDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
  };

  const handleVehicleSelect = (label: string) => {
    const v = VEHICLE_OPTIONS.find((o) => o.label === label);
    if (v) setForm((f) => ({ ...f, vehicleName: v.label, vehicleShort: v.short, brand: v.brand }));
    else    setForm((f) => ({ ...f, vehicleName: label, vehicleShort: "", brand: "" }));
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">

      {/* ── 헤더 & 전체 KPI ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 shrink-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-[#8890AA]">{today}</p>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] mt-0.5 flex items-center gap-2">
              <Package size={18} className="text-[#000666]" strokeWidth={2} />
              금융사 재고 현황
            </h1>
            <p className="text-[12px] text-[#6B7399] mt-1">
              금융사별 보유 차량 재고를 나누어 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-0 divide-x divide-[#E8EAF0]">
            <KPIChip
              icon={<Layers size={14} className="text-[#000666]" />}
              label="총 보유 재고"
              value={totalQty}
              unit="대"
              bg="bg-[#E5E5FA]"
            />
            <KPIChip
              icon={<CheckCircle2 size={14} className="text-emerald-600" />}
              label="즉시 출고 가능"
              value={immediateCount}
              unit="건"
              bg="bg-emerald-50"
              valueColor="text-emerald-700"
            />
            <KPIChip
              icon={<Building2 size={14} className="text-[#0EA5E9]" />}
              label="금융사 수"
              value={fcCount}
              unit="개사"
              bg="bg-sky-50"
              valueColor="text-[#0284c7]"
            />
            <KPIChip
              icon={<TrendingDown size={14} className="text-red-500" />}
              label="소진 항목"
              value={soginCount}
              unit="건"
              bg="bg-red-50"
              valueColor="text-red-600"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9BA4C0]">
          <RefreshCw size={10} />
          <span>마지막 등록일: <strong className="text-[#6B7399]">{lastUpdated}</strong></span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 좌측 금융사 목록 (사이드바) ────────────────────────────────── */}
        <div className="w-[180px] bg-white border-r border-[#E8EAF0] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[#F0F2F8]">
            <h2 className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">캐피탈사 목록</h2>
          </div>
          <div className="flex-1 overflow-y-auto w-full py-2">
            {FINANCE_COMPANIES.map((fc) => {
              const count = items.filter(i => i.financeCompany === fc).reduce((sum, item) => sum + item.quantity, 0);
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
        </div>

        {/* ── 우측 메인 콘텐츠 (테이블 영역) ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="px-6 py-3 bg-[#FAFBFF] border-b border-[#E8EAF0] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 mr-2">
                <Building2 size={16} className="text-[#000666]" />
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">{selectedFC} 재고</h2>
              </div>
              <div className="w-px h-4 bg-[#E8EAF0] mx-1" />
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="차량명 검색"
                  className="w-[180px] pl-9 pr-4 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] text-[#1A1A2E] shadow-sm transition-colors"
                />
              </div>
              <FilterSelect label="브랜드" value={filterBrand} options={VEHICLE_BRANDS} onChange={setFilterBrand} />
              {(search || filterBrand) && (
                <button
                  onClick={() => { setSearch(""); setFilterBrand(""); }}
                  className="flex items-center gap-1 text-[11px] text-[#9BA4C0] hover:text-[#6B7399] transition-colors"
                >
                  <X size={11} /> 초기화
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#9BA4C0]">
                {filtered.length}대 표시
              </span>
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#000666] text-white rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus size={13} strokeWidth={2.5} />
                {selectedFC} 전용 등록
              </button>
            </div>
          </div>

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
          </div>
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
                <FormField label="금융사">
                  <div className="w-full px-4 py-2.5 flex items-center justify-between text-[13px] font-semibold bg-[#F4F5F8] border border-[#E8EAF0] rounded-[8px] text-[#4A5270] opacity-80 cursor-not-allowed">
                     <div className="flex flex-row items-center gap-2">
                         <Building2 size={13} className="text-[#9BA4C0]" />
                         {form.financeCompany}
                     </div>
                  </div>
                </FormField>

                <FormField label="차량명" required>
                  <div className="relative">
                    <Car size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
                    <select
                      value={form.vehicleName}
                      onChange={(e) => handleVehicleSelect(e.target.value)}
                      className="w-full appearance-none pl-9 pr-8 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] text-[#1A1A2E] outline-none focus:border-[#C0C5DC] cursor-pointer"
                    >
                      <option value="">차량을 선택하세요</option>
                      {VEHICLE_OPTIONS.map((v) => (
                        <option key={v.label} value={v.label}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                  {form.brand && (
                    <p className="mt-1 text-[11px] text-[#9BA4C0]">
                      브랜드: <strong className="text-[#4A5270]">{form.brand}</strong>
                    </p>
                  )}
                </FormField>

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
              className="absolute inset-0 bg-black/30 backdrop-blur-[3px] z-50"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] z-50 overflow-hidden"
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
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

function KPIChip({
  icon, label, value, unit, bg, valueColor = "text-[#000666]",
}: {
  icon: React.ReactNode; label: string; value: number; unit: string;
  bg: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 first:pl-0 last:pr-0">
      <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0", bg)}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">{label}</p>
        <p className={cn("text-[20px] font-bold leading-none tracking-tight", valueColor)}>
          {value}
          <span className="text-[11px] font-normal text-[#9BA4C0] ml-0.5">{unit}</span>
        </p>
      </div>
    </div>
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
