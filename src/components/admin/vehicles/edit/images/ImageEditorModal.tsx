"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import type { AdminVehicleImage } from "@/types/admin";
import { VEHICLE_IMAGE_TYPES, type VehicleImageTypeValue } from "@/lib/vehicle-images/groups";
import {
  fieldClass,
  focusRing,
  IMAGE_TYPE_LABELS,
  imageMutationResultSchema,
  type ImageMutationResult,
  readApiResult,
  VEHICLE_IMAGE_UPLOAD_ACCEPT,
  VEHICLE_IMAGE_UPLOAD_FORMATS,
} from "./image-ui";

type Props = {
  readonly vehicleId: string;
  readonly initialType: VehicleImageTypeValue;
  readonly image: AdminVehicleImage | null;
  readonly expectedImageRevision: number;
  readonly onClose: () => void;
  readonly onSaved: (result: ImageMutationResult) => void | Promise<void>;
  readonly onConflict: (code: string) => void;
};

export function ImageEditorModal({ vehicleId, initialType, image, expectedImageRevision, onClose, onSaved, onConflict }: Props) {
  const [title, setTitle] = useState(image?.title ?? "");
  const [type, setType] = useState<VehicleImageTypeValue>(image?.type ?? initialType);
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const submitInFlight = useRef(false);
  const lifecycle = useRef({ mounted: true, controller: null as AbortController | null });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = lifecycle.current;
    current.mounted = true;
    firstFieldRef.current?.focus();
    return () => {
      current.mounted = false;
      current.controller?.abort();
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)") ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitInFlight.current) return;
    if (!image && !file) {
      setError("업로드할 이미지 파일을 선택해 주세요.");
      return;
    }
    submitInFlight.current = true;
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    lifecycle.current.controller = controller;
    const url = image
      ? `/api/admin/vehicles/${vehicleId}/images/${image.id}`
      : `/api/admin/vehicles/${vehicleId}/images`;
    const init: RequestInit = image
      ? {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: image.updatedAt, expectedImageRevision, title: title.trim(), type }),
        }
      : { method: "POST", body: createUploadBody({ file, title, type, visible }) };
    init.signal = controller.signal;
    try {
      const result = await readApiResult(await fetch(url, init), imageMutationResultSchema);
      if (!lifecycle.current.mounted || controller.signal.aborted) return;
      if (!result.ok) {
        if (result.status === 409) {
          onConflict(result.code);
          onClose();
          return;
        }
        setError(result.message);
        return;
      }
      await onSaved({
        ...result.data,
        image: {
          ...result.data.image,
          isRepresentative: image?.isRepresentative ?? false,
        },
      });
      if (!lifecycle.current.mounted || controller.signal.aborted) return;
      onClose();
    } catch (caught) {
      if (!lifecycle.current.mounted || controller.signal.aborted) return;
      if (!(caught instanceof Error)) throw caught;
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      if (lifecycle.current.mounted && !controller.signal.aborted) {
        lifecycle.current.controller = null;
        submitInFlight.current = false;
        setSaving(false);
      }
    }
  };

  return (
    <motion.div data-testid="image-editor-motion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} type="button" aria-label="이미지 편집 닫기" onClick={onClose} disabled={saving} className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" />
      <motion.section initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.18, ease: "easeOut" }} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="image-editor-title" className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[16px] bg-white p-5 shadow-2xl sm:max-w-[520px] sm:rounded-[16px] sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="image-editor-title" className="text-[18px] font-bold text-[#1A1A2E]">{image ? "이미지 수정" : "이미지 추가"}</h2>
            <p className="mt-1 text-[13px] leading-5 text-[#6B7399]">제목과 유형은 고객 화면의 이미지 구성을 결정합니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className={`flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-[#6B7399] hover:bg-[#F0F2F8] disabled:cursor-wait disabled:opacity-50 ${focusRing}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit} className="space-y-4">
          {!image && (
            <div>
              <label htmlFor="vehicle-image-file" className="mb-1.5 block text-[13px] font-bold text-[#4A5270]">이미지 파일</label>
              <input ref={firstFieldRef} id="vehicle-image-file" type="file" accept={VEHICLE_IMAGE_UPLOAD_ACCEPT} required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={`${fieldClass} py-2 file:mr-3 file:rounded-[6px] file:border-0 file:bg-[#ECEEF9] file:px-3 file:py-1.5 file:text-[#000666]`} />
              <p className="mt-1.5 text-[12px] text-[#6B7399]">{VEHICLE_IMAGE_UPLOAD_FORMATS} 파일</p>
            </div>
          )}
          <div>
            <label htmlFor="vehicle-image-title" className="mb-1.5 block text-[13px] font-bold text-[#4A5270]">이미지 제목</label>
            <input ref={image ? firstFieldRef : undefined} id="vehicle-image-title" value={title} required maxLength={120} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="예: 전면 45도" />
          </div>
          <div>
            <label htmlFor="vehicle-image-type" className="mb-1.5 block text-[13px] font-bold text-[#4A5270]">이미지 유형</label>
            <select id="vehicle-image-type" value={type} onChange={(event) => setType(toImageType(event.target.value))} className={fieldClass}>
              {VEHICLE_IMAGE_TYPES.map((value) => <option key={value} value={value}>{IMAGE_TYPE_LABELS[value]}</option>)}
            </select>
          </div>
          {!image && (
            <label className="flex min-h-11 items-center gap-3 rounded-[8px] border border-[#E8EAF0] px-3 text-[13px] font-medium text-[#4A5270]">
              <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-4 w-4 accent-[#000666]" />
              업로드 후 고객 화면에 노출
            </label>
          )}
          {error && <div role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-700">{error}</div>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className={`min-h-11 rounded-[8px] border border-[#D9DDEA] px-5 text-[13px] font-bold text-[#4A5270] hover:bg-[#F8F9FC] ${focusRing}`}>취소</button>
            <button type="submit" disabled={saving} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#000666] px-5 text-[13px] font-bold text-white hover:bg-[#1A1A6E] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}>
              <Upload size={16} aria-hidden="true" />
              {saving ? "처리 중..." : image ? "변경사항 저장" : "이미지 업로드"}
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}

type UploadFields = {
  readonly file: File | null;
  readonly title: string;
  readonly type: VehicleImageTypeValue;
  readonly visible: boolean;
};

function createUploadBody({ file, title, type, visible }: UploadFields): FormData {
  const body = new FormData();
  if (file) body.append("file", file);
  body.append("title", title.trim());
  body.append("type", type);
  body.append("isVisible", String(visible));
  return body;
}

function toImageType(value: string): VehicleImageTypeValue {
  const parsed = VEHICLE_IMAGE_TYPES.find((type) => type === value);
  return parsed ?? "MAIN";
}
