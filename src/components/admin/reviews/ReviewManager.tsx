"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Star, Save, MessageSquare, Sparkles, Heart } from "lucide-react";
import type {
  AdminReview,
  AdminReviewVehicleOption,
  CustomerSearchResult,
} from "@/types/review";
import { maskAuthorName } from "@/lib/review-utils";
import { CustomerSearchInput } from "./CustomerSearchInput";

interface ReviewManagerProps {
  initialReviews: AdminReview[];
  vehicleOptions: AdminReviewVehicleOption[];
}

type FormState = {
  authorRealName: string;
  rating: number;
  content: string;
  vehicleId: string;
  savedQuoteId: string;
  isPublic: boolean;
  isBest: boolean;
  displayOrder: number;
  reviewDate: string;
};

const EMPTY_FORM: FormState = {
  authorRealName: "",
  rating: 5,
  content: "",
  vehicleId: "",
  savedQuoteId: "",
  isPublic: true,
  isBest: false,
  displayOrder: 0,
  reviewDate: new Date().toISOString().slice(0, 10),
};

function reviewToForm(r: AdminReview): FormState {
  return {
    authorRealName: r.authorRealName,
    rating: r.rating,
    content: r.content,
    vehicleId: r.vehicleId ?? "",
    savedQuoteId: r.savedQuoteId ?? "",
    isPublic: r.isPublic,
    isBest: r.isBest,
    displayOrder: r.displayOrder,
    reviewDate: r.reviewDate.slice(0, 10),
  };
}

function reviewToSelectedCustomer(r: AdminReview): CustomerSearchResult | null {
  if (!r.savedQuoteId || !r.linkedCustomerName) return null;
  return {
    savedQuoteId: r.savedQuoteId,
    customerName: r.linkedCustomerName,
    phoneMasked: r.linkedCustomerPhoneMasked ?? "",
    customerType: "individual",
    vehicleId: null,
    vehicleName: r.linkedQuoteVehicleName,
    createdAt: r.linkedQuoteCreatedAt ?? "",
    status: "",
    statusLabel: "",
  };
}

