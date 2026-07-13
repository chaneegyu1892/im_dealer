import Image from "next/image";
import { ArrowRight, Image as ImageIcon } from "lucide-react";

interface BasicInfoRepresentativePreviewProps {
  readonly vehicleName: string;
  readonly thumbnailUrl: string;
  readonly isLinked: boolean;
  readonly onOpenImages: () => void;
}

export function BasicInfoRepresentativePreview({ vehicleName, thumbnailUrl, isLinked, onOpenImages }: BasicInfoRepresentativePreviewProps) {
  return (
    <section className="h-fit space-y-4 rounded-[12px] border border-[#E8EAF0] bg-white p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="text-[15px] font-bold text-[#1A1A2E]">대표 이미지</h3>
        <p className="mt-1 text-[12px] leading-5 text-[#9BA4C0]">이미지 변경은 이미지 탭에서만 할 수 있습니다.</p>
      </div>
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[8px] border border-[#E8EAF0] bg-[#F8F9FC]">
        {thumbnailUrl ? (
          <Image src={thumbnailUrl} alt={`${vehicleName} 대표 이미지`} fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-[#9BA4C0]">
            <ImageIcon size={32} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[13px] font-semibold text-[#4A5270]">대표 이미지가 없습니다</span>
            <span className="text-[12px] leading-5">이미지 탭에서 대표 이미지를 지정해 주세요.</span>
          </div>
        )}
      </div>
      {thumbnailUrl && <p className="text-[12px] text-[#9BA4C0]">{isLinked ? "이미지 SSOT와 연결된 대표 이미지" : "연결 전 레거시 대표 이미지 (읽기 전용)"}</p>}
      <button type="button" onClick={onOpenImages} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#000666] bg-white px-4 text-[13px] font-bold text-[#000666] transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]">
        이미지 관리로 이동
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
