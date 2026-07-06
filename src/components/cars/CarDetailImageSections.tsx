"use client";

import Image from "next/image";
import {
  Armchair,
  CarFront,
  ChevronDown,
  ChevronUp,
  Images,
  Palette,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import type { VehicleImageItem, VehicleImageKind } from "@/types/api";

const MOBILE_SPEC_PREVIEW_COUNT = 4;

const COLOR_GROUPS = [
  {
    title: "외장 색상",
    types: ["EXTERIOR_COLOR"],
  },
  {
    title: "내장 색상",
    types: ["INTERIOR_COLOR"],
  },
] as const satisfies readonly {
  readonly title: string;
  readonly types: readonly VehicleImageKind[];
}[];

const SPEC_GROUPS = [
  {
    id: "exterior",
    title: "외관 사양",
    icon: CarFront,
    types: ["SPEC_EXTERIOR"],
  },
  {
    id: "interior",
    title: "실내 사양",
    icon: Settings2,
    types: ["SPEC_INTERIOR"],
  },
  {
    id: "seat",
    title: "시트 사양",
    icon: Armchair,
    types: ["SPEC_SEAT"],
  },
  { id: "option", title: "추가 사양 이미지", icon: Images, types: ["SPEC_OPTION"] },
] as const satisfies readonly {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly types: readonly VehicleImageKind[];
}[];

type SpecGroupId = (typeof SPEC_GROUPS)[number]["id"];

export function CarDetailImageSections({
  vehicleName,
  images,
}: {
  vehicleName: string;
  images: readonly VehicleImageItem[];
}) {
  const colorGroups = COLOR_GROUPS.map((group) => ({
    ...group,
    images: filterByTypes(images, group.types),
  })).filter((group) => group.images.length > 0);
  const colorImageCount = colorGroups.reduce((total, group) => total + group.images.length, 0);
  const hasSpecImages = SPEC_GROUPS.some((group) => filterByTypes(images, group.types).length > 0);
  const [expandedSpecGroups, setExpandedSpecGroups] = useState<ReadonlySet<SpecGroupId>>(
    () => new Set(),
  );

  if (colorImageCount === 0 && !hasSpecImages) return null;

  const toggleSpecGroup = (groupId: SpecGroupId) => {
    setExpandedSpecGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {colorImageCount > 0 && (
        <ImagePanel
          title="색상 이미지"
          count={colorImageCount}
          icon={Palette}
        >
          <div className="space-y-5 py-5">
            {colorGroups.map((group) => (
              <ColorImageRail
                key={group.title}
                title={group.title}
                vehicleName={vehicleName}
                images={group.images}
              />
            ))}
          </div>
        </ImagePanel>
      )}

      {SPEC_GROUPS.map((group) => {
        const groupImages = filterByTypes(images, group.types);
        if (groupImages.length === 0) return null;
        const isExpanded = expandedSpecGroups.has(group.id);
        const collapseOnAllViewports = group.id === "option";
        const remainingCount = groupImages.length - MOBILE_SPEC_PREVIEW_COUNT;
        const needsMoreButton = remainingCount > 0;
        return (
          <ImagePanel
            key={group.id}
            title={group.title}
            count={groupImages.length}
            icon={group.icon}
          >
            <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-3 md:px-6">
              {groupImages.map((image, index) => {
                const isPreviewImage = index < MOBILE_SPEC_PREVIEW_COUNT || isExpanded;
                return (
                  <ImageTile
                    key={image.id}
                    image={image}
                    vehicleName={vehicleName}
                    index={index}
                    className={isPreviewImage ? "" : collapseOnAllViewports ? "hidden" : "max-sm:hidden"}
                  />
                );
              })}
            </div>
            {needsMoreButton && (
              <div className={collapseOnAllViewports ? "px-5 pb-5" : "px-5 pb-5 sm:hidden"}>
                <button
                  type="button"
                  onClick={() => toggleSpecGroup(group.id)}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[13px] border border-line bg-surface-soft px-4 text-[13px] font-extrabold text-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                >
                  {isExpanded ? "간단히 보기" : `${remainingCount}장 더보기`}
                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            )}
          </ImagePanel>
        );
      })}
    </div>
  );
}

function ColorImageRail({
  title,
  vehicleName,
  images,
}: {
  title: string;
  vehicleName: string;
  images: readonly VehicleImageItem[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-5 md:px-6">
        <h3 className="text-[13px] font-extrabold text-ink">{title}</h3>
        <span className="shrink-0 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-bold text-ink-label">
          {images.length}장
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 md:px-6">
        {images.map((image, index) => (
          <ImageTile
            key={image.id}
            image={image}
            vehicleName={vehicleName}
            index={index}
            className="w-[172px] shrink-0 sm:w-[196px]"
          />
        ))}
      </div>
    </div>
  );
}

function ImagePanel({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="t-card overflow-hidden shadow-soft">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-muted px-5 py-4 md:px-6">
        <span className="t-iconbtn h-8 w-8 bg-brand-soft text-brand">
          <Icon size={15} />
        </span>
        <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-label">
          <Images size={12} />
          {count}장
        </span>
      </div>
      {children}
    </section>
  );
}

function ImageTile({
  image,
  vehicleName,
  index,
  className = "",
}: {
  image: VehicleImageItem;
  vehicleName: string;
  index: number;
  className?: string;
}) {
  const title = image.title ?? `${vehicleName} 이미지`;
  return (
    <figure className={cn(className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-surface-muted">
        <Image
          src={image.storageUrl}
          alt={`${vehicleName} ${title} ${index + 1}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
          unoptimized={isSupabaseStorageUrl(image.storageUrl)}
          className="object-cover"
        />
      </div>
      <figcaption className="mt-2 line-clamp-2 min-h-[34px] text-[12px] font-bold leading-snug text-ink-label">
        {title}
      </figcaption>
    </figure>
  );
}

function filterByTypes(
  images: readonly VehicleImageItem[],
  types: readonly VehicleImageKind[],
): readonly VehicleImageItem[] {
  return images.filter((image) => types.includes(image.type));
}
