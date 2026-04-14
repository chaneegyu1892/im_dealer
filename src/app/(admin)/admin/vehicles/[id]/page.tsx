"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Save, Trash2, ArrowLeft, Image as ImageIcon,
  Plus, Settings, Tag, Pencil, X
} from "lucide-react";
import { MOCK_VEHICLES } from "@/constants/mock-vehicles";
import type { MockVehicle } from "@/constants/mock-vehicles";
import { cn } from "@/lib/utils";

// 임시 타입 정의
type Trim = { id: string; name: string; price: number };
type Option = {
  id: string;
  name: string;
  price: number;
  applicableTrims: string[];
  requiresOptionId: string | null;
};

// 브랜드 목록
const MOCK_BRANDS = ["현대", "기아", "제네시스", "KGM", "BMW", "벤츠", "수입"];

export default function VehicleEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.id as string;
  
  const [vehicle, setVehicle] = useState<MockVehicle | null>(null);
  
  // 편집용 로컬 상태
  const [trims, setTrims] = useState<Trim[]>([]);
  const [options, setOptions] = useState<Option[]>([]);

  // 폼 입력 상태
  const [editData, setEditData] = useState({
    brand: "", name: "", basePrice: 0, shortDesc: ""
  });

  // 모달 상태
  const [trimModal, setTrimModal] = useState<{ isOpen: boolean; target: Trim | null }>({ isOpen: false, target: null });
  const [optionModal, setOptionModal] = useState<{ isOpen: boolean; target: Option | null }>({ isOpen: false, target: null });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 로컬 컴퓨터에서 이미지 파일 선택 시 미리보기 구현
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPreviewImage(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const found = MOCK_VEHICLES.find(v => v.slug === slug);
    if(found) {
      setVehicle(found);
      setEditData({
        brand: found.brand,
        name: found.name,
        basePrice: found.basePrice,
        shortDesc: found.shortDesc || ""
      });
      if (found.thumbnailUrl) {
         setPreviewImage(found.thumbnailUrl);
      }
      setTrims([
        { id: "t1", name: "기본형 (Standard)", price: found.basePrice },
        { id: "t2", name: "고급형 (Premium)", price: found.basePrice + 5000000 },
      ]);
      setOptions([
        { id: "o1", name: "파노라마 선루프", price: 1000000, applicableTrims: ["all"], requiresOptionId: null },
        { id: "o2", name: "빌트인 캠", price: 600000, applicableTrims: ["t2"], requiresOptionId: null },
        { id: "o3", name: "프리미엄 사운드 시스템", price: 800000, applicableTrims: ["all"], requiresOptionId: "o1" },
      ]);
    }
  }, [slug]);

  if(!vehicle) {
    return <div className="p-10 text-center text-[#9BA4C0]">차량 정보를 불러오는 중입니다...</div>;
  }

  // 차량 기본 정보 저장
  const handleSaveVehicle = () => {
    if (!vehicle) return;
    
    // MOCK_VEHICLES 객체 레퍼런스를 직접 변경 (SPA 내 유지되도록)
    vehicle.brand = editData.brand;
    vehicle.name = editData.name;
    vehicle.basePrice = editData.basePrice;
    vehicle.shortDesc = editData.shortDesc;
    if (previewImage) {
      vehicle.thumbnailUrl = previewImage;
    }
    
    alert("차량 정보가 성공적으로 변경되었습니다.");
    router.push('/admin/vehicles');
  };

  const handleSaveTrim = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const price = Number(fd.get("price"));

    if (trimModal.target) {
      setTrims(prev => prev.map(t => t.id === trimModal.target!.id ? { ...t, name, price } : t));
    } else {
      setTrims(prev => [...prev, { id: `t_${Date.now()}`, name, price }]);
    }
    setTrimModal({ isOpen: false, target: null });
  };

  const handleSaveOption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const price = Number(fd.get("price"));
    const requiresOptionId = fd.get("requiresOptionId") as string;
    const applicableTrims = fd.getAll("applicableTrims") as string[];

    const newOption: Option = {
      id: optionModal.target ? optionModal.target.id : `o_${Date.now()}`,
      name,
      price,
      applicableTrims: applicableTrims.includes("all") ? ["all"] : applicableTrims,
      requiresOptionId: requiresOptionId === "none" ? null : requiresOptionId
    };

    if (optionModal.target) {
      setOptions(prev => prev.map(o => o.id === optionModal.target!.id ? newOption : o));
    } else {
      setOptions(prev => [...prev, newOption]);
    }
    setOptionModal({ isOpen: false, target: null });
  };

  const deleteTrim = (id: string) => setTrims(prev => prev.filter(t => t.id !== id));
  const deleteOption = (id: string) => setOptions(prev => prev.filter(o => o.id !== id));

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
      {/* 최상단 네비게이션 및 액션 */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#6B7399]">
          <Link href="/admin/vehicles" className="hover:text-[#000666] flex items-center gap-1 transition-colors">
            <ArrowLeft size={13} /> 차량 목록
          </Link>
          <ChevronRight size={13} className="text-[#D0D5E8]" />
          <span className="text-[#1A1A2E]">{vehicle.brand}</span>
          <ChevronRight size={13} className="text-[#D0D5E8]" />
          <span className="text-[#1A1A2E]">{vehicle.name}</span>
          <ChevronRight size={13} className="text-[#D0D5E8]" />
          <span className="text-[#000666] font-bold">상세정보변경</span>
        </div>

        {/* 최상단 우측 통합 저장/취소 액션 */}
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-[6px] transition-colors" title="차량 삭제">
            <Trash2 size={15} />
          </button>
          <Link href="/admin/vehicles" className="px-4 py-2 text-[12px] font-medium text-[#4A5270] bg-[#F4F5F8] rounded-[6px] hover:bg-[#EAEDF5] transition-colors">
            취소 및 닫기
          </Link>
          <button onClick={handleSaveVehicle} className="flex items-center gap-1.5 bg-[#000666] text-white px-5 py-2 rounded-[6px] font-medium text-[12px] hover:opacity-90 transition-opacity">
            <Save size={14} /> 변경 내용 저장
          </button>
        </div>
      </div>

      {/* 내부 콘텐츠 래퍼 */}
      <div className="flex-1 p-5 min-h-0 flex flex-col gap-5">
        
        {/* ROW 1: 차량 기본 정보 (비율 1:1 반영) */}
        <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-6 flex gap-6 min-h-0" style={{ flex: '1' }}>
          {/* 썸네일 업로드 영역 */}
          <div className="w-[42%] h-full shrink-0 relative group">
            <input type="file" id="img-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
            <label htmlFor="img-upload" className="block w-full h-full rounded-[10px] border-2 border-dashed border-[#D0D5E8] flex flex-col items-center justify-center bg-[#FAFBFF] hover:bg-[#F4F5F8] cursor-pointer transition-colors overflow-hidden relative">
              {previewImage ? (
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImageIcon size={36} className="text-[#B0B8D0] group-hover:text-[#000666] transition-colors mb-2" />
                  <span className="text-[14px] font-medium text-[#6B7399] group-hover:text-[#000666]">PC에서 이미지 선택...</span>
                  <span className="text-[11px] text-[#9BA4C0] mt-1.5">PNG, JPG (최대 5MB)</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[13px] font-medium">사진 변경하기</span>
              </div>
            </label>
          </div>

          {/* 주요 입력 폼 영역 */}
          <div className="flex-1 flex flex-col pt-1 gap-5 pr-2 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">브랜드 선택</label>
                <select value={editData.brand} onChange={e=>setEditData(prev=>({...prev, brand: e.target.value}))} className="w-full px-4 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] cursor-pointer appearance-none transition-colors text-[#1A1A2E] font-medium">
                  {MOCK_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">시작 가격 (원)</label>
                <input type="number" value={editData.basePrice} onChange={e=>setEditData(prev=>({...prev, basePrice: Number(e.target.value)}))} className="w-full px-4 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] transition-colors font-bold text-[#000666]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">차량 모델명</label>
              <input type="text" value={editData.name} onChange={e=>setEditData(prev=>({...prev, name: e.target.value}))} className="w-full px-4 py-2.5 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] transition-colors font-bold text-[#1A1A2E]" />
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="block text-[11px] font-bold text-[#6B7399] uppercase tracking-wider flex items-center justify-between">
                <span>한줄 홍보 문구 (Short Description)</span>
                <span className="text-[10px] text-[#9BA4C0] lowercase normal-case font-normal">차량 목록에서 썸네일 아래 노출됨</span>
              </label>
              <textarea value={editData.shortDesc} onChange={e=>setEditData(prev=>({...prev, shortDesc: e.target.value}))} placeholder="실용성과 주행 감각의 완벽한 균형." className="w-full h-[60px] px-4 py-3 text-[13px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] transition-colors text-[#4A5270] resize-none" />
            </div>
          </div>
        </section>

        {/* ROW 2: 트림 관리 & 옵션 풀 관리 (비율 1:1) */}
        <div className="grid grid-cols-2 gap-5 min-h-0" style={{ flex: '1' }}>
          
          {/* [열 1] 트림 관리 */}
          <section className="bg-white rounded-[10px] border border-[#E8EAF0] flex flex-col min-h-0">
            <div className="px-5 py-3.5 border-b border-[#F0F2F8] bg-[#FAFBFF] flex items-center justify-between shrink-0 rounded-t-[10px]">
              <h2 className="text-[14px] font-bold text-[#1A1A2E] flex items-center gap-1.5">
                <Settings size={15} className="text-[#000666]" /> 트림 (Trim) 관리
              </h2>
              <button onClick={() => setTrimModal({ isOpen: true, target: null })} className="flex items-center gap-1 bg-white border border-[#E8EAF0] text-[#1A1A2E] text-[11px] font-medium px-2.5 py-1.5 rounded-[6px] hover:bg-[#F4F5F8] transition-colors shadow-sm">
                <Plus size={13} /> 트림 추가
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
              {trims.map((trim) => (
                <div key={trim.id} className="flex items-center justify-between px-4 py-3 border border-[#E8EAF0] rounded-[8px] bg-white hover:border-[#C0C5DC] transition-colors group shadow-sm">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-bold text-[#1A1A2E] truncate">{trim.name}</span>
                    <span className="text-[11px] text-[#000666] font-medium mt-0.5">{trim.price.toLocaleString()} 원</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setTrimModal({ isOpen: true, target: trim })} className="px-2 py-1 text-[11px] font-medium text-[#6B7399] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[4px] hover:text-[#000666]">수정</button>
                    <button onClick={() => deleteTrim(trim.id)} className="px-2 py-1 text-[11px] font-medium text-red-500 bg-red-50 border border-red-100 rounded-[4px] hover:bg-red-100">삭제</button>
                  </div>
                </div>
              ))}
              {trims.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9BA4C0]">등록된 트림이 없습니다.</div>}
            </div>
          </section>

          {/* [열 2] 옵션 풀 관리 */}
          <section className="bg-white rounded-[10px] border border-[#E8EAF0] flex flex-col min-h-0">
            <div className="px-5 py-3.5 border-b border-[#F0F2F8] bg-[#FAFBFF] flex items-center justify-between shrink-0 rounded-t-[10px]">
              <h2 className="text-[14px] font-bold text-[#1A1A2E] flex items-center gap-1.5">
                <Tag size={15} className="text-[#000666]" /> 옵션 풀 (Option Pool) 관리
              </h2>
              <button onClick={() => setOptionModal({ isOpen: true, target: null })} className="flex items-center gap-1 bg-[#000666] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-[6px] hover:opacity-90 transition-opacity shadow-sm">
                <Plus size={13} /> 옵션 추가
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
              {options.map((opt) => {
                const reqOption = options.find(o => o.id === opt.requiresOptionId);
                const isAllTrims = opt.applicableTrims.includes("all");
                return (
                  <div key={opt.id} className="flex flex-col p-3 border border-[#E8EAF0] rounded-[8px] hover:border-[#C0C5DC] transition-colors relative group shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[13px] font-bold text-[#1A1A2E]">{opt.name}</span>
                      <span className="text-[11px] font-medium text-[#4A5270]">{opt.price === 0 ? "무료" : `+${opt.price.toLocaleString()}원`}</span>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[#9BA4C0] w-10">적용범위</span>
                        <div className="flex-1">
                          {isAllTrims ? (
                            <span className="inline-block bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium">전체 (공통 옵션)</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {opt.applicableTrims.map(tid => {
                                const tName = trims.find(t=>t.id===tid)?.name;
                                return tName ? <span key={tid} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium">{tName}</span> : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {reqOption && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[#9BA4C0] w-10">필수조건</span>
                          <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-[4px] text-[10px] flex items-center gap-1 font-medium">
                            <ArrowLeft size={9} /> {reqOption.name}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* 호버 시 우측 상단 나타나는 액션 버튼 */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
                      <button onClick={() => setOptionModal({ isOpen: true, target: opt })} className="p-1.5 text-[#6B7399] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[4px] hover:text-[#000666]"><Pencil size={12} /></button>
                      <button onClick={() => deleteOption(opt.id)} className="p-1.5 text-red-500 bg-red-50 border border-red-100 rounded-[4px] hover:bg-red-100"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
              {options.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#9BA4C0]">등록된 옵션이 없습니다.</div>}
            </div>
          </section>
        </div>
      </div>

      {/* =======================
          모달들
      ======================== */}
      {/* 트림 에디터 */}
      <AnimatePresence>
        {trimModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTrimModal({ isOpen: false, target: null })} />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="relative bg-white rounded-[12px] w-[360px] p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-[#1A1A2E]">{trimModal.target ? "트림 수정" : "새 트림 추가"}</h3>
                <button type="button" onClick={() => setTrimModal({isOpen:false, target:null})} className="text-[#6B7399] hover:bg-[#F4F5F8] p-1 rounded"><X size={15}/></button>
              </div>
              <form onSubmit={handleSaveTrim} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5">트림 명칭</label>
                  <input name="name" defaultValue={trimModal.target?.name} className="w-full px-3 py-2.5 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] transition-colors" required placeholder="예: 시그니처" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5">트림 기본 가격 (원)</label>
                  <input name="price" type="number" defaultValue={trimModal.target?.price || vehicle.basePrice} className="w-full px-3 py-2.5 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] transition-colors" required />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setTrimModal({isOpen:false, target:null})} className="flex-1 py-2.5 bg-[#F4F5F8] text-[#4A5270] rounded-[6px] text-[12px] font-bold">취소</button>
                  <button type="submit" className="flex-1 py-2.5 bg-[#000666] text-white rounded-[6px] text-[12px] font-bold">{trimModal.target ? "수정완료" : "저장"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 옵션 에디터 */}
        {optionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOptionModal({ isOpen: false, target: null })} />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="relative bg-white rounded-[14px] w-[460px] max-h-[90vh] overflow-y-auto p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-[#1A1A2E]">{optionModal.target ? "옵션 수정" : "새 옵션 추가"}</h3>
                <button type="button" onClick={() => setOptionModal({isOpen:false, target:null})} className="text-[#6B7399] hover:bg-[#F4F5F8] p-1 rounded"><X size={15}/></button>
              </div>
              <form onSubmit={handleSaveOption} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5">옵션 명칭 또는 패키지명</label>
                    <input name="name" defaultValue={optionModal.target?.name} className="w-full px-3 py-2 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none" required placeholder="예: 무드램프 추가" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5">추가 옵션가 (원)</label>
                    <input name="price" type="number" defaultValue={optionModal.target?.price || 0} className="w-full px-3 py-2 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none" required />
                  </div>
                </div>

                <div className="border border-[#E8EAF0] rounded-[8px] p-4 bg-[#FAFBFF]">
                  <label className="block text-[11px] font-bold text-[#1A1A2E] mb-3">종속성 관리 (Dependency)</label>
                  
                  <div className="mb-4">
                    <label className="block text-[10px] font-medium text-[#6B7399] mb-1.5 tracking-wider">적용 가능한 트림 여부</label>
                    <div className="space-y-1.5 bg-white p-2 border border-[#E8EAF0] rounded-[6px]">
                      <label className="flex items-center gap-2 cursor-pointer pb-1 border-b border-[#F0F2F8]">
                        <input type="checkbox" name="applicableTrims" value="all" defaultChecked={!optionModal.target || optionModal.target.applicableTrims.includes("all")} className="w-3.5 h-3.5 text-[#000666] rounded" />
                        <span className="text-[12px] font-semibold text-[#1A1A2E]">전체 트림 지원 (공통 옵션)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {trims.map(t => (
                          <label key={t.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" name="applicableTrims" value={t.id} defaultChecked={optionModal.target?.applicableTrims.includes(t.id)} className="w-3 h-3 rounded border-[#C0C5DC]" />
                            <span className="text-[11px] text-[#4A5270] truncate">{t.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-[#6B7399] mb-1.5 tracking-wider">선행 필수 옵션</label>
                    <select name="requiresOptionId" defaultValue={optionModal.target?.requiresOptionId || "none"} className="w-full px-3 py-2 text-[12px] bg-white border border-[#E8EAF0] rounded-[6px] outline-none cursor-pointer">
                      <option value="none">없음 (단독 선택 가능)</option>
                      {options.filter(o => o.id !== optionModal.target?.id).map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setOptionModal({isOpen:false, target:null})} className="flex-1 py-2.5 bg-[#F4F5F8] text-[#4A5270] rounded-[6px] text-[12px] font-bold hover:bg-[#E8EAF0]">취소</button>
                  <button type="submit" className="flex-1 py-2.5 bg-[#000666] text-white rounded-[6px] text-[12px] font-bold hover:opacity-90">{optionModal.target ? "수정완료" : "옵션 등록"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
