"use client";

import { Plus } from "lucide-react";
import type { AdminVehicleImage } from "@/types/admin";
import type { VehicleImageGroup, VehicleImageTypeValue } from "@/lib/vehicle-images/groups";
import { ImageCard } from "./ImageCard";
import { focusRing } from "./image-ui";

type Props = {
  readonly group: VehicleImageGroup;
  readonly label: string;
  readonly initialType: VehicleImageTypeValue;
  readonly images: readonly AdminVehicleImage[];
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly onAdd: (type: VehicleImageTypeValue) => void;
  readonly onEdit: (image: AdminVehicleImage) => void;
  readonly onVisibility: (image: AdminVehicleImage) => void;
  readonly onRepresentative: (image: AdminVehicleImage) => void;
  readonly onTrash: (image: AdminVehicleImage) => void;
  readonly onReorder: (group: VehicleImageGroup, images: readonly AdminVehicleImage[]) => void;
};

export function ImageGroup(props: Props) {
  const ordered = props.images.toSorted((left, right) =>
    left.displayOrder - right.displayOrder
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id));

  const move = (imageId: string, direction: -1 | 1) => {
    const current = ordered.findIndex((image) => image.id === imageId);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const currentImage = next[current];
    const targetImage = next[target];
    if (!currentImage || !targetImage) return;
    next[current] = targetImage;
    next[target] = currentImage;
    props.onReorder(props.group, next);
  };

  const drop = (sourceId: string, targetId: string) => {
    const source = ordered.findIndex((image) => image.id === sourceId);
    const target = ordered.findIndex((image) => image.id === targetId);
    if (source < 0 || target < 0 || source === target) return;
    const next = [...ordered];
    const sourceImage = next[source];
    if (!sourceImage) return;
    next.splice(source, 1);
    next.splice(target, 0, sourceImage);
    props.onReorder(props.group, next);
  };

  return (
    <section aria-labelledby={`image-group-${props.group}`} className="overflow-hidden rounded-[12px] border border-[#E3E6EF] bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F5] px-4 py-3 sm:px-5">
        <div>
          <h2 id={`image-group-${props.group}`} className="text-[15px] font-bold text-[#1A1A2E]">{props.label}</h2>
          <p className="mt-0.5 text-[12px] text-[#6B7399]">{ordered.length}개 · 드래그/이동 버튼으로 정렬</p>
        </div>
        <button type="button" onClick={() => props.onAdd(props.initialType)} disabled={props.disabled || props.busy} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#000666] px-4 text-[12px] font-bold text-white hover:bg-[#1A1A6E] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
          <Plus size={15} aria-hidden="true" />이미지 추가
        </button>
      </header>
      {ordered.length === 0 ? (
        <div className="px-4 py-8 text-center sm:px-5">
          <p className="text-[13px] font-bold text-[#4A5270]">등록된 이미지가 없습니다</p>
          <p className="mt-1 text-[12px] leading-5 text-[#6B7399]">추가 버튼으로 첫 이미지를 등록해 주세요.</p>
        </div>
      ) : (
        <div role="list" className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {ordered.map((image, index) => (
            <div role="listitem" key={image.id}>
              <ImageCard
                image={image}
                disabled={props.disabled}
                busy={props.busy}
                isFirst={index === 0}
                isLast={index === ordered.length - 1}
                onEdit={props.onEdit}
                onVisibility={props.onVisibility}
                onRepresentative={props.onRepresentative}
                onTrash={props.onTrash}
                onMove={move}
                onDrop={drop}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
