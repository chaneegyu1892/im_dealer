"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X, Tag, Zap, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicleDetail, AdminTrim } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

/** 할인 금액(discountAmount)을 기준으로 할인율 계산 */
function calcDiscountRate(price: number, discountAmount: number): number {
  if (!price || !discountAmount || discountAmount <= 0 || discountAmount >= price) return 0;
  return Math.round((discountAmount / price) * 100);
}

interface TrimTabProps {
  vehicle: AdminVehicleDetail;
}

export function TrimTab({ vehicle }: TrimTabProps) {
  const router = useRouter();
  const [selectedLineupId, setSelectedLineupId] = useState<string>(
    vehicle.lineups[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [trimModal, setTrimModal] = useState<{ isOpen: boolean; target: AdminTrim | null }>(
    { isOpen: false, target: null }
  );

  // 다중 선택 모드 — 일괄 할인 / 일괄 보조금 공용
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // 현재 일괄 작업 대상: 할인 or 보조금(견적 미반영)
  const [bulkTarget, setBulkTarget] = useState<"discount" | "subsidy">("discount");
  const [selectedTrimIds, setSelectedTrimIds] = useState<Set<string>>(new Set());
  const [bulkDiscountInput, setBulkDiscountInput] = useState("");
  const [bulkRateInput, setBulkRateInput] = useState("");
  const [bulkDiscountMode, setBulkDiscountMode] = useState<"amount" | "rate">("amount");
  const [bulkSubsidyInput, setBulkSubsidyInput] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // 개별 트림 모달 할인 입력
  const [modalDiscountInput, setModalDiscountInput] = useState("");
  const [modalRateInput, setModalRateInput] = useState("");
  const [modalDiscountMode, setModalDiscountMode] = useState<"amount" | "rate">("amount");
  const [modalPriceInput, setModalPriceInput] = useState("");
  // 전기차 보조금(만원) — 견적 미반영, 안내 표기 전용
  const [modalSubsidyInput, setModalSubsidyInput] = useState("");

  const filteredTrims = useMemo(() => {
    return vehicle.trims.filter((t) => t.lineupId === selectedLineupId);
  }, [vehicle.trims, selectedLineupId]);

  const selectedLineup = vehicle.lineups.find(l => l.id === selectedLineupId);

  const openModal = (trim: AdminTrim | null) => {
    setTrimModal({ isOpen: true, target: trim });
    setModalDiscountMode("amount");
    setModalRateInput("");
    // 기존 discountPrice가 있으면 "할인 금액 = 원가 - 할인가"로 역산해서 초기화
    setModalDiscountInput(
      trim?.discountPrice && trim?.price && trim.discountPrice < trim.price
        ? String((trim.price - trim.discountPrice) / 10000)
        : ""
    );
    setModalPriceInput(
      trim?.price ? String(trim.price / 10000) : ""
    );
    setModalSubsidyInput(
      trim?.evSubsidy != null ? String(trim.evSubsidy / 10000) : ""
    );
  };

  const closeModal = () => {
    setTrimModal({ isOpen: false, target: null });
    setModalDiscountInput("");
    setModalRateInput("");
    setModalDiscountMode("amount");
    setModalPriceInput("");
    setModalSubsidyInput("");
  };

  /** 모달 입력 모드 전환 — 기존 값을 자동 변환 */
  const switchModalMode = (mode: "amount" | "rate") => {
    if (mode === modalDiscountMode) return;
    const price = Number(modalPriceInput) * 10000;
    if (mode === "rate" && modalDiscountInput && price > 0) {
      const amt = Number(modalDiscountInput) * 10000;
      const rate = Math.round((amt / price) * 100);
      setModalRateInput(rate > 0 ? String(rate) : "");
    } else if (mode === "amount" && modalRateInput && price > 0) {
      const rate = Number(modalRateInput);
      const amt = Math.round((price * rate) / 100) / 10000;
      setModalDiscountInput(amt > 0 ? String(amt) : "");
    }
    setModalDiscountMode(mode);
  };

  const handleSaveTrim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const priceWon = Number(modalPriceInput) * 10000;
    // 입력 모드에 따라 최종 할인 금액 계산
    let discountAmountWon = 0;
    if (modalDiscountMode === "amount") {
      discountAmountWon = Number(modalDiscountInput) > 0 ? Number(modalDiscountInput) * 10000 : 0;
    } else {
      const rate = Number(modalRateInput);
      discountAmountWon = rate > 0 && priceWon > 0 ? Math.round(priceWon * rate / 100) : 0;
    }
    // DB에는 최종 할인가(discountPrice) 저장 = 원가 - 할인 금액
    const discountPrice =
      discountAmountWon > 0 && discountAmountWon < priceWon
        ? priceWon - discountAmountWon
        : null;

    const payload = {
      name: fd.get("name") as string,
      price: priceWon,
      discountPrice,
      evSubsidy:
        modalSubsidyInput.trim() === ""
          ? null
          : Math.round(Number(modalSubsidyInput) * 10000),
      engineType: fd.get("engineType") as string,
      isDefault: fd.get("isDefault") === "on",
      lineupId: selectedLineupId,
      fuelEfficiency: fd.get("fuelEfficiency") ? Number(fd.get("fuelEfficiency")) : null,
    };

    try {
      const url = trimModal.target
        ? `/api/admin/vehicles/${vehicle.id}/trims/${trimModal.target.id}`
        : `/api/admin/vehicles/${vehicle.id}/trims`;
      const method = trimModal.target ? "PATCH" : "POST";

      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        alert("저장 중 오류가 발생했습니다.");
        return;
      }
      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 트림을 삭제하시겠습니까?")) return;
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicle.id}/trims/${id}`, { method: "DELETE" });
      if (!resp.ok) {
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const toggleTrimSelect = (id: string) => {
    setSelectedTrimIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllTrims = () => {
    if (selectedTrimIds.size === filteredTrims.length) {
      setSelectedTrimIds(new Set());
    } else {
      setSelectedTrimIds(new Set(filteredTrims.map(t => t.id)));
    }
  };

  const exitMultiSelectMode = () => {
    setMultiSelectMode(false);
    setSelectedTrimIds(new Set());
    setBulkDiscountInput("");
    setBulkRateInput("");
    setBulkDiscountMode("amount");
    setBulkSubsidyInput("");
  };

  /** 다중 선택 모드 진입/토글 — target(할인/보조금)별로 동작 */
  const toggleMultiSelect = (target: "discount" | "subsidy") => {
    if (multiSelectMode && bulkTarget === target) {
      exitMultiSelectMode();
    } else {
      exitMultiSelectMode();
      setBulkTarget(target);
      setMultiSelectMode(true);
    }
  };

  /** 일괄 할인 입력 모드 전환 — 기존 값을 자동 변환 */
  const switchBulkMode = (mode: "amount" | "rate") => {
    if (mode === bulkDiscountMode) return;
    // 변환 기준: 선택된 트림이 1개면 해당 가격, 여러 개면 평균 가격 사용
    const refPrice = selectedTrims.length === 1
      ? selectedTrims[0].price
      : avgPrice;
    if (mode === "rate" && bulkDiscountInput && refPrice > 0) {
      const amt = Number(bulkDiscountInput) * 10000;
      const rate = Math.round((amt / refPrice) * 100);
      setBulkRateInput(rate > 0 ? String(rate) : "");
    } else if (mode === "amount" && bulkRateInput && refPrice > 0) {
      const rate = Number(bulkRateInput);
      const amt = Math.round((refPrice * rate) / 100) / 10000;
      setBulkDiscountInput(amt > 0 ? String(amt) : "");
    }
    setBulkDiscountMode(mode);
  };

  const handleBulkDiscount = async () => {
    if (bulkSaving || selectedTrimIds.size === 0) return;
    setBulkSaving(true);

    // 모드에 따라 payload 구성
    let bulkPayload: Record<string, unknown>;
    if (bulkDiscountMode === "amount") {
      const raw = Number(bulkDiscountInput);
      bulkPayload = { trimIds: Array.from(selectedTrimIds), discountAmount: raw > 0 ? raw * 10000 : null };
    } else {
      const rate = Number(bulkRateInput);
      bulkPayload = { trimIds: Array.from(selectedTrimIds), discountRate: rate > 0 ? rate : null };
    }

    try {
      const resp = await fetch(
        `/api/admin/vehicles/${vehicle.id}/trims/bulk-discount`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bulkPayload),
        }
      );
      if (!resp.ok) {
        alert("적용 중 오류가 발생했습니다.");
        return;
      }
      exitMultiSelectMode();
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("적용 중 오류가 발생했습니다.");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkSubsidy = async () => {
    if (bulkSaving || selectedTrimIds.size === 0) return;
    setBulkSaving(true);

    // 빈칸 = 보조금 해제(null), 값 입력 시 만원 → 원 변환
    const raw = bulkSubsidyInput.trim();
    const evSubsidy = raw === "" ? null : Math.round(Number(raw) * 10000);

    try {
      const resp = await fetch(
        `/api/admin/vehicles/${vehicle.id}/trims/bulk-subsidy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trimIds: Array.from(selectedTrimIds), evSubsidy }),
        }
      );
      if (!resp.ok) {
        alert("적용 중 오류가 발생했습니다.");
        return;
      }
      exitMultiSelectMode();
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("적용 중 오류가 발생했습니다.");
    } finally {
      setBulkSaving(false);
    }
  };

  // ── 모달 실시간 계산 ──────────────────────────────
  const modalPrice = Number(modalPriceInput) * 10000;

  // 입력 모드에 따라 할인 금액 / 할인율 계산
  const modalDiscountAmount: number = (() => {
    if (modalDiscountMode === "amount") {
      return Number(modalDiscountInput) > 0 ? Number(modalDiscountInput) * 10000 : 0;
    }
    const rate = Number(modalRateInput);
    return rate > 0 && modalPrice > 0 ? Math.round(modalPrice * rate / 100) : 0;
  })();
  const modalDiscountRate: number = (() => {
    if (modalDiscountMode === "rate") return Number(modalRateInput) || 0;
    return calcDiscountRate(modalPrice, modalDiscountAmount);
  })();
  const modalResultPrice = modalDiscountAmount > 0 && modalDiscountAmount < modalPrice
    ? modalPrice - modalDiscountAmount
    : 0;

  // ── 일괄 할인 패널 계산 ───────────────────────────
  const selectedTrims = filteredTrims.filter(t => selectedTrimIds.has(t.id));
  const avgPrice = selectedTrims.length
    ? selectedTrims.reduce((s, t) => s + t.price, 0) / selectedTrims.length
    : 0;
  const minPrice = selectedTrims.length
    ? Math.min(...selectedTrims.map(t => t.price))
    : 0;

  const bulkDiscountAmount: number = (() => {
    if (bulkDiscountMode === "amount") {
      return Number(bulkDiscountInput) > 0 ? Number(bulkDiscountInput) * 10000 : 0;
    }
    const rate = Number(bulkRateInput);
    return rate > 0 && avgPrice > 0 ? Math.round(avgPrice * rate / 100) : 0;
  })();
  const bulkDiscountRate: number = (() => {
    if (bulkDiscountMode === "rate") return Number(bulkRateInput) || 0;
    return calcDiscountRate(avgPrice, bulkDiscountAmount);
  })();
  const isBulkDiscountTooLarge =
    bulkDiscountMode === "amount"
      ? bulkDiscountAmount > 0 && minPrice > 0 && bulkDiscountAmount >= minPrice
      : Number(bulkRateInput) >= 100;
  const isBulkInputEmpty = bulkDiscountMode === "amount" ? !bulkDiscountInput : !bulkRateInput;

  return (
    <div className="space-y-6">
      {/* 라인업 선택 */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
        <span className="text-[13px] font-bold text-[#4A5270] shrink-0">라인업 선택:</span>
        <div className="flex flex-wrap gap-2">
          {vehicle.lineups.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLineupId(l.id);
                exitMultiSelectMode();
              }}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-medium transition-all flex items-center gap-2",
                selectedLineupId === l.id
                  ? "bg-[#000666] text-white shadow-md shadow-indigo-100"
                  : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0] hover:bg-[#F0F2F8]"
              )}
            >
              {selectedLineupId === l.id && <Check size={14} />}
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {!selectedLineupId ? (
        <div className="p-12 text-center bg-white rounded-[12px] border border-dashed border-[#E8EAF0]">
          <p className="text-[#9BA4C0] text-[14px]">라인업을 먼저 등록해주세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-bold text-[#1A1A2E]">
              {selectedLineup?.name} {" > "} 트림 리스트 ({filteredTrims.length})
            </h3>
            <div className="flex items-center gap-2">
              {filteredTrims.length > 0 && (
                <>
                  <button
                    onClick={() => toggleMultiSelect("discount")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-medium border transition-colors",
                      multiSelectMode && bulkTarget === "discount"
                        ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                        : "bg-white border-[#E8EAF0] text-[#6B7399] hover:bg-[#F0F2F8]"
                    )}
                  >
                    <Tag size={14} />
                    {multiSelectMode && bulkTarget === "discount" ? "선택 취소" : "일괄 할인"}
                  </button>
                  <button
                    onClick={() => toggleMultiSelect("subsidy")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-medium border transition-colors",
                      multiSelectMode && bulkTarget === "subsidy"
                        ? "bg-[#EEF0FF] border-[#000666]/30 text-[#000666] hover:bg-[#E5E8FF]"
                        : "bg-white border-[#E8EAF0] text-[#6B7399] hover:bg-[#F0F2F8]"
                    )}
                  >
                    <Zap size={14} />
                    {multiSelectMode && bulkTarget === "subsidy" ? "선택 취소" : "일괄 보조금"}
                  </button>
                </>
              )}
              <button
                onClick={() => openModal(null)}
                className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
              >
                <Plus size={16} /> 트림 추가
              </button>
            </div>
          </div>

          {/* 일괄 할인 패널 */}
          <AnimatePresence>
            {multiSelectMode && bulkTarget === "discount" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleAllTrims}
                        className="flex items-center gap-1.5 text-[13px] text-amber-700 font-medium hover:text-amber-900"
                      >
                        {selectedTrimIds.size === filteredTrims.length && filteredTrims.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />
                        }
                        전체 선택
                      </button>
                      <span className="text-[12px] text-amber-600">
                        {selectedTrimIds.size}개 선택됨
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      {/* 입력 모드 토글 */}
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                          일괄 할인 설정
                        </label>
                        <div className="flex rounded-[6px] overflow-hidden border border-amber-300 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => switchBulkMode("amount")}
                            className={cn(
                              "px-3 py-1 transition-colors",
                              bulkDiscountMode === "amount"
                                ? "bg-amber-500 text-white"
                                : "bg-white text-amber-600 hover:bg-amber-50"
                            )}
                          >
                            금액 (만원)
                          </button>
                          <button
                            type="button"
                            onClick={() => switchBulkMode("rate")}
                            className={cn(
                              "px-3 py-1 transition-colors",
                              bulkDiscountMode === "rate"
                                ? "bg-amber-500 text-white"
                                : "bg-white text-amber-600 hover:bg-amber-50"
                            )}
                          >
                            할인율 (%)
                          </button>
                        </div>
                      </div>

                      {/* 입력 필드 */}
                      <div className="relative">
                        {bulkDiscountMode === "amount" ? (
                          <>
                            <input
                              type="number"
                              value={bulkDiscountInput}
                              onChange={e => setBulkDiscountInput(e.target.value)}
                              placeholder="빈칸 = 할인 없음"
                              className={cn(
                                "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-white border rounded-[6px] outline-none transition-colors placeholder:text-[#B0B8D0]",
                                isBulkDiscountTooLarge
                                  ? "border-red-400 focus:border-red-500"
                                  : "border-amber-300 focus:border-amber-500"
                              )}
                            />
                            {bulkDiscountRate > 0 && !isBulkDiscountTooLarge && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                                -{bulkDiscountRate}%
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={bulkRateInput}
                              onChange={e => setBulkRateInput(e.target.value)}
                              placeholder="빈칸 = 할인 없음"
                              className={cn(
                                "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-white border rounded-[6px] outline-none transition-colors placeholder:text-[#B0B8D0]",
                                isBulkDiscountTooLarge
                                  ? "border-red-400 focus:border-red-500"
                                  : "border-amber-300 focus:border-amber-500"
                              )}
                            />
                            {bulkDiscountAmount > 0 && !isBulkDiscountTooLarge && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                                -{formatKRWMan(bulkDiscountAmount)}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* 안내 문구 */}
                      {isBulkDiscountTooLarge ? (
                        <p className="text-[11px] text-red-500">
                          {bulkDiscountMode === "amount"
                            ? `할인 금액이 최저 트림가(${formatKRWMan(minPrice)})보다 크거나 같습니다.`
                            : "할인율은 0~99% 사이여야 합니다."}
                        </p>
                      ) : (bulkDiscountAmount > 0 || (bulkDiscountMode === "rate" && Number(bulkRateInput) > 0)) && selectedTrims.length > 0 ? (
                        <p className="text-[11px] text-emerald-600">
                          {selectedTrims.length === 1
                            ? `${formatKRWMan(selectedTrims[0].price)} → ${formatKRWMan(
                                bulkDiscountMode === "rate"
                                  ? Math.round(selectedTrims[0].price * (1 - Number(bulkRateInput) / 100))
                                  : selectedTrims[0].price - bulkDiscountAmount
                              )} (-${bulkDiscountMode === "rate" ? bulkRateInput : bulkDiscountRate}%)`
                            : bulkDiscountMode === "amount"
                            ? `각 트림에서 ${formatKRWMan(bulkDiscountAmount)} 차감 (평균 기준 -${bulkDiscountRate}%)`
                            : `각 트림에서 ${bulkRateInput}% 할인 (평균 기준 -${formatKRWMan(bulkDiscountAmount)})`}
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-500">
                          {selectedTrims.length === 0 ? "트림을 선택하세요" : "할인 값을 입력하면 트림별 결과가 표시됩니다"}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleBulkDiscount}
                      disabled={bulkSaving || selectedTrimIds.size === 0 || isBulkDiscountTooLarge || isBulkInputEmpty}
                      className="px-5 py-2 bg-amber-500 text-white rounded-[8px] text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {bulkSaving ? "적용 중..." : "선택 트림에 적용"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 일괄 보조금 패널 — 견적 미반영, 안내 표기 전용 */}
            {multiSelectMode && bulkTarget === "subsidy" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#EEF0FF] border border-[#000666]/15 rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleAllTrims}
                        className="flex items-center gap-1.5 text-[13px] text-[#000666] font-medium hover:text-[#1A1A6E]"
                      >
                        {selectedTrimIds.size === filteredTrims.length && filteredTrims.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />
                        }
                        전체 선택
                      </button>
                      <span className="text-[12px] text-[#6066EE]">
                        {selectedTrimIds.size}개 선택됨
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-bold text-[#000666] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <Zap size={11} />
                        일괄 전기차 보조금 (만원)
                        <span className="text-[10px] font-normal text-[#9BA4C0] normal-case tracking-normal">· 견적 미반영 · 빈칸 = 해제</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bulkSubsidyInput}
                        onChange={e => setBulkSubsidyInput(e.target.value)}
                        placeholder="예: 400 (빈칸 적용 시 보조금 해제)"
                        className="w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-white border border-[#000666]/20 rounded-[6px] outline-none focus:border-[#000666] transition-colors placeholder:text-[#B0B8D0]"
                      />
                      {selectedTrims.length === 0 ? (
                        <p className="text-[11px] text-[#6066EE]">트림을 선택하세요</p>
                      ) : bulkSubsidyInput.trim() === "" ? (
                        <p className="text-[11px] text-[#6066EE]">선택한 {selectedTrims.length}개 트림의 보조금을 해제합니다</p>
                      ) : (
                        <p className="text-[11px] text-[#000666]">선택한 {selectedTrims.length}개 트림에 보조금 {Number(bulkSubsidyInput).toLocaleString()}만원 적용</p>
                      )}
                    </div>
                    <button
                      onClick={handleBulkSubsidy}
                      disabled={bulkSaving || selectedTrimIds.size === 0}
                      className="px-5 py-2 bg-[#000666] text-white rounded-[8px] text-[13px] font-bold hover:bg-[#1A1A6E] disabled:opacity-40 transition-colors shrink-0"
                    >
                      {bulkSaving ? "적용 중..." : "선택 트림에 적용"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTrims.map((trim) => {
              const trimDiscountAmount = trim.discountPrice ? trim.price - trim.discountPrice : 0;
              const discountRate = calcDiscountRate(trim.price, trimDiscountAmount);
              const isSelected = selectedTrimIds.has(trim.id);

              return (
                <div
                  key={trim.id}
                  onClick={multiSelectMode ? () => toggleTrimSelect(trim.id) : undefined}
                  className={cn(
                    "bg-white border rounded-[12px] p-5 shadow-sm transition-all group relative",
                    multiSelectMode
                      ? "cursor-pointer select-none"
                      : "hover:border-[#000666]/30",
                    isSelected
                      ? bulkTarget === "subsidy"
                        ? "border-[#000666]/40 bg-[#EEF0FF]/60 shadow-indigo-100"
                        : "border-amber-400 bg-amber-50/50 shadow-amber-100"
                      : "border-[#E8EAF0]"
                  )}
                >
                  {/* 다중 선택 체크박스 */}
                  {multiSelectMode && (
                    <div className="absolute top-3 right-3">
                      {isSelected
                        ? <CheckSquare size={18} className={bulkTarget === "subsidy" ? "text-[#000666]" : "text-amber-500"} />
                        : <Square size={18} className="text-[#C0C8E0]" />
                      }
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-[15px] font-bold text-[#1A1A2E]">{trim.name}</h4>
                      <p className="text-[12px] text-[#9BA4C0]">{trim.engineType}</p>
                    </div>
                    {!multiSelectMode && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(trim)}
                          className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(trim.id)}
                          className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#F0F2F8]">
                    {trim.discountPrice && trim.discountPrice < trim.price ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-extrabold text-[#000666]">
                            {formatKRWMan(trim.discountPrice)}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                            -{discountRate}%
                          </span>
                        </div>
                        <p className="text-[12px] text-[#9BA4C0] line-through">
                          {formatKRWMan(trim.price)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[16px] font-extrabold text-[#000666]">
                        {formatKRWMan(trim.price)}
                      </span>
                    )}
                    {trim.evSubsidy && trim.evSubsidy > 0 ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-[5px] bg-[#000666]/[0.06] border border-[#000666]/10 px-2 py-0.5">
                        <Zap size={10} strokeWidth={2.5} className="text-[#000666]" />
                        <span className="text-[11px] font-semibold text-[#000666]">
                          보조금 {Math.round(trim.evSubsidy / 10000).toLocaleString()}만원
                        </span>
                      </div>
                    ) : null}
                    {trim.isDefault && (
                      <span className="absolute bottom-4 right-4 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-[4px] font-bold uppercase tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTrims.length === 0 && (
            <div className="p-12 text-center bg-white rounded-[12px] border border-[#E8EAF0]">
              <p className="text-[#9BA4C0] text-[13px]">이 라인업에 등록된 트림이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 트림 추가/수정 모달 */}
      <AnimatePresence>
        {trimModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[16px] w-full max-w-[480px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-[#F0F2F8] flex justify-between items-center bg-[#F8F9FC]">
                <h3 className="text-[16px] font-bold text-[#1A1A2E]">
                  {trimModal.target ? "트림 수정" : "트림 추가"}
                  <span className="ml-2 text-[12px] font-normal text-[#6B7399]">in {selectedLineup?.name}</span>
                </h3>
                <button onClick={closeModal} className="text-[#9BA4C0] hover:text-[#1A1A2E]">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveTrim} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">트림명</label>
                  <input
                    name="name"
                    autoFocus
                    defaultValue={trimModal.target?.name}
                    placeholder="예: 프레스티지, 노블레스"
                    className={inputClass}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">가격 (만원)</label>
                    <input
                      name="price"
                      type="number"
                      value={modalPriceInput}
                      onChange={e => setModalPriceInput(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">엔진 타입</label>
                    <select
                      name="engineType"
                      defaultValue={trimModal.target?.engineType ?? "가솔린"}
                      className={selectClass}
                    >
                      {["가솔린", "디젤", "하이브리드", "EV"].map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                {/* 할인 입력 — 금액 / 할인율 모드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider flex items-center gap-1.5">
                      <Tag size={11} />
                      할인 설정
                      <span className="text-[10px] font-normal text-[#B0B8D0] normal-case tracking-normal">· 빈칸 = 할인 없음</span>
                    </label>
                    {/* 모드 토글 */}
                    <div className="flex rounded-[6px] overflow-hidden border border-[#E8EAF0] text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => switchModalMode("amount")}
                        className={cn(
                          "px-3 py-1 transition-colors",
                          modalDiscountMode === "amount"
                            ? "bg-[#000666] text-white"
                            : "bg-white text-[#6B7399] hover:bg-[#F0F2F8]"
                        )}
                      >
                        금액 (만원)
                      </button>
                      <button
                        type="button"
                        onClick={() => switchModalMode("rate")}
                        className={cn(
                          "px-3 py-1 transition-colors",
                          modalDiscountMode === "rate"
                            ? "bg-[#000666] text-white"
                            : "bg-white text-[#6B7399] hover:bg-[#F0F2F8]"
                        )}
                      >
                        할인율 (%)
                      </button>
                    </div>
                  </div>

                  {/* 입력 필드 */}
                  <div className="relative">
                    {modalDiscountMode === "amount" ? (
                      <>
                        <input
                          type="number"
                          value={modalDiscountInput}
                          onChange={e => setModalDiscountInput(e.target.value)}
                          placeholder="미입력 시 할인 없음"
                          className={cn(
                            inputClass,
                            modalDiscountAmount > 0 && modalPrice > 0 && modalDiscountAmount >= modalPrice
                              ? "border-red-400 focus:border-red-500"
                              : ""
                          )}
                        />
                        {modalDiscountRate > 0 && modalDiscountAmount < modalPrice && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                            -{modalDiscountRate}%
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={modalRateInput}
                          onChange={e => setModalRateInput(e.target.value)}
                          placeholder="예: 10 (10% 할인)"
                          className={cn(
                            inputClass,
                            Number(modalRateInput) >= 100
                              ? "border-red-400 focus:border-red-500"
                              : ""
                          )}
                        />
                        {modalDiscountAmount > 0 && modalDiscountAmount < modalPrice && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                            -{formatKRWMan(modalDiscountAmount)}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* 결과 미리보기 */}
                  {modalDiscountAmount > 0 && modalPrice > 0 && modalDiscountAmount < modalPrice && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-[6px] px-3 py-2">
                      <span className="text-[12px] text-[#9BA4C0] line-through">{formatKRWMan(modalPrice)}</span>
                      <span className="text-[11px] text-[#9BA4C0]">→</span>
                      <span className="text-[13px] font-bold text-emerald-700">{formatKRWMan(modalResultPrice)}</span>
                      <span className="text-[11px] font-bold text-emerald-600 bg-white border border-emerald-200 px-1.5 py-0.5 rounded-[4px] ml-auto">
                        -{modalDiscountRate}% · {formatKRWMan(modalDiscountAmount)} 할인
                      </span>
                    </div>
                  )}
                  {/* 오류 메시지 */}
                  {modalDiscountMode === "amount" && modalDiscountAmount > 0 && modalPrice > 0 && modalDiscountAmount >= modalPrice && (
                    <p className="text-[11px] text-red-500">할인 금액은 원가보다 작아야 합니다.</p>
                  )}
                  {modalDiscountMode === "rate" && Number(modalRateInput) >= 100 && (
                    <p className="text-[11px] text-red-500">할인율은 0~99% 사이여야 합니다.</p>
                  )}
                </div>

                {/* 전기차 보조금 — 견적 미반영, 안내 표기 전용 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={11} />
                    전기차 보조금 (만원)
                    <span className="text-[10px] font-normal text-[#B0B8D0] normal-case tracking-normal">· 견적 미반영 · 빈칸 = 미표시</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalSubsidyInput}
                    onChange={e => setModalSubsidyInput(e.target.value)}
                    placeholder="예: 400 (전기차만 입력)"
                    className={inputClass}
                  />
                  <p className="text-[11px] text-[#9BA4C0]">
                    사용자 화면에 안내용으로만 표시되며 견적 계산에는 반영되지 않습니다.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">연비 (km/L)</label>
                  <input
                    name="fuelEfficiency"
                    type="number"
                    step="0.1"
                    defaultValue={trimModal.target?.fuelEfficiency ?? ""}
                    placeholder="0.0"
                    className={inputClass}
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-[#1A1A2E] cursor-pointer pt-2">
                  <input
                    name="isDefault"
                    type="checkbox"
                    defaultChecked={trimModal.target?.isDefault ?? false}
                    className="w-4 h-4 accent-[#000666]"
                  />
                  이 라인업의 기본 트림으로 설정
                </label>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 bg-[#F4F5F8] text-[#4A5270] rounded-[8px] text-[14px] font-bold hover:bg-[#E8EAF0]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      (modalDiscountAmount > 0 && modalPrice > 0 && modalDiscountAmount >= modalPrice) ||
                      (modalDiscountMode === "rate" && Number(modalRateInput) >= 100)
                    }
                    className="flex-1 py-3 bg-[#000666] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#1A1A6E] shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {saving ? "처리 중..." : trimModal.target ? "수정하기" : "추가하기"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
