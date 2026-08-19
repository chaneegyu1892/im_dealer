"use client";

import { useState, type ComponentProps } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseStorageUrl } from "@/lib/image-url";

type NextImageProps = ComponentProps<typeof Image>;

interface ImageWithFallbackProps
  extends Omit<NextImageProps, "src" | "alt" | "onError" | "unoptimized"> {
  /** 이미지 주소. null·빈 문자열이면 곧바로 폴백을 그린다. */
  readonly src: string | null | undefined;
  readonly alt: string;
  /** 폴백 안내 문구. null 이면 좁은 칸(썸네일)용으로 아이콘만 남긴다. */
  readonly fallbackLabel?: string | null;
  /** 폴백 박스에 덧붙일 레이아웃 클래스 */
  readonly fallbackClassName?: string;
}

/**
 * CDN 객체가 사라진 이미지가 브라우저 기본 "깨진 이미지" 아이콘으로 남지 않게 하는 공용 래퍼.
 *
 * - 주소가 없거나 로드가 실패하면 기존 "이미지 준비 중" 자리표시자와 같은 톤의 폴백을 그린다.
 * - 실패한 주소를 기억하므로 갤러리에서 다른 슬라이드로 넘어가면 폴백이 자동으로 풀린다.
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackLabel = "이미지 준비 중",
  fallbackClassName,
  className,
  ...imageProps
}: ImageWithFallbackProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={`${alt} 이미지를 불러올 수 없음`}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center",
          fallbackClassName,
        )}
      >
        <ImageOff size={16} strokeWidth={1.5} className="text-text-muted" aria-hidden="true" />
        {fallbackLabel !== null && (
          <span className="text-[12px] font-bold leading-tight text-text-muted">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <Image
      {...imageProps}
      src={src}
      alt={alt}
      className={className}
      unoptimized={isSupabaseStorageUrl(src)}
      onError={() => setFailedSrc(src)}
    />
  );
}
