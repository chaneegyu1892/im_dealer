"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Pencil, Trash2, X, AlertCircle, Car, ChevronRight, Tag, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_VEHICLES } from "@/constants/mock-vehicles";
import type { MockVehicle } from "@/constants/mock-vehicles";
import type { VehicleCategory, EngineType } from "@/types/vehicle";

// ─── 타입 ────────────────────────────────────────────────
interface VehicleRow extends MockVehicle {}

type Brand = { id: string; name: string; logoUrl?: string };
const INITIAL_BRANDS: Brand[] = [
  { id: "b1", name: "현대", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg" },
  { id: "b2", name: "기아", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/KIA_logo2.svg" },
  { id: "b3", name: "제네시스", logoUrl: "https://logo.clearbit.com/genesis.com" },
  { id: "b4", name: "KGM", logoUrl: "https://logo.clearbit.com/kg-mobility.com" },
  { id: "b5", name: "BMW", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg" },
  { id: "b6", name: "벤츠", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg" },
];

const ENGINE_COLORS: Record<EngineType, string> = {
  EV: "bg-blue-50 text-blue-600",
  하이브리드: "bg-emerald-50 text-emerald-600",
  가솔린: "bg-slate-50 text-slate-600",
  디젤: "bg-amber-50 text-amber-600",
};

// ─── 공통 모달 ───────────────────────────────────────────
function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass = "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

// ─── 메뉴얼 컴포넌트 ──────────────────────────────────────
export default function AdminVehiclesPage() {
  // 상태
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(INITIAL_BRANDS[0]);
  
  const [vehicles, setVehicles] = useState<VehicleRow[]>(MOCK_VEHICLES);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRow | null>(null);

  const [search, setSearch] = useState("");

  // 모달 상태
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null);
  const [brandModal, setBrandModal] = useState<{ isOpen: boolean; target: Brand | null }>({ isOpen: false, target: null });
  const [vehicleModal, setVehicleModal] = useState<{ isOpen: boolean; target: VehicleRow | null }>({ isOpen: false, target: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: "brand"|"vehicle"; id: string, name: string } | null>(null);

  const handleBrandLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => setBrandLogoPreview(evt.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 필터링 적용 차량
  const filteredVehicles = useMemo(() => {
    if (!selectedBrand) return [];
    let result = vehicles.filter(v => v.brand === selectedBrand.name);
    if (search) {
      result = result.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  }, [vehicles, selectedBrand, search]);

  // Handler: Brand
  const handleSaveBrand = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    if (!name.trim()) return;

    if (brandModal.target) {
      setBrands(prev => prev.map(b => b.id === brandModal.target!.id ? { ...b, name, logoUrl: brandLogoPreview || undefined } : b));
      // update vehicles brand name if needed (omitted for simplicity, but good practice)
      setVehicles(prev => prev.map(v => v.brand === brandModal.target!.name ? { ...v, brand: name } : v));
      if (selectedBrand?.id === brandModal.target.id) setSelectedBrand({ ...brandModal.target, name, logoUrl: brandLogoPreview || undefined });
    } else {
      const newBrand = { id: `b_${Date.now()}`, name, logoUrl: brandLogoPreview || undefined };
      setBrands(prev => [...prev, newBrand]);
      if (!selectedBrand) setSelectedBrand(newBrand);
    }
    setBrandModal({ isOpen: false, target: null });
    setBrandLogoPreview(null);
  };

  // Handler: Vehicle
  const handleSaveVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const category = fd.get("category") as VehicleCategory;
    const engineType = fd.get("engineType") as EngineType;
    const basePrice = Number(fd.get("basePrice")) * 10000;
    const monthlyFrom = Number(fd.get("monthlyFrom")) * 10000;
    
    if (!name.trim() || !selectedBrand) return;

    if (vehicleModal.target) {
      const updated = {
        ...vehicleModal.target,
        name, category, engineType, basePrice, monthlyFrom
      };
      setVehicles(prev => prev.map(v => v.id === vehicleModal.target!.id ? updated : v));
      if (selectedVehicle?.id === vehicleModal.target.id) setSelectedVehicle(updated);
    } else {
      const newVeh: VehicleRow = {
        id: `v_${Date.now()}`,
        slug: `v-${Date.now()}`,
        name,
        brand: selectedBrand.name,
        category,
        engineType,
        basePrice,
        monthlyFrom,
        thumbnailUrl: "",
        isPopular: false,
        isFeatured: false,
        tags: [],
        shortDesc: "정보 업로드 대기중",
        brandColor: "linear-gradient(145deg, #1A1A2E 0%, #4A5270 100%)",
        keySpecs: []
      };
      setVehicles(prev => [...prev, newVeh]);
    }
    setVehicleModal({ isOpen: false, target: null });
  };

  // Handler: Delete
  const handleDelete = () => {
    if(!deleteModal) return;
    if(deleteModal.type === "brand") {
      setBrands(prev => prev.filter(b => b.id !== deleteModal.id));
      if(selectedBrand?.id === deleteModal.id) {
        setSelectedBrand(null);
        setSelectedVehicle(null);
      }
    } else {
      setVehicles(prev => prev.filter(v => v.id !== deleteModal.id));
      if(selectedVehicle?.id === deleteModal.id) {
        setSelectedVehicle(null);
      }
    }
    setDeleteModal(null);
  };

  return (
    <div className="p-5 h-[calc(100vh-32px)]">
      <div className="bg-white rounded-[16px] border border-[#E8EAF0] flex h-full overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        
        {/* =======================
            [Column 1] 브랜드 목록
        ======================== */}
        <div className="w-[280px] border-r border-[#E8EAF0] flex flex-col shrink-0 bg-[#FAFBFF]">
          <div className="p-4 border-b border-[#E8EAF0] flex items-center justify-between bg-white z-10">
            <h2 className="text-[14px] font-semibold text-[#1A1A2E]">차량 브랜드</h2>
            <button onClick={() => { setBrandModal({ isOpen: true, target: null }); setBrandLogoPreview(null); }} className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#F0F2F8] text-[#6B7399] transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {brands.map(b => {
              const isSelected = selectedBrand?.id === b.id;
              return (
                <div key={b.id}
                  onClick={() => {
                    setSelectedBrand(b);
                    setSelectedVehicle(null);
                  }}
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors border",
                    isSelected 
                      ? "bg-white border-[#000666] shadow-sm" 
                      : "border-transparent hover:bg-white hover:border-[#E8EAF0]"
                  )}>
                  <div className="flex items-center gap-2">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="w-5 h-5 object-contain" />
                    ) : (
                      <div className="w-5 h-5 bg-[#E8EAF0] rounded-full flex items-center justify-center text-[9px] font-bold text-[#6B7399] tracking-tighter shrink-0 border border-[#D0D5E8]">
                        {b.name.substring(0, 2)}
                      </div>
                    )}
                    <span className={cn("text-[13px] font-medium", isSelected ? "text-[#000666]" : "text-[#4A5270] group-hover:text-[#1A1A2E]")}>
                      {b.name}
                    </span>
                  </div>
                  
                  {/* 호버 시 액션 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setBrandModal({isOpen: true, target: b}); setBrandLogoPreview(b.logoUrl || null); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666]">
                      <Pencil size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteModal({type:"brand", id:b.id, name:b.name}); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {brands.length === 0 && <p className="text-[12px] text-center text-[#9BA4C0] mt-10">등록된 브랜드가 없습니다</p>}
          </div>
        </div>

        {/* =======================
            [Column 2] 차량 목록
        ======================== */}
        <div className="w-[360px] border-r border-[#E8EAF0] flex flex-col shrink-0 bg-white">
          <div className="p-4 border-b border-[#E8EAF0] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#1A1A2E] flex items-center gap-1.5">
                {selectedBrand ? selectedBrand.name : "브랜드 선택"}
                <span className="text-[12px] font-normal text-[#9BA4C0] px-1.5 py-0.5 bg-[#F4F5F8] rounded-[4px]">{filteredVehicles.length}</span>
              </h2>
              <button disabled={!selectedBrand} onClick={() => setVehicleModal({ isOpen: true, target: null })} className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#F0F2F8] text-[#000666] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <Plus size={15} />
              </button>
            </div>
            
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8D0]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="차량명 검색"
                disabled={!selectedBrand}
                className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] disabled:opacity-50 transition-colors placeholder:text-[#B0B8D0]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#F8F9FC]/50">
            {!selectedBrand ? (
              <div className="h-full flex flex-col items-center justify-center text-[#9BA4C0] space-y-2">
                <Car size={32} strokeWidth={1} />
                <p className="text-[12px]">왼쪽에서 브랜드를 선택해주세요</p>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <p className="text-[12px] text-center text-[#9BA4C0] mt-10">차량 데이터가 없습니다</p>
            ) : (
              filteredVehicles.map(v => {
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <div key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={cn(
                      "group flex flex-col p-3 rounded-[8px] cursor-pointer transition-all border",
                      isSelected
                        ? "bg-white border-[#000666] shadow-sm transform scale-[1.01]"
                        : "bg-white border-[#E8EAF0] hover:border-[#C0C5DC]"
                    )}>
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]", ENGINE_COLORS[v.engineType])}>
                            {v.engineType}
                          </span>
                          <span className="text-[10px] text-[#6B7399] border border-[#E8EAF0] px-1.5 py-0.5 rounded-[4px]">
                            {v.category}
                          </span>
                        </div>
                        <h3 className="text-[14px] font-bold text-[#1A1A2E] truncate">{v.name}</h3>
                        <p className="text-[12px] font-medium text-[#4A5270] mt-1">시작가 <span className="text-[#000666]">{Math.round(v.monthlyFrom/10000).toLocaleString()}만원대</span></p>
                      </div>
                      
                      {/* 액션 */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setVehicleModal({isOpen: true, target: v}); }} className="p-1.5 rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666]">
                          <Pencil size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteModal({type:"vehicle", id:v.id, name:v.name}); }} className="p-1.5 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* =======================
            [Column 3] 상세 정보
        ======================== */}
        <div className="flex-1 bg-[#F8F9FC] flex flex-col relative overflow-hidden">
          {!selectedVehicle ? (
             <div className="h-full flex flex-col items-center justify-center text-[#9BA4C0] gap-3">
               <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                 <Car size={32} className="text-[#D0D5E8]" strokeWidth={1.5} />
               </div>
               <p className="text-[13px] font-medium text-[#6B7399]">차량을 선택하면 상세 정보가 표시됩니다</p>
             </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {/* 상단 썸네일 영역 */}
                <div className="h-[280px] w-full relative flex items-end p-8 overflow-hidden" style={{ background: selectedVehicle.brandColor }}>
                  {/* 선택된 차량 이미지가 존재할 경우 뒷배경을 해당 이미지로 렌더링 */}
                  {selectedVehicle.thumbnailUrl && (
                    <img src={selectedVehicle.thumbnailUrl} alt={selectedVehicle.name} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="relative z-10 text-white w-full">
                    <span className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-medium mb-3">
                      {selectedVehicle.brand}
                    </span>
                    <h1 className="text-[32px] font-bold leading-tight">{selectedVehicle.name}</h1>
                    <p className="text-white/80 text-[14px] mt-1 break-keep">{selectedVehicle.shortDesc || "등록된 한줄 설명이 없습니다."}</p>
                  </div>
                </div>

                {/* 하단 텍스트 정보 */}
                <div className="p-8 max-w-[800px] mx-auto space-y-8">
                  
                  {/* 스펙 하이라이트 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
                      <p className="text-[11px] text-[#6B7399] font-medium mb-1">카테고리</p>
                      <p className="text-[15px] font-semibold text-[#1A1A2E]">{selectedVehicle.category}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
                      <p className="text-[11px] text-[#6B7399] font-medium mb-1">파워트레인</p>
                      <p className="text-[15px] font-semibold text-[#1A1A2E]">{selectedVehicle.engineType}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
                      <p className="text-[11px] text-[#6B7399] font-medium mb-1">월 최저 납입금</p>
                      <p className="text-[15px] font-semibold text-[#000666]">약 {Math.round((selectedVehicle.monthlyFrom || 0)/10000)}만원</p>
                    </div>
                  </div>

                  {/* 주요 옵션/스펙 */}
                  <div>
                    <h3 className="text-[14px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-2">
                      <Tag size={16} className="text-[#000666]" /> 핵심 스펙 (Key Specs)
                    </h3>
                    <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden shadow-sm">
                      {selectedVehicle.keySpecs && selectedVehicle.keySpecs.length > 0 ? selectedVehicle.keySpecs.map((spec, i) => (
                        <div key={i} className="flex px-4 py-3 border-b border-[#F0F2F8] last:border-0">
                          <span className="w-1/3 text-[12px] font-medium text-[#6B7399]">{spec.label}</span>
                          <span className="w-2/3 text-[13px] text-[#1A1A2E]">{spec.value}</span>
                        </div>
                      )) : (
                        <div className="px-4 py-8 text-center text-[13px] text-[#9BA4C0]">등록된 핵심 스펙이 없습니다.</div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* 최하단 수정 버튼 영역 */}
              <div className="bg-white border-t border-[#E8EAF0] p-4 flex justify-end px-8 shrink-0">
                <Link href={`/admin/vehicles/${selectedVehicle.slug}`} className="flex items-center gap-2 bg-[#000666] text-white px-6 py-3 rounded-[8px] font-medium text-[13px] hover:bg-[#1A1A6E] transition-colors shadow-md">
                  <Settings size={16} /> 상세 정보 변경 (트림·이미지 편집) <ChevronRight size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =======================
          모달 섹션
      ======================== */}
      {brandModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBrandModal({ isOpen: false, target: null })} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white rounded-[12px] w-[360px] p-6 shadow-xl">
            <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-4">{brandModal.target ? "브랜드 수정" : "브랜드 추가"}</h3>
            <form onSubmit={handleSaveBrand} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-[60px] h-[60px] shrink-0 relative group">
                  <input type="file" id="brand-logo-upload" className="hidden" accept="image/*" onChange={handleBrandLogoUpload} />
                  <label htmlFor="brand-logo-upload" className="block w-full h-full rounded-full border border-[#D0D5E8] flex flex-col items-center justify-center bg-[#FAFBFF] hover:bg-[#F4F5F8] cursor-pointer transition-colors overflow-hidden relative shadow-sm">
                    {brandLogoPreview ? (
                      <img src={brandLogoPreview} alt="로고 미리보기" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-[#6B7399] font-medium text-center leading-tight">로고<br/>업로드</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil size={12} className="text-white" />
                    </div>
                  </label>
                </div>
                <div className="flex-1">
                  <FormField label="브랜드명" required>
                    <input name="name" defaultValue={brandModal.target?.name} className={inputClass} placeholder="예: 현대" autoFocus />
                  </FormField>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setBrandModal({isOpen:false, target:null})} className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium">취소</button>
                <button type="submit" className="flex-1 py-2 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium">{brandModal.target ? "저장" : "추가"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {vehicleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setVehicleModal({ isOpen: false, target: null })} />
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white rounded-[14px] w-[460px] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-5">{vehicleModal.target ? "차량 기본 정보 변경" : "차량 등록 (기본 정보)"}</h3>
            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <FormField label="브랜드">
                <input value={selectedBrand?.name} disabled className={cn(inputClass, "opacity-70")} />
              </FormField>
              <FormField label="차량명" required>
                <input name="name" defaultValue={vehicleModal.target?.name} className={inputClass} placeholder="예: 쏘렌토" autoFocus />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="분류">
                  <select name="category" defaultValue={vehicleModal.target?.category || "SUV"} className={selectClass}>
                    {["세단", "SUV", "밴", "트럭"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="엔진 타입">
                  <select name="engineType" defaultValue={vehicleModal.target?.engineType || "가솔린"} className={selectClass}>
                    {["가솔린", "디젤", "하이브리드", "EV"].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="기준 가격 (만원)" required>
                  <input name="basePrice" type="number" defaultValue={vehicleModal.target ? vehicleModal.target.basePrice/10000 : ""} className={inputClass} placeholder="예: 3500" />
                </FormField>
                <FormField label="최저 월 납입금 (만원)" required>
                  <input name="monthlyFrom" type="number" defaultValue={vehicleModal.target ? vehicleModal.target.monthlyFrom/10000 : ""} className={inputClass} placeholder="예: 56" />
                </FormField>
              </div>
              <p className="text-[11px] text-[#9BA4C0] pt-2 flex items-start gap-1"><AlertCircle size={12} className="mt-[2px]" /> 상세 정보 및 이미지는 생성 후 우측 하단 &apos;상세 정보 변경&apos; 버튼을 통해 할 수 있습니다.</p>
              
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setVehicleModal({isOpen:false, target:null})} className="flex-1 py-2.5 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium hover:bg-[#EAEDF5]">취소</button>
                <button type="submit" className="flex-1 py-2.5 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium hover:opacity-90">{vehicleModal.target ? "저장" : "추가"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteModal(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white rounded-[12px] p-6 w-[340px] shadow-xl">
            <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-2">{deleteModal.type === "brand" ? "브랜드 삭제" : "차량 삭제"}</h3>
            <p className="text-[13px] text-[#6B7399] mb-5">
              <strong className="text-[#1A1A2E]">{deleteModal.name}</strong>을(를) 삭제하시겠습니까? 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium">취소</button>
              <button onClick={handleDelete} className="flex-1 py-2 rounded-[6px] bg-red-600 text-white text-[13px] font-medium">삭제</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
