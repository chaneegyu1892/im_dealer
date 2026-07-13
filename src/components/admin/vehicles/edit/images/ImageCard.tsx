"use client";

import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, ImageOff, Pencil, Star, Trash2 } from "lucide-react";
import type { AdminVehicleImage } from "@/types/admin";
import { focusRing, IMAGE_TYPE_LABELS, imageTitle } from "./image-ui";

type Props = {
  readonly image: AdminVehicleImage;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onEdit: (image: AdminVehicleImage) => void;
  readonly onVisibility: (image: AdminVehicleImage) => void;
  readonly onRepresentative: (image: AdminVehicleImage) => void;
  readonly onTrash: (image: AdminVehicleImage) => void;
  readonly onMove: (imageId: string, direction: -1 | 1) => void;
  readonly onDrop: (sourceId: string, targetId: string) => void;
};

export function ImageCard(props: Props) {
  const { image, disabled, busy } = props;
  const [broken, setBroken] = useState(false);
  const title = imageTitle(image);
  const representativeGuard = image.isRepresentative
    ? "대표 이미지를 변경한 뒤 숨기거나 삭제할 수 있습니다."
    : undefined;
  const representativeGuardId = image.isRepresentative ? `representative-guard-${image.id}` : undefined;
  const locked = disabled || busy;

  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== image.id) props.onDrop(sourceId, image.id);
  };

  return (
    <article
      data-testid={`image-card-${image.id}`}
      draggable={!locked}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", image.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
      className="overflow-hidden rounded-[12px] border border-[#E3E6EF] bg-white transition-colors focus-within:border-[#6066EE]"
    >
      <div className="relative aspect-[16/10] bg-[#F4F5F8]">
        {!broken && image.storageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.storageUrl} alt={`${title} 미리보기`} onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <div role="img" aria-label={`${title} 이미지를 불러올 수 없음`} className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#4A5270]">
            <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[12px]">이미지를 불러올 수 없습니다</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className={`rounded-[5px] px-2 py-1 text-[10px] font-bold ${image.origin === "ADMIN" ? "bg-[#000666] text-white" : "bg-white/95 text-[#4A5270]"}`}>
            {image.origin === "ADMIN" ? "관리자 등록" : "Carpan2"}
          </span>
          {image.isRepresentative && <span className="inline-flex items-center gap-1 rounded-[5px] bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><Star size={11} fill="currentColor" aria-hidden="true" />대표 이미지</span>}
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          <GripVertical size={18} className="mt-0.5 shrink-0 text-[#9BA4C0]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-bold text-[#1A1A2E]" title={title}>{title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7399]">
              <span>{IMAGE_TYPE_LABELS[image.type]}</span>
              <span aria-label={image.isVisible ? "노출 중" : "숨김"} className={image.isVisible ? "text-emerald-700" : "text-[#6B7399]"}>{image.isVisible ? "노출 중" : "숨김"}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => props.onEdit(image)} disabled={locked} aria-label={`${title} 수정`} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#F0F2F8] px-2 text-[12px] font-bold text-[#4A5270] hover:bg-[#E6E9F2] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
            <Pencil size={14} aria-hidden="true" />수정
          </button>
          <button type="button" onClick={() => props.onRepresentative(image)} disabled={locked || image.isRepresentative || !image.isVisible} aria-label={`${title} 대표로 지정`} title={!image.isVisible ? "숨김 이미지는 대표로 지정할 수 없습니다." : undefined} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#D9DDEA] px-2 text-[12px] font-bold text-[#000666] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
            <Star size={14} aria-hidden="true" />대표 지정
          </button>
          <button type="button" onClick={() => props.onVisibility(image)} disabled={locked || image.isRepresentative} aria-label={`${title} ${image.isVisible ? "숨기기" : "노출하기"}`} aria-describedby={representativeGuardId} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#D9DDEA] px-2 text-[12px] font-bold text-[#4A5270] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
            {image.isVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}{image.isVisible ? "숨기기" : "노출하기"}
          </button>
          <button type="button" onClick={() => props.onTrash(image)} disabled={locked || image.isRepresentative} aria-label={`${title} 휴지통으로 이동`} aria-describedby={representativeGuardId} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-red-50 px-2 text-[12px] font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
            <Trash2 size={14} aria-hidden="true" />삭제
          </button>
        </div>
        {representativeGuard && <p id={representativeGuardId} className="rounded-[7px] bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">{representativeGuard}</p>}
        <div className="grid grid-cols-2 gap-2 border-t border-[#EEF0F5] pt-3">
          <button type="button" onClick={() => props.onMove(image.id, -1)} disabled={locked || props.isFirst} aria-label={`${title} 위로 이동`} className={`inline-flex min-h-11 items-center justify-center gap-1 text-[12px] font-bold text-[#4A5270] disabled:cursor-not-allowed disabled:text-[#C0C5D8] ${focusRing}`}><ArrowUp size={14} aria-hidden="true" />위로</button>
          <button type="button" onClick={() => props.onMove(image.id, 1)} disabled={locked || props.isLast} aria-label={`${title} 아래로 이동`} className={`inline-flex min-h-11 items-center justify-center gap-1 text-[12px] font-bold text-[#4A5270] disabled:cursor-not-allowed disabled:text-[#C0C5D8] ${focusRing}`}><ArrowDown size={14} aria-hidden="true" />아래로</button>
        </div>
      </div>
    </article>
  );
}