export function ReviewManager({ initialReviews, vehicleOptions }: ReviewManagerProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [bestOnly, setBestOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialReviews[0]?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(
    initialReviews[0] ? reviewToForm(initialReviews[0]) : EMPTY_FORM
  );
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(
    initialReviews[0] ? reviewToSelectedCustomer(initialReviews[0]) : null
  );
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return initialReviews.filter((r) => {
      if (vehicleFilter && r.vehicleId !== vehicleFilter) return false;
      if (visibilityFilter === "public" && !r.isPublic) return false;
      if (visibilityFilter === "private" && r.isPublic) return false;
      if (bestOnly && !r.isBest) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.authorRealName} ${r.content} ${r.vehicleName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialReviews, search, vehicleFilter, visibilityFilter, bestOnly]);

  const handleSelect = (id: string) => {
    const r = initialReviews.find((x) => x.id === id);
    if (!r) return;
    setSelectedId(id);
    setIsCreating(false);
    setForm(reviewToForm(r));
    setSelectedCustomer(reviewToSelectedCustomer(r));
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setSelectedCustomer(null);
  };

  const handleSelectCustomer = (c: CustomerSearchResult) => {
    setSelectedCustomer(c);
    setForm((prev) => ({
      ...prev,
      savedQuoteId: c.savedQuoteId,
      authorRealName: c.customerName,
      vehicleId: c.vehicleId ?? prev.vehicleId,
    }));
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setForm((prev) => ({ ...prev, savedQuoteId: "" }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.authorRealName.trim() || !form.content.trim()) {
      alert("이름과 후기 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        authorRealName: form.authorRealName.trim(),
        rating: form.rating,
        content: form.content.trim(),
        vehicleId: form.vehicleId || null,
        savedQuoteId: form.savedQuoteId || null,
        isPublic: form.isPublic,
        isBest: form.isBest,
        displayOrder: form.displayOrder,
        reviewDate: new Date(form.reviewDate).toISOString(),
      };

      const url = isCreating
        ? "/api/admin/reviews"
        : `/api/admin/reviews/${selectedId}`;
      const method = isCreating ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "저장 실패");
      }
      router.refresh();
      setIsCreating(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("이 후기를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/reviews/${selectedId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      router.refresh();
      setSelectedId(null);
      setForm(EMPTY_FORM);
      setSelectedCustomer(null);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const previewName = form.authorRealName.trim()
    ? maskAuthorName(form.authorRealName)
    : "—";

  const selectedReview = selectedId
    ? initialReviews.find((r) => r.id === selectedId)
    : null;
  const selectedImageUrls = !isCreating && selectedReview ? selectedReview.imageUrls : [];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#F8F9FC]">
      {/* 좌측: 목록 */}
      <div className="w-[360px] shrink-0 border-r border-[#E8EAF2] bg-white flex flex-col">
        <div className="p-5 border-b border-[#E8EAF2]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[#1A1A2E] flex items-center gap-2">
              <MessageSquare size={16} /> 후기 관리
            </h2>
            <button
              type="button"
              onClick={handleStartCreate}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-[#000666] hover:bg-[#0010CC] px-2.5 py-1.5 rounded-[6px]"
            >
              <Plus size={12} /> 새 후기
            </button>
          </div>

          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름·내용·차량 검색"
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE]"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="flex-1 text-[12px] border border-[#E8EAF2] rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#6066EE]"
            >
              <option value="">전체 차량</option>
              {vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.name}
                </option>
              ))}
            </select>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as "all" | "public" | "private")}
              className="text-[12px] border border-[#E8EAF2] rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#6066EE]"
            >
              <option value="all">전체</option>
              <option value="public">공개</option>
              <option value="private">비공개</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setBestOnly((v) => !v)}
            className={
              "mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors " +
              (bestOnly
                ? "bg-[#000666] text-white border-[#000666]"
                : "bg-white text-[#71749A] border-[#E8EAF2] hover:border-[#6066EE]")
            }
          >
            <Sparkles size={11} />
            베스트만 보기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[#9BA4C0]">
              후기가 없습니다.
            </div>
          ) : (
            filtered.map((r) => {
              const active = r.id === selectedId && !isCreating;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  className={
                    "w-full text-left px-5 py-3 border-b border-[#F0F0F0] transition-colors " +
                    (active
                      ? "bg-[#F2F4FF] border-l-2 border-l-[#000666]"
                      : "hover:bg-[#F8F9FC]")
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-[#1A1A2E]">
                      {r.displayName}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={
                            i < r.rating
                              ? "fill-[#000666] text-[#000666]"
                              : "text-[#D0D3E5]"
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[12px] text-[#71749A] line-clamp-2">{r.content}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#9BA4C0]">
                    <span className="truncate">{r.vehicleName ?? "차량 미연결"}</span>
                    <span className="flex items-center gap-1">
                      {r.likeCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[#71749A]">
                          <Heart size={9} className="fill-current" />
                          {r.likeCount}
                        </span>
                      )}
                      {r.isBest && (
                        <span className="inline-flex items-center gap-0.5 bg-[#000666] text-white px-1.5 py-0.5 rounded font-medium">
                          <Sparkles size={9} />
                          BEST
                        </span>
                      )}
                      {!r.isPublic && (
                        <span className="bg-[#FFEBEB] text-[#CC0000] px-1.5 py-0.5 rounded">비공개</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 우측: 편집 폼 */}
      <div className="flex-1 overflow-y-auto p-8">
        {!isCreating && !selectedId ? (
          <div className="h-full flex items-center justify-center text-[#9BA4C0] text-[13px]">
            후기를 선택하거나 새로 만드세요.
          </div>
        ) : (
          <div className="max-w-[640px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-[#1A1A2E]">
                {isCreating ? "새 후기 작성" : "후기 편집"}
              </h3>
              {!isCreating && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 text-[12px] text-[#CC0000] hover:bg-[#FFEBEB] px-2.5 py-1.5 rounded-[6px]"
                >
                  <Trash2 size={12} /> 삭제
                </button>
              )}
            </div>

            <div className="space-y-5 bg-white rounded-[12px] border border-[#E8EAF2] p-6">
              {/* 고객 연결 (선택) */}
              <div>
                <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                  연결 고객 <span className="text-[11px] text-[#9BA4C0] font-normal">(선택)</span>
                </label>
                <CustomerSearchInput
                  selected={selectedCustomer}
                  onSelect={handleSelectCustomer}
                  onClear={handleClearCustomer}
                />
                <p className="text-[11px] text-[#9BA4C0] mt-1">
                  고객을 선택하면 실명·연결 차량이 자동으로 채워집니다 (수정 가능).
                </p>
              </div>

              {/* 실명 */}
              <div>
                <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                  고객 실명 <span className="text-[#CC0000]">*</span>
                </label>
                <input
                  value={form.authorRealName}
                  onChange={(e) => setForm({ ...form, authorRealName: e.target.value })}
                  placeholder="예) 김민수"
                  className="w-full px-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE]"
                />
                <p className="text-[11px] text-[#9BA4C0] mt-1">
                  노출 시 마스킹: <span className="font-medium text-[#000666]">{previewName}</span>
                </p>
              </div>

              {/* 별점 */}
              <div>
                <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                  별점
                </label>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm({ ...form, rating: i + 1 })}
                      className="p-0.5"
                    >
                      <Star
                        size={22}
                        className={
                          i < form.rating
                            ? "fill-[#000666] text-[#000666]"
                            : "text-[#D0D3E5]"
                        }
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-[12px] text-[#71749A]">{form.rating}/5</span>
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                  후기 내용 <span className="text-[#CC0000]">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={5}
                  placeholder="고객 후기 내용을 입력하세요."
                  className="w-full px-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE] resize-y"
                />
              </div>

              {/* 차량 */}
              <div>
                <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                  연결 차량
                </label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE] bg-white"
                >
                  <option value="">없음 (메인페이지에만 노출)</option>
                  {vehicleOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 작성일 / 노출 순서 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                    작성일
                  </label>
                  <input
                    type="date"
                    value={form.reviewDate}
                    onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                    노출 순서
                  </label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) =>
                      setForm({ ...form, displayOrder: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-[13px] border border-[#E8EAF2] rounded-[6px] focus:outline-none focus:border-[#6066EE]"
                  />
                </div>
              </div>

              {/* 첨부 이미지 (고객 작성 후기에만 노출) */}
              {selectedImageUrls.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-[#1A1A2E] mb-1.5">
                    첨부 이미지
                    <span className="ml-1 text-[11px] text-[#9BA4C0] font-normal">
                      ({selectedImageUrls.length}장 · 고객 첨부)
                    </span>
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedImageUrls.map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-20 h-20 shrink-0 rounded-[6px] overflow-hidden border border-[#E8EAF2] bg-[#F4F5F8] hover:border-[#6066EE]"
                        title={`이미지 ${idx + 1} 원본 열기`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 공개 여부 */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublic}
                    onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                    className="w-4 h-4 accent-[#000666]"
                  />
                  <span className="text-[13px] text-[#1A1A2E]">공개</span>
                  <span className="text-[11px] text-[#9BA4C0]">
                    꺼두면 메인페이지·차량 상세페이지에서 노출되지 않습니다.
                  </span>
                </label>
              </div>

              {/* 베스트 후기 */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isBest}
                    onChange={(e) => setForm({ ...form, isBest: e.target.checked })}
                    className="w-4 h-4 accent-[#000666]"
                  />
                  <span className="text-[13px] text-[#1A1A2E] inline-flex items-center gap-1">
                    <Sparkles size={12} className="text-[#000666]" /> 베스트 후기
                  </span>
                  <span className="text-[11px] text-[#9BA4C0]">
                    홈 캐러셀과 후기 페이지 상단, 차량 상세에 우선 노출됩니다.
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#000666] hover:bg-[#0010CC] disabled:opacity-50 px-5 py-2.5 rounded-[8px]"
              >
                <Save size={14} />
                {saving ? "저장 중..." : isCreating ? "생성" : "저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
