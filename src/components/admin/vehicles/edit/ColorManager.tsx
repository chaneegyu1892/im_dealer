"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import type { AdminVehicleColor, ColorKind } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

interface ColorManagerProps {
  vehicleId: string;
  /** 수정 시 기존 색상, 추가 시 null. defaultKind는 새 항목 추가 버튼이 외장/내장 어디에서 눌렸는지 */
  target: AdminVehicleColor | null;
  defaultKind: ColorKind;
  onClose: () => void;
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ColorManager({ vehicleId, target, defaultKind, onClose }: ColorManagerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [hex, setHex] = useState(target?.hexCode ?? "#FFFFFF");
  const [kind, setKind] = useState<ColorKind>(target?.kind ?? defaultKind);
  const [imageUrl, setImageUrl] = useState<string | null>(target?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validHex = HEX_REGEX.test(hex);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "colors");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "업로드 실패");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("업로드 중 네트워크 오류");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validHex) {
      setError("Hex 색상 코드 형식이 올바르지 않습니다 (#RRGGBB)");
      return;
    }

    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      kind,
      name: fd.get("name") as string,
      hexCode: hex,
      imageUrl: imageUrl ?? null,
      // 입력은 만원 단위 → 저장은 원 단위 (예: 100 → 1,000,000원)
      priceDelta: Math.round(Number(fd.get("priceDelta") || 0) * 10000),
      isDefault: fd.get("isDefault") === "on",
      sortOrder: Number(fd.get("sortOrder") || 0),
    };

    try {
      const url = target
        ? `/api/admin/vehicles/${vehicleId}/colors/${target.id}`
        : `/api/admin/vehicles/${vehicleId}/colors`;
      const res = await fetch(url, {
        method: target ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[440px] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-4">
          {target ? "색상 수정" : "색상 추가"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="구분" required>
            <div className="flex gap-2">
              {(["EXTERIOR", "INTERIOR"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 py-2 rounded-[6px] text-[13px] font-medium transition-all ${
                    kind === k
                      ? "bg-[#000666] text-white"
                      : "bg-[#F4F5F8] text-[#6B7399] hover:bg-[#E8EAF0]"
                  }`}
                >
                  {k === "EXTERIOR" ? "외장" : "내장"}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="색상명" required>
            <input
              name="name"
              defaultValue={target?.name}
              className={inputClass}
              placeholder="예: 스노우 화이트 펄"
              autoFocus
              required
            />
          </FormField>

          <FormField label="Hex 색상 코드" required>
            <div className="flex items-center gap-2">
              <input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className={inputClass}
                placeholder="#FFFFFF"
                maxLength={7}
              />
              <input
                type="color"
                value={validHex ? hex : "#FFFFFF"}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="w-10 h-10 rounded-[6px] border border-[#E8EAF0] cursor-pointer"
              />
              <div
                className="w-10 h-10 rounded-full border-2 border-white shadow-md shrink-0"
                style={{ background: validHex ? hex : "transparent" }}
                title="미리보기"
              />
            </div>
            {!validHex && (
              <p className="text-[11px] text-red-500 mt-1">#RRGGBB 형식으로 입력하세요</p>
            )}
          </FormField>

          <FormField label="대표 이미지">
            {imageUrl ? (
              <div className="relative w-full h-32 rounded-[8px] overflow-hidden border border-[#E8EAF0] bg-[#F8F9FC] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="색상 이미지" className="max-h-full max-w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-24 border-2 border-dashed border-[#E8EAF0] rounded-[8px] flex flex-col items-center justify-center gap-1 text-[12px] text-[#6B7399] hover:border-[#000666] hover:text-[#000666] transition-colors"
              >
                <Upload size={16} />
                {uploading ? "업로드 중..." : "이미지 업로드 (선택)"}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="추가요금 (만원)">
              <input
                name="priceDelta"
                type="number"
                min={0}
                step="any"
                defaultValue={target?.priceDelta ? target.priceDelta / 10000 : ""}
                className={inputClass}
                placeholder="예: 100 = 100만원"
              />
            </FormField>
            <FormField label="정렬 순서">
              <input
                name="sortOrder"
                type="number"
                defaultValue={target?.sortOrder ?? 0}
                className={inputClass}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
            <input
              name="isDefault"
              type="checkbox"
              defaultChecked={target?.isDefault ?? false}
              className="accent-[#000666]"
            />
            기본 색상으로 지정 (같은 구분 내 다른 기본은 자동 해제)
          </label>

          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !validHex}
              className="flex-1 py-2 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium disabled:opacity-50"
            >
              {saving ? "처리 중..." : target ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
