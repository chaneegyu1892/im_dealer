"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Images, RefreshCw } from "lucide-react";
import { z } from "zod";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import type { VehicleImageGroup, VehicleImageTypeValue } from "@/lib/vehicle-images/groups";
import { ImageEditorModal } from "./ImageEditorModal";
import { ImageGroup } from "./ImageGroup";
import { ImageTrash } from "./ImageTrash";
import {
  belongsToGroup,
  errorMessage,
  focusRing,
  IMAGE_GROUPS,
  imageListResultSchema,
  imageMutationResultSchema,
  imageReorderResultSchema,
  imageTitle,
  knownErrorMessage,
  purgeResultSchema,
  readApiResult,
  representativeResultSchema,
  type ApiResult,
} from "./image-ui";

type EditorState = { readonly image: AdminVehicleImage | null; readonly type: VehicleImageTypeValue };
type RequestOptions<T> = {
  readonly url: string;
  readonly init?: RequestInit;
  readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  readonly onSuccess: (data: T) => void;
};
type InlineError = { readonly message: string; readonly reload: boolean };
export type VehicleImageSnapshot = Pick<AdminVehicleDetail, "images" | "thumbnailImageId" | "thumbnailUrl" | "updatedAt" | "imageRevision">;
type ImageCommit = {
  readonly images: AdminVehicleImage[];
  readonly representativeId: string | null;
  readonly imageRevision: number;
  readonly vehicleUpdatedAt: string;
  readonly thumbnailUrl: string;
};

