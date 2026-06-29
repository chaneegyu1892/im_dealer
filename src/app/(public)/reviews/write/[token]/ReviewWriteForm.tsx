"use client";

import { useRef, useState } from "react";
import { Star, CheckCircle2, ImagePlus, X, Loader2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/Button";

interface ReviewWriteFormProps {
  token: string;
  vehicleName: string | null;
  customerDisplayName: string;
}

const MIN_LEN = 10;
const MAX_LEN = 1000;
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export function ReviewWriteForm({ token, vehicleName, customerDisplayName }: ReviewWriteFormProps) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const length = content.length;
  const tooShort = length > 0 && length < MIN_LEN;
  const tooLong = length > MAX_LEN;
  const canSubmit =
    !submitting &&
    !uploading &&
    length >= MIN_LEN &&
    length <= MAX_LEN &&
    rating >= 1 &&
    rating <= 5;
  const remainingSlots = MAX_IMAGES - imageUrls.length;

  async function uploadOne(file: File): Promise<string | null> {
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(`'${file.name}'은(는) 지원하지 않는 형식입니다. (JPG/PNG/WEBP)`);
      return null;
    }

    let prepared: File | Blob;
    try {
      prepared = await imageCompression(file, {
        maxSizeMB: 4.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.85,
      });
    } catch (err) {
      console.error("[image-compression]", err);
      setError(`'${file.name}' 이미지 처리에 실패했습니다.`);
      return null;
    }

    if (prepared.size > MAX_FILE_SIZE) {
      setError(`'${file.name}'은(는) 압축 후에도 5MB를 초과해 업로드할 수 없습니다.`);
      return null;
    }

    const fd = new FormData();
    fd.append("file", prepared, file.name);
    const res = await fetch(`/api/reviews/submit/${token}/image`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      setError(json?.error ?? "이미지 업로드에 실패했습니다.");
      return null;
    }
    return json.data.url as string;
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const slots = MAX_IMAGES - imageUrls.length;
      const accept = Array.from(files).slice(0, slots);
      const uploaded: string[] = [];
      for (const f of accept) {
        const url = await uploadOne(f);
        if (url) uploaded.push(url);
      }
      if (uploaded.length > 0) {
        setImageUrls((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/submit/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          content: content.trim(),
          imageUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "후기 제출 중 오류가 발생했습니다.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="t-card p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center">
          <CheckCircle2 size={22} className="text-brand" />
        </div>
        <p className="mt-4 text-[16px] font-extrabold text-ink">후기가 접수되었어요</p>
        <p className="mt-2 text-[13px] leading-relaxed text-g1">
          담당 어드민 검토 후 공개됩니다.
          <br />
          소중한 의견 감사합니다.
        </p>
      </div>
    );
  }

  const displayRating = hover ?? rating;

  return (
    <div className="t-card p-5 space-y-6">
      <div>
        <label className="block text-[13px] font-extrabold text-ink mb-3">별점</label>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= displayRating;
            return (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                aria-label={`${n}점`}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  size={32}
                  className={
                    filled
                      ? "fill-[#FFB020] text-[#FFB020]"
                      : "fill-transparent text-g3"
                  }
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
          <span className="ml-2 text-[13px] font-bold text-g1">{displayRating}점</span>
        </div>
      </div>

      <div>
        <label htmlFor="review-content" className="block text-[13px] font-extrabold text-ink mb-2">
          후기 내용
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder={
            vehicleName
              ? `${vehicleName} 이용 경험을 솔직하게 적어주세요. (최소 ${MIN_LEN}자)`
              : `이용 경험을 솔직하게 적어주세요. (최소 ${MIN_LEN}자)`
          }
          className="w-full rounded-[14px] border border-line2 bg-sec px-4 py-3 text-[14px] text-ink placeholder:text-g2 focus:outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 resize-none"
        />
        <div className="mt-1.5 flex items-center justify-between text-[12px]">
          <span
            className={
              tooShort
                ? "text-[#D17C00]"
                : tooLong
                ? "text-[#C0392B]"
                : "text-g2"
            }
          >
            {tooShort
              ? `${MIN_LEN}자 이상 입력해주세요`
              : tooLong
              ? `${MAX_LEN}자 이내로 작성해주세요`
              : `${MIN_LEN}자 이상 ${MAX_LEN}자 이내`}
          </span>
          <span
            className={tooLong ? "text-[#C0392B] font-bold" : "text-g2"}
          >
            {length}/{MAX_LEN}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[13px] font-extrabold text-ink">
            사진 (선택)
          </label>
          <span className="text-[12px] text-g2">
            {imageUrls.length}/{MAX_IMAGES}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {imageUrls.map((url, idx) => (
            <div
              key={url}
              className="relative aspect-square rounded-[12px] overflow-hidden border border-line2 bg-sec"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`첨부 이미지 ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
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
              className="aspect-square rounded-[12px] border border-dashed border-line2 bg-sec flex flex-col items-center justify-center gap-1 text-g2 hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
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

        <p className="mt-1.5 text-[11px] text-g2">
          최대 {MAX_IMAGES}장 · JPG/PNG/WEBP · 큰 사진은 자동으로 줄어 업로드됩니다
        </p>
      </div>

      {error && (
        <p className="text-[13px] text-[#C0392B] bg-[#FDECEA] border border-[#F5C6CB] rounded-[12px] px-3 py-2">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitting ? "제출 중..." : "후기 제출하기"}
      </Button>

      <p className="text-[11px] text-g2 leading-relaxed text-center">
        이름은 &lsquo;{customerDisplayName}&rsquo; 형태로 마스킹되어 표시됩니다.
      </p>
    </div>
  );
}
