"use client";

import { useEffect, useRef, useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ReviewImageUploader } from "./ReviewImageUploader";

interface ReviewWriteFormProps {
  token: string;
  vehicleName: string | null;
  customerDisplayName: string;
}

interface PendingReviewImage {
  id: string;
  url: string;
}

const MIN_LEN = 10;
const MAX_LEN = 1000;
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

function releaseEndpoint(token: string) {
  return `/api/reviews/submit/${token}/image/release`;
}

function takePendingIds(
  pending: PendingReviewImage[],
  claimed: Set<string>,
  ids?: readonly string[],
): string[] {
  const target = ids ? new Set(ids) : null;
  const next: string[] = [];
  for (const image of pending) {
    if (target && !target.has(image.id)) continue;
    if (claimed.has(image.id)) continue;
    claimed.add(image.id);
    next.push(image.id);
  }
  return next;
}

function releaseReservedImages(token: string, uploadIds: string[], unload: boolean) {
  if (uploadIds.length === 0) return;

  const url = releaseEndpoint(token);
  const body = JSON.stringify({ uploadIds });

  if (unload && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const queued = navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    } catch (error) {
      console.error("[ReviewWriteForm] sendBeacon release failed", error);
    }
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((error) => {
    console.error("[ReviewWriteForm] image quota release failed", error);
  });
}

export function ReviewWriteForm({ token, vehicleName, customerDisplayName }: ReviewWriteFormProps) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<PendingReviewImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<PendingReviewImage[]>([]);
  const submittedRef = useRef(false);
  const claimedReleaseIdsRef = useRef<Set<string>>(new Set());

  imagesRef.current = images;
  submittedRef.current = submitted;
  const imageUrls = images.map((image) => image.url);

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

  async function uploadOne(file: File): Promise<PendingReviewImage | null> {
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
    if (!res.ok || !json?.success || typeof json?.data?.id !== "string" || typeof json?.data?.url !== "string") {
      setError(json?.error ?? "이미지 업로드에 실패했습니다.");
      return null;
    }
    return { id: json.data.id as string, url: json.data.url as string };
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const slots = MAX_IMAGES - imagesRef.current.length;
      const accept = Array.from(files).slice(0, slots);
      const uploaded: PendingReviewImage[] = [];
      for (const f of accept) {
        const image = await uploadOne(f);
        if (image) uploaded.push(image);
      }
      if (uploaded.length > 0) {
        setImages((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    const target = imagesRef.current[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (!target) return;
    const uploadIds = takePendingIds(imagesRef.current, claimedReleaseIdsRef.current, [target.id]);
    releaseReservedImages(token, uploadIds, false);
  }

  useEffect(() => {
    const releaseUnused = (unload: boolean) => {
      if (submittedRef.current) return;
      const uploadIds = takePendingIds(imagesRef.current, claimedReleaseIdsRef.current);
      releaseReservedImages(token, uploadIds, unload);
    };

    const onBeforeUnload = () => releaseUnused(true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      releaseUnused(false);
    };
  }, [token]);

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
      for (const image of imagesRef.current) {
        claimedReleaseIdsRef.current.add(image.id);
      }
      setSubmitted(true);
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-card border border-border-subtle bg-surface p-6 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
          <CheckCircle2 size={22} className="text-brand" />
        </div>
        <p className="mt-4 text-[16px] font-extrabold text-text-strong">후기가 접수되었어요</p>
        <p className="mt-2 text-[13px] leading-relaxed text-text-body">
          담당 어드민 검토 후 공개됩니다.
          <br />
          소중한 의견 감사합니다.
        </p>
      </div>
    );
  }

  const displayRating = hover ?? rating;

  return (
    <div className="space-y-6 rounded-card border border-border-subtle bg-surface p-5 shadow-card">
      <div>
        <label className="mb-3 block text-[13px] font-extrabold text-text-strong">별점</label>
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
                      ? "fill-status-warning text-status-warning"
                      : "fill-transparent text-border-strong"
                  }
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
          <span className="ml-2 text-[13px] font-bold text-text-body">{displayRating}점</span>
        </div>
      </div>

      <div>
        <label htmlFor="review-content" className="mb-2 block text-[13px] font-extrabold text-text-strong">
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
          className="w-full resize-none rounded-[14px] border border-border-subtle bg-surface-soft px-4 py-3 text-[14px] text-text-strong placeholder:text-text-muted focus:border-brand focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus-ring/20"
        />
        <div className="mt-1.5 flex items-center justify-between text-[12px]">
          <span
            className={
              tooShort
                ? "text-status-warning"
                : tooLong
                ? "text-status-danger"
                : "text-text-muted"
            }
          >
            {tooShort
              ? `${MIN_LEN}자 이상 입력해주세요`
              : tooLong
              ? `${MAX_LEN}자 이내로 작성해주세요`
              : `${MIN_LEN}자 이상 ${MAX_LEN}자 이내`}
          </span>
          <span
            className={tooLong ? "font-bold text-status-danger" : "text-text-muted"}
          >
            {length}/{MAX_LEN}
          </span>
        </div>
      </div>

      <ReviewImageUploader
        fileInputRef={fileInputRef}
        imageUrls={imageUrls}
        uploading={uploading}
        maxImages={MAX_IMAGES}
        onPickFiles={onPickFiles}
        onRemoveImage={removeImage}
      />

      {error && (
        <InlineAlert variant="danger">
          {error}
        </InlineAlert>
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

      <p className="text-center text-[11px] leading-relaxed text-text-muted">
        이름은 &lsquo;{customerDisplayName}&rsquo; 형태로 마스킹되어 표시됩니다.
      </p>
    </div>
  );
}