export function ImageTab({
  vehicle,
  canPurgeImages = false,
  onVehicleImagesChanged,
}: {
  readonly vehicle: AdminVehicleDetail;
  readonly canPurgeImages?: boolean;
  readonly onVehicleImagesChanged?: (snapshot: VehicleImageSnapshot) => void;
}) {
  const [images, setImages] = useState<readonly AdminVehicleImage[]>(vehicle.images);
  const [representativeId, setRepresentativeId] = useState(vehicle.thumbnailImageId);
  const [thumbnailUrl, setThumbnailUrl] = useState(vehicle.thumbnailUrl);
  const [imageRevision, setImageRevision] = useState(vehicle.imageRevision);
  const [vehicleUpdatedAt, setVehicleUpdatedAt] = useState(vehicle.updatedAt);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InlineError | null>(null);
  const requestInFlight = useRef(false);
  const lifecycle = useRef({ mounted: true, request: 0, controller: null as AbortController | null });
  const migrationPending = representativeId === null && thumbnailUrl.trim() !== "";

  useEffect(() => {
    const current = lifecycle.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.request += 1;
      current.controller?.abort();
    };
  }, []);

  const commitImages = (commit: ImageCommit) => {
    setImages(commit.images);
    setRepresentativeId(commit.representativeId);
    setThumbnailUrl(commit.thumbnailUrl);
    setImageRevision(commit.imageRevision);
    setVehicleUpdatedAt(commit.vehicleUpdatedAt);
    onVehicleImagesChanged?.({
      images: commit.images,
      thumbnailImageId: commit.representativeId,
      thumbnailUrl: commit.thumbnailUrl,
      updatedAt: commit.vehicleUpdatedAt,
      imageRevision: commit.imageRevision,
    });
  };

  const handleFailure = (result: Extract<ApiResult<unknown>, { readonly ok: false }>) => {
    setError({ message: knownErrorMessage(result.code) ?? result.message, reload: result.status === 409 });
  };

  const request = async <T,>({ url, init, schema, onSuccess }: RequestOptions<T>) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    const requestId = ++lifecycle.current.request;
    const controller = new AbortController();
    lifecycle.current.controller = controller;
    const isCurrent = () => lifecycle.current.mounted
      && lifecycle.current.request === requestId
      && !controller.signal.aborted;
    setBusy(true);
    setError(null);
    try {
      const result = await readApiResult(await fetch(url, { ...init, signal: controller.signal }), schema);
      if (!isCurrent()) return;
      if (!result.ok) {
        handleFailure(result);
        return;
      }
      lifecycle.current.controller = null;
      requestInFlight.current = false;
      setBusy(false);
      onSuccess(result.data);
    } catch (caught) {
      if (!isCurrent()) return;
      if (!(caught instanceof Error)) throw caught;
      setError({ message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", reload: true });
    } finally {
      if (isCurrent()) {
        lifecycle.current.controller = null;
        requestInFlight.current = false;
        setBusy(false);
      }
    }
  };

  const reload = (minimumImageRevision = -1) => request({
    url: `/api/admin/vehicles/${vehicle.id}/images`,
    schema: imageListResultSchema,
    onSuccess: (next) => {
      if (next.imageRevision < minimumImageRevision) {
        setError({ message: "저장 결과보다 오래된 이미지 상태가 반환되었습니다. 다시 불러와 주세요.", reload: true });
        return;
      }
      commitImages({
        images: next.images,
        representativeId: next.thumbnailImageId,
        thumbnailUrl: next.thumbnailUrl,
        imageRevision: next.imageRevision,
        vehicleUpdatedAt: next.vehicleUpdatedAt,
      });
      setError(null);
    },
  });

  const saveImage = (result: { readonly imageRevision: number }) => reload(result.imageRevision);

  const visibility = (image: AdminVehicleImage) => request({
    url: `/api/admin/vehicles/${vehicle.id}/images/${image.id}/visibility`,
    init: jsonInit("PATCH", { expectedUpdatedAt: image.updatedAt, expectedImageRevision: imageRevision, isVisible: !image.isVisible }),
    schema: imageMutationResultSchema,
    onSuccess: (result) => { void reload(result.imageRevision); },
  });

  const representative = (image: AdminVehicleImage) => request({
    url: `/api/admin/vehicles/${vehicle.id}/images/${image.id}/representative`,
    init: jsonInit("POST", {
      expectedImageUpdatedAt: image.updatedAt,
      expectedImageRevision: imageRevision,
      expectedVehicleUpdatedAt: vehicleUpdatedAt,
    }),
    schema: representativeResultSchema,
    onSuccess: (result) => { void reload(result.imageRevision); },
  });

  const trash = (image: AdminVehicleImage) => {
    if (!confirm(`“${imageTitle(image)}” 이미지를 휴지통으로 이동하시겠습니까?`)) return;
    request({
      url: `/api/admin/vehicles/${vehicle.id}/images/${image.id}`,
      init: jsonInit("DELETE", { expectedUpdatedAt: image.updatedAt, expectedImageRevision: imageRevision }),
      schema: imageMutationResultSchema,
      onSuccess: (result) => { void reload(result.imageRevision); },
    });
  };

  const restore = (image: AdminVehicleImage) => request({
    url: `/api/admin/vehicles/${vehicle.id}/images/${image.id}/restore`,
    init: jsonInit("POST", { expectedUpdatedAt: image.updatedAt, expectedImageRevision: imageRevision }),
    schema: imageMutationResultSchema,
    onSuccess: (result) => { void reload(result.imageRevision); },
  });

  const purge = (image: AdminVehicleImage) => {
    if (!confirm(`“${imageTitle(image)}” 이미지를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    request({
      url: `/api/admin/vehicles/${vehicle.id}/images/${image.id}/purge`,
      init: jsonInit("DELETE", { expectedUpdatedAt: image.updatedAt, expectedImageRevision: imageRevision }),
      schema: purgeResultSchema,
      onSuccess: (result) => { void reload(result.imageRevision); },
    });
  };

  const reorder = (group: VehicleImageGroup, ordered: readonly AdminVehicleImage[]) => request({
    url: `/api/admin/vehicles/${vehicle.id}/images/reorder`,
    init: jsonInit("PATCH", { group, expectedImageRevision: imageRevision, items: ordered.map((image) => ({ id: image.id, expectedUpdatedAt: image.updatedAt })) }),
    schema: imageReorderResultSchema,
    onSuccess: (result) => { void reload(result.imageRevision); },
  });

  const active = images.filter((image) => image.deletedAt === null);
  const trashed = images.filter((image) => image.deletedAt !== null);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-[12px] border border-[#E3E6EF] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="flex items-center gap-2 text-[18px] font-bold text-[#1A1A2E]"><Images size={20} className="text-[#000666]" aria-hidden="true" />차량 이미지 관리</h1>
          <p className="mt-1 text-[13px] leading-5 text-[#6B7399]">이미지 노출·순서·대표·휴지통 관리</p>
        </div>
        <button type="button" onClick={() => reload()} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D9DDEA] px-4 text-[12px] font-bold text-[#4A5270] hover:bg-[#F8F9FC] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}>
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} aria-hidden="true" />{busy ? "처리 중..." : "새로고침"}
        </button>
      </header>
      {migrationPending && <div role="status" className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"><p className="flex items-center gap-2 text-[13px] font-bold"><AlertTriangle size={16} aria-hidden="true" />대표 이미지 연결 대기 중</p><p className="mt-1 text-[12px] leading-5">레거시 대표 이미지 연결이 완료될 때까지 이미지 변경 기능은 읽기 전용입니다.</p></div>}
      {error && <div role="alert" className="flex flex-col gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{error.message}</span>{error.reload && <button type="button" onClick={() => reload()} disabled={busy} className={`min-h-11 rounded-[8px] border border-red-300 bg-white px-4 text-[12px] font-bold hover:bg-red-50 ${focusRing}`}>최신 상태 다시 불러오기</button>}</div>}
      {IMAGE_GROUPS.map((definition) => <ImageGroup key={definition.group} {...definition} images={active.filter((image) => belongsToGroup(image, definition.group))} disabled={migrationPending} busy={busy} onAdd={(type) => setEditor({ image: null, type })} onEdit={(image) => setEditor({ image, type: image.type })} onVisibility={visibility} onRepresentative={representative} onTrash={trash} onReorder={reorder} />)}
      <ImageTrash images={trashed} disabled={migrationPending} busy={busy} canPurgeImages={canPurgeImages} onRestore={restore} onPurge={purge} />
      <AnimatePresence>
        {editor && <ImageEditorModal key={`${vehicle.id}:${editor.image?.id ?? editor.type}`} vehicleId={vehicle.id} initialType={editor.type} image={editor.image} expectedImageRevision={imageRevision} onClose={() => setEditor(null)} onSaved={saveImage} onConflict={(code) => setError({ message: errorMessage(code, 409), reload: true })} />}
      </AnimatePresence>
    </div>
  );
}

function jsonInit(method: "PATCH" | "POST" | "DELETE", body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
