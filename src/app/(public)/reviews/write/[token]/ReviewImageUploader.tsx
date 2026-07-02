"use client";

import type { ChangeEvent, RefObject } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

interface ReviewImageUploaderProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageUrls: string[];
  uploading: boolean;
  maxImages: number;
  onPickFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
}

export function ReviewImageUploader({
  fileInputRef,
  imageUrls,
  uploading,
  maxImages,
  onPickFiles,
  onRemoveImage,
}: ReviewImageUploaderProps) {
  const remainingSlots = maxImages - imageUrls.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-[13px] font-extrabold text-text-strong">
          사진 (선택)
        </label>
        <span className="text-[12px] text-text-muted">
          {imageUrls.length}/{maxImages}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {imageUrls.map((url, idx) => (
          <div
            key={url}
            className="relative aspect-square overflow-hidden rounded-[12px] border border-border-subtle bg-surface-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`첨부 이미지 ${idx + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemoveImage(idx)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-text-strong/70 text-surface hover:bg-text-strong/85"
              aria-label="이미지 제거"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border-subtle bg-surface-soft text-text-muted transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[11px]">처리 중</span>
              </>
            ) : (
              <>
                <ImagePlus size={20} />
                <span className="text-[11px]">사진 추가</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onPickFiles}
      />

      <p className="mt-1.5 text-[11px] text-text-muted">
        최대 {maxImages}장 · JPG/PNG/WEBP · 큰 사진은 자동으로 줄어 업로드됩니다
      </p>
    </div>
  );
}
