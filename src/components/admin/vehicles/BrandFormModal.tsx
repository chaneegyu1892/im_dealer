"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 2 * 1024 * 1024;

interface BrandFormModalBaseProps {
  existingNames: string[];
  onClose: () => void;
}

interface BrandFormModalCreateProps extends BrandFormModalBaseProps {
  mode?: "create";
  onSaved: (name: string) => void;
}

interface BrandFormModalEditProps extends BrandFormModalBaseProps {
  mode: "edit";
  brand: { id: string; name: string; logoUrl: string | null };
  onSaved: (name: string) => void;
}

type BrandFormModalProps = BrandFormModalCreateProps | BrandFormModalEditProps;

export function BrandFormModal(props: BrandFormModalProps) {
  const { existingNames, onClose, onSaved } = props;
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.brand : { id: "", name: "", logoUrl: null as string | null };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 자기 자신 제외한 기존 이름들과 중복 체크
  const lowerExisting = new Set(
    existingNames
      .filter((n) => !isEdit || n !== initial.name)
      .map((n) => n.toLowerCase())
  );
  const trimmed = name.trim();
  const nameError = trimmed
    ? lowerExisting.has(trimmed.toLowerCase())
      ? "이미 존재하는 브랜드명입니다."
      : null
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      setError("이미지 형식은 jpg, png, webp, svg만 지원합니다.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("로고 파일은 2MB 이하여야 합니다.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "brands");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "업로드 실패");
      }
      setLogoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로고 업로드 중 오류");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || nameError || !trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/admin/brands/${initial.id}` : "/api/admin/brands";
      const method = isEdit ? "PATCH" : "POST";
      // displayOrder는 서버에서 1000(우선순위 5개 뒤)으로 강제. 클라이언트가 보내면
      // brand-sort 규칙(우선순위 5개 + 가나다순)이 깨지므로 의도적으로 생략한다.
      const payload = isEdit
        ? { name: trimmed, logoUrl }
        : { name: trimmed, logoUrl };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? (isEdit ? "브랜드 수정 실패" : "브랜드 생성 실패"));
      }
      onSaved(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "브랜드 저장 중 오류");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[420px] p-6 shadow-xl"
      >
        <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-5">
          {isEdit ? "브랜드 수정" : "브랜드 추가"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
              브랜드명 <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 폴스타"
              className={inputClass}
              maxLength={40}
            />
            {nameError && (
              <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle size={11} />
                {nameError}
              </p>
            )}
            {isEdit && trimmed !== initial.name && trimmed && (
              <p className="mt-1 text-[11px] text-[#6B7399] flex items-center gap-1">
                <AlertCircle size={11} />
                이름 변경 시 이 브랜드를 사용하는 차량들의 브랜드 표기도 함께 갱신됩니다.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
              로고 이미지
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-[10px] bg-[#F8F9FC] border border-[#E8EAF0] flex items-center justify-center overflow-hidden shrink-0 relative">
                {logoUrl ? (
                  <>
                    <Image src={logoUrl} alt="로고 미리보기" width={64} height={64} className="w-full h-full object-contain p-1.5" unoptimized />
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                      aria-label="로고 제거"
                    >
                      <X size={10} />
                    </button>
                  </>
                ) : (
                  <ImagePlus size={20} className="text-[#9BA4C0]" />
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 text-[12px] font-medium text-[#000666] bg-[#F0F2F8] hover:bg-[#E4E7F2] rounded-[6px] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading && <Loader2 size={12} className="animate-spin" />}
                  {logoUrl ? "다른 이미지 선택" : "로고 업로드"}
                </button>
                <p className="mt-1 text-[10px] text-[#9BA4C0]">PNG/SVG 권장 · 최대 2MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <div className="text-[12px] text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-[6px]">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-medium text-[#6B7399] hover:bg-[#F0F2F8] rounded-[8px] transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || uploading || !trimmed || !!nameError}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#000666] hover:bg-[#1A1F8F] rounded-[8px] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? "저장" : "등록"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
