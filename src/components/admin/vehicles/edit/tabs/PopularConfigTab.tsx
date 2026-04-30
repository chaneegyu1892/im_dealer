"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminPopularConfig, AdminPopularConfigItem } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

interface PopularConfigTabProps {
  vehicleId: string;
}

interface ItemDraft {
  name: string;
  price: string;
  displayOrder: number;
}

interface ConfigDraft {
  name: string;
  note: string;
  displayOrder: string;
  isActive: boolean;
  items: ItemDraft[];
}

const defaultDraft = (): ConfigDraft => ({
  name: "",
  note: "",
  displayOrder: "0",
  isActive: true,
  items: [],
});

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

function ItemEditor({
  items,
  onChange,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
}) {
  const addItem = () => {
    onChange([...items, { name: "", price: "", displayOrder: items.length }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemDraft, value: string | number) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#6B7399]">구성 항목</span>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-[11px] text-[#000666] font-medium hover:underline"
        >
          <Plus size={12} /> 항목 추가
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-[12px] text-[#B0B8D0] py-1">
          항목이 없습니다. 위 버튼으로 추가하세요.
        </p>
      )}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={item.name}
            onChange={(e) => updateItem(index, "name", e.target.value)}
            placeholder="항목명"
            className={inputClass + " flex-1"}
          />
          <input
            value={item.price}
            onChange={(e) => updateItem(index, "price", e.target.value)}
            placeholder="가격"
            type="number"
            min={0}
            className={inputClass + " w-[110px]"}
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px] shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfigForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: ConfigDraft;
  onSave: (draft: ConfigDraft) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<ConfigDraft>(initial);

  const set = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 bg-blue-50/30 border-t border-[#E8EAF0] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-[#6B7399] mb-1">
            구성명 <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="예: 기본 추천 구성"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#6B7399] mb-1">
            표시 순서
          </label>
          <input
            value={draft.displayOrder}
            onChange={(e) => set("displayOrder", e.target.value)}
            type="number"
            min={0}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-bold text-[#6B7399] mb-1">메모</label>
        <input
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="내부 메모 (선택)"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => set("isActive", !draft.isActive)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            draft.isActive ? "bg-[#000666]" : "bg-[#D0D4E8]"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              draft.isActive ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-[12px] text-[#6B7399]">
          {draft.isActive ? "활성" : "비활성"}
        </span>
      </div>
      <ItemEditor items={draft.items} onChange={(items) => set("items", items)} />
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[12px] text-[#6B7399] border border-[#E8EAF0] bg-white rounded-[6px] hover:bg-[#F4F5F8]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={saving || !draft.name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#000666] text-white text-[12px] font-medium rounded-[6px] hover:bg-[#1A1A6E] disabled:opacity-50"
        >
          <Save size={13} />
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

function ConfigRow({
  config,
  vehicleId,
  onUpdated,
  onDeleted,
}: {
  config: AdminPopularConfig;
  vehicleId: string;
  onUpdated: (updated: AdminPopularConfig) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`"${config.name}" 구성을 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/admin/vehicles/${vehicleId}/popular-configs/${config.id}`,
        { method: "DELETE" }
      );
      const result = await resp.json() as { success: boolean };
      if (result.success) onDeleted(config.id);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/admin/vehicles/${vehicleId}/popular-configs/${config.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !config.isActive }),
        }
      );
      const result = await resp.json() as { success: boolean; data: AdminPopularConfig };
      if (result.success) onUpdated(result.data);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (draft: ConfigDraft) => {
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        note: draft.note || null,
        displayOrder: parseInt(draft.displayOrder, 10) || 0,
        isActive: draft.isActive,
        items: draft.items.map((item, i) => ({
          name: item.name,
          price: parseInt(item.price, 10) || 0,
          displayOrder: i,
        })),
      };
      const resp = await fetch(
        `/api/admin/vehicles/${vehicleId}/popular-configs/${config.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await resp.json() as { success: boolean; data: AdminPopularConfig };
      if (result.success) {
        onUpdated(result.data);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const initialDraft: ConfigDraft = {
    name: config.name,
    note: config.note ?? "",
    displayOrder: String(config.displayOrder),
    isActive: config.isActive,
    items: config.items.map((item) => ({
      name: item.name,
      price: String(item.price),
      displayOrder: item.displayOrder,
    })),
  };

  return (
    <div className="border-b border-[#F0F2F8] last:border-b-0">
      <div className="p-4 flex items-center justify-between group hover:bg-[#F8F9FC] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#E5E5FA] flex items-center justify-center text-[#000666] text-[11px] font-bold shrink-0">
            C
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-[#1A1A2E] truncate">
                {config.name}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  config.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#F0F2F8] text-[#9BA4C0]"
                }`}
              >
                {config.isActive ? "활성" : "비활성"}
              </span>
            </div>
            {config.note && (
              <p className="text-[12px] text-[#9BA4C0] truncate mt-0.5">{config.note}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px] text-[#9BA4C0] mr-1">
            항목 {config.items.length}개
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px]"
            title="항목 보기"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleToggleActive}
            disabled={saving}
            className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
            title={config.isActive ? "비활성화" : "활성화"}
          >
            <span className="text-[11px] font-medium">
              {config.isActive ? "OFF" : "ON"}
            </span>
          </button>
          <button
            onClick={() => {
              setEditing(!editing);
              setExpanded(false);
            }}
            className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity"
            title="수정"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && !editing && config.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pl-[52px] space-y-1">
              {config.items.map((item: AdminPopularConfigItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[13px] text-[#4A5270] py-0.5"
                >
                  <span>{item.name}</span>
                  <span className="text-[#6B7399] font-medium">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ConfigForm
              initial={initialDraft}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
              saving={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PopularConfigTab({ vehicleId }: PopularConfigTabProps) {
  const [configs, setConfigs] = useState<AdminPopularConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicleId}/popular-configs`);
      const result = await resp.json() as { success: boolean; data: AdminPopularConfig[] };
      if (result.success) setConfigs(result.data);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  const handleAdd = async (draft: ConfigDraft) => {
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        note: draft.note || null,
        displayOrder: parseInt(draft.displayOrder, 10) || 0,
        isActive: draft.isActive,
        items: draft.items.map((item, i) => ({
          name: item.name,
          price: parseInt(item.price, 10) || 0,
          displayOrder: i,
        })),
      };
      const resp = await fetch(`/api/admin/vehicles/${vehicleId}/popular-configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await resp.json() as { success: boolean; data: AdminPopularConfig };
      if (result.success) {
        setConfigs((prev) => [...prev, result.data]);
        setIsAdding(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdated = (updated: AdminPopularConfig) => {
    setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleted = (id: string) => {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="max-w-[800px] space-y-6">
      <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden">
        <div className="p-4 bg-[#F8F9FC] border-b border-[#E8EAF0] flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#1A1A2E]">
            추천 구성 ({configs.length})
          </h3>
          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="flex items-center gap-1.5 bg-[#000666] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#1A1A6E] disabled:opacity-50"
          >
            <Plus size={14} /> 추가
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-b border-[#E8EAF0]"
            >
              <ConfigForm
                initial={defaultDraft()}
                onSave={handleAdd}
                onCancel={() => setIsAdding(false)}
                saving={saving}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          {loading ? (
            <div className="p-8 text-center text-[#9BA4C0] text-[13px]">
              불러오는 중...
            </div>
          ) : configs.length === 0 && !isAdding ? (
            <div className="p-8 text-center text-[#9BA4C0] text-[13px]">
              등록된 추천 구성이 없습니다. 우측 상단 버튼을 눌러 추가해주세요.
            </div>
          ) : (
            configs.map((config) => (
              <ConfigRow
                key={config.id}
                config={config}
                vehicleId={vehicleId}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
