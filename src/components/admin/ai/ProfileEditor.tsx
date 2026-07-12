"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { z } from "zod";
import { parseOverlapProfile, type FuelGroup } from "@/lib/recommend/overlap-profile";
import type { VehicleAiConfigDto } from "@/types/admin-ai";
import { changeProfileFuel, initialProfileDraft } from "./profile-draft";
import ProfileScoreEditor from "./ProfileScoreEditor";

const savedResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    vehicleId: z.string(),
    scoreMatrix: z.unknown(),
    highlights: z.array(z.string()),
    aiCaption: z.string().nullable(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
});
const conflictResponseSchema = z.object({ currentUpdatedAt: z.string().optional() });

export interface SavedProfileState {
  readonly id: string;
  readonly profile: unknown;
  readonly profileState: "valid" | "legacy" | "invalid";
  readonly fuelGroup: FuelGroup | null;
  readonly highlights: readonly string[];
  readonly aiCaption: string | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

interface Props {
  readonly row: VehicleAiConfigDto;
  readonly onClose: () => void;
  readonly onSaved: (vehicleId: string, state: SavedProfileState) => void;
}

export default function ProfileEditor({ row, onClose, onSaved }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(() => initialProfileDraft(row));
  const [isActive, setIsActive] = useState(row.config?.isActive ?? false);
  const [highlights, setHighlights] = useState([...(row.config?.highlights ?? [])]);
  const [caption, setCaption] = useState(row.config?.aiCaption ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(row.config?.updatedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const submit = async (action: "save" | "deactivate") => {
    setSaving(true);
    setMessage(null);
    try {
      const body = action === "deactivate"
        ? { action, vehicleId: row.vehicle.id, expectedUpdatedAt }
        : {
            action: row.config ? "update" : "create",
            vehicleId: row.vehicle.id,
            ...(row.config ? { expectedUpdatedAt } : {}),
            profile,
            isActive,
            highlights,
            aiCaption: caption.trim() || null,
          };
      const response = await fetch("/api/admin/ai/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();
      if (response.status === 409) {
        const parsedConflict = conflictResponseSchema.safeParse(result);
        if (parsedConflict.success && parsedConflict.data.currentUpdatedAt) {
          setExpectedUpdatedAt(parsedConflict.data.currentUpdatedAt);
        }
        setConflict(true);
        setMessage("다른 관리자의 변경이 감지되었습니다. 최신 상태를 불러온 뒤 다시 저장하세요.");
        return;
      }
      if (!response.ok) {
        setMessage("저장하지 못했습니다. 필수 항목과 운영 상태를 확인하세요.");
        return;
      }
      const parsed = savedResponseSchema.safeParse(result);
      if (!parsed.success) {
        setMessage("저장 응답을 확인하지 못했습니다.");
        return;
      }
      const persistedProfile = parseOverlapProfile(parsed.data.data.scoreMatrix);
      onSaved(row.vehicle.id, {
        id: parsed.data.data.id,
        profile: parsed.data.data.scoreMatrix,
        profileState: persistedProfile.kind,
        fuelGroup: persistedProfile.kind === "valid" ? persistedProfile.profile.fuelGroup : null,
        highlights: parsed.data.data.highlights,
        aiCaption: parsed.data.data.aiCaption,
        isActive: parsed.data.data.isActive,
        updatedAt: parsed.data.data.updatedAt,
      });
      router.refresh();
      onClose();
    } catch {
      setMessage("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const excluded = row.exclusion !== null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`${row.vehicle.name} 추천 프로필 편집`}>
      <div className="flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#E8EAF2] bg-[#F8F9FC] p-4 sm:p-5">
          <div>
            <h3 className="text-base font-bold text-[#1A1A2E]">{row.vehicle.name} 추천 프로필</h3>
            <p className="mt-1 text-xs text-[#9BA4C0]">{row.vehicle.brand} · {row.vehicle.category} · {row.vehicle.slug}</p>
          </div>
          <button aria-label="편집기 닫기" onClick={onClose} className="rounded-full p-2 hover:bg-white"><X size={18} /></button>
        </header>

        <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
          {excluded && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">PDF 제외 차량입니다. 프로필 저장과 활성화가 차단됩니다.</p>}
          {(row.profileState === "legacy" || row.profileState === "invalid") && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">이전/손상 설정입니다. 새 v2 프로필로 저장하거나 즉시 비활성화할 수 있습니다.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-[#1A1A2E]">연료 그룹
              <select value={profile.fuelGroup} onChange={(event) => {
                const fuel = ["ICE", "HEV", "EV"].find((value): value is FuelGroup => value === event.target.value);
                if (fuel) setProfile(changeProfileFuel(profile, fuel));
              }} className="mt-2 w-full rounded-xl border border-[#E8EAF2] px-3 py-2 font-normal">
                <option value="ICE">ICE</option><option value="HEV">HEV</option><option value="EV">EV</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[#1A1A2E]">회사 우선순위 (0~100)
              <input type="number" min={0} max={100} value={profile.companyPriority} onChange={(event) => setProfile({ ...profile, companyPriority: Math.min(100, Math.max(0, Number(event.target.value))) })} className="mt-2 w-full rounded-xl border border-[#E8EAF2] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-bold text-[#1A1A2E]">수익 우선순위 (0~100)
              <input type="number" min={0} max={100} value={profile.profitPriority} onChange={(event) => setProfile({ ...profile, profitPriority: Math.min(100, Math.max(0, Number(event.target.value))) })} className="mt-2 w-full rounded-xl border border-[#E8EAF2] px-3 py-2 font-normal" />
            </label>
          </div>
          <ProfileScoreEditor profile={profile} onChange={setProfile} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#1A1A2E]">하이라이트 (쉼표로 구분)
              <input value={highlights.join(", ")} onChange={(event) => setHighlights(event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20))} className="mt-2 w-full rounded-xl border border-[#E8EAF2] px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-bold text-[#1A1A2E]">추천 캡션
              <input value={caption} maxLength={1000} onChange={(event) => setCaption(event.target.value)} className="mt-2 w-full rounded-xl border border-[#E8EAF2] px-3 py-2 font-normal" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#1A1A2E]"><input type="checkbox" checked={isActive} disabled={excluded} onChange={(event) => setIsActive(event.target.checked)} /> 추천 활성화</label>
          {message && <div className={`rounded-xl p-3 text-xs ${conflict ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{message}{conflict && <button onClick={() => { setConflict(false); setMessage("최신 버전으로 다시 저장할 수 있습니다. 작성 중인 값은 유지되었습니다."); router.refresh(); }} className="ml-2 font-bold underline">최신 상태 불러오기</button>}</div>}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[#E8EAF2] bg-[#F8F9FC] p-4">
          {row.config && <button disabled={saving} onClick={() => submit("deactivate")} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-40">비활성화</button>}
          <button disabled={saving || excluded || conflict} onClick={() => submit("save")} className="flex items-center gap-2 rounded-xl bg-[#000666] px-5 py-2 text-xs font-bold text-white disabled:opacity-40"><Save size={15} />{saving ? "저장 중" : "프로필 저장"}</button>
        </footer>
      </div>
    </div>
  );
}
