"use client";

import { useState } from "react";
import { ImageOff, RotateCcw, Trash2 } from "lucide-react";
import type { AdminVehicleImage } from "@/types/admin";
import { focusRing, imageTitle } from "./image-ui";

type Props = {
  readonly images: readonly AdminVehicleImage[];
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly canPurgeImages: boolean;
  readonly onRestore: (image: AdminVehicleImage) => void;
  readonly onPurge: (image: AdminVehicleImage) => void;
};

export function ImageTrash({ images, disabled, busy, canPurgeImages, onRestore, onPurge }: Props) {
  const locked = disabled || busy;
  return (
    <section data-testid="image-trash" aria-labelledby="image-trash-heading" className="overflow-hidden rounded-[12px] border border-[#E3E6EF] bg-white shadow-sm">
      <header className="border-b border-[#EEF0F5] px-4 py-3 sm:px-5">
        <h2 id="image-trash-heading" className="text-[15px] font-bold text-[#1A1A2E]">휴지통</h2>
        <p className="mt-0.5 text-[12px] leading-5 text-[#6B7399]">복원 시 기존 노출 상태를 유지합니다. 관리자 등록 이미지만 영구 삭제할 수 있습니다.</p>
      </header>
      {images.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#6B7399]">휴지통이 비어 있습니다.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {images.map((image) => {
            const title = imageTitle(image);
            return (
              <article key={image.id} data-testid={`trash-${image.id}`} className="rounded-[10px] border border-[#E3E6EF] bg-[#FAFAFC] p-3">
                <div className="flex items-center gap-3">
                  <TrashPreview image={image} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13px] font-bold text-[#1A1A2E]">{title}</h3>
                    <p className="mt-1 text-[11px] text-[#6B7399]">{image.origin === "ADMIN" ? "관리자 등록" : "Carpan2"} · {image.isVisible ? "노출 상태" : "숨김 상태"}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => onRestore(image)} disabled={locked} aria-label={`${title} 복원`} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#D9DDEA] text-[12px] font-bold text-[#000666] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
                    <RotateCcw size={14} aria-hidden="true" />복원
                  </button>
                  {image.origin === "ADMIN" && canPurgeImages ? (
                    <button type="button" onClick={() => onPurge(image)} disabled={locked} aria-label={`${title} 영구 삭제`} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-red-50 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
                      <Trash2 size={14} aria-hidden="true" />영구 삭제
                    </button>
                  ) : <span className="flex min-h-11 items-center justify-center text-center text-[11px] leading-4 text-[#6B7399]">{image.origin === "ADMIN" ? "관리자 권한 필요" : "원본 보호됨"}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TrashPreview({ image }: { readonly image: AdminVehicleImage }) {
  const [broken, setBroken] = useState(false);
  const title = imageTitle(image);
  return <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#EEF0F5]">
    {!broken && image.storageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image.storageUrl} alt={`${title} 휴지통 미리보기`} onError={() => setBroken(true)} className="h-full w-full object-cover" />
    ) : <div role="img" aria-label={`${title} 이미지를 불러올 수 없음`} className="flex flex-col items-center gap-1 text-center text-[#4A5270]"><ImageOff size={18} aria-hidden="true" /><span className="text-[9px]">미리보기 오류</span></div>}
  </div>;
}
