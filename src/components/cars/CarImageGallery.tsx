"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseStorageUrl } from "@/lib/image-url";

export function CarImageGallery({
  vehicleName,
  images,
}: {
  vehicleName: string;
  images: string[];
}) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  if (images.length === 0) return null;

  return (
    <motion.section
      initial={false}
      className="t-card overflow-hidden shadow-soft"
    >
      <div className="flex items-center gap-2 px-5 py-4 md:px-6">
        <Images size={15} className="text-ink-label" />
        <h2 className="text-[15px] font-extrabold text-ink">차량 이미지</h2>
        <span className="ml-auto text-[12px] font-bold text-ink-label">
          {activeImageIdx + 1} / {images.length}
        </span>
      </div>
      <div className="relative aspect-video overflow-hidden bg-surface-muted">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeImageIdx}
            className="absolute inset-0"
            initial={false}
            exit={{ opacity: 0.85 }}
            transition={{ duration: 0.25 }}
          >
            <Image
              src={images[activeImageIdx]}
              alt={`${vehicleName} 이미지 ${activeImageIdx + 1}`}
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              unoptimized={isSupabaseStorageUrl(images[activeImageIdx])}
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 py-4 md:px-6">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveImageIdx(index)}
              className={cn(
                "shrink-0 overflow-hidden rounded-[10px] border-2 transition-all duration-150",
                "h-[54px] w-24",
                index === activeImageIdx
                  ? "border-brand"
                  : "border-transparent opacity-60 hover:opacity-90",
              )}
            >
              <Image
                src={url}
                alt={`썸네일 ${index + 1}`}
                width={96}
                height={54}
                unoptimized={isSupabaseStorageUrl(url)}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </motion.section>
  );
}
