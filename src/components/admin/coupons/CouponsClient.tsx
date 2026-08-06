"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Ticket, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Trigger = "SIGNUP" | "FIRST_CONTRACT";
type RewardKind = "FUEL" | "CASH" | "GIFT";
type IssuedStatus = "ALL" | "HELD" | "PENDING" | "PAID" | "EXPIRED" | "REVOKED";

interface Policy {
  id: string;
  code: string;
  trigger: Trigger;
  title: string;
  description: string | null;
  rewardLabel: string;
  rewardAmount: number | null;
  rewardKind: RewardKind;
  termsNote: string | null;
  validDays: number | null;
  isActive: boolean;
  displayOrder: number;
}

interface IssuedCouponRow {
  id: string;
  code: string;
  status: Exclude<IssuedStatus, "ALL">;
  titleSnapshot: string;
  rewardLabelSnapshot: string;
  issuedAt: string;
  paidAt: string | null;
  paidMemo: string | null;
  user: { id: string; name: string; phone: string | null };
}

const TRIGGER_LABEL: Record<Trigger, string> = {
  SIGNUP: "첫가입",
  FIRST_CONTRACT: "첫계약",
};

const STATUS_LABEL: Record<Exclude<IssuedStatus, "ALL">, string> = {
  HELD: "보유",
  PENDING: "지급 예정",
  PAID: "지급 완료",
  EXPIRED: "만료",
  REVOKED: "취소",
};

const STATUS_FILTERS: IssuedStatus[] = ["PENDING", "HELD", "PAID", "EXPIRED", "REVOKED", "ALL"];

const EMPTY_FORM = {
  code: "",
  trigger: "SIGNUP" as Trigger,
  title: "",
  description: "",
  rewardLabel: "",
  rewardAmount: "",
  rewardKind: "GIFT" as RewardKind,
  termsNote: "",
  validDays: "",
  displayOrder: "0",
  isActive: true,
};

type FormState = typeof EMPTY_FORM;

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export function CouponsClient() {
  const [tab, setTab] = useState<"policies" | "issued">("policies");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center gap-2">
        <Ticket size={22} className="text-[#1A1A2E]" aria-hidden="true" />
        <h1 className="text-xl font-bold text-[#1A1A2E]">쿠폰 관리</h1>
      </header>

      {message && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {message}
          <button type="button" onClick={() => setMessage(null)} aria-label="알림 닫기">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-5 flex gap-1 rounded-lg bg-[#F4F5F8] p-1">
        {(
          [
            { key: "policies", label: "정책" },
            { key: "issued", label: "발급 현황" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "min-h-10 flex-1 rounded-md text-sm font-semibold transition-colors",
              tab === item.key
                ? "bg-white text-[#1A1A2E] shadow-sm"
                : "text-[#6B7399] hover:text-[#1A1A2E]"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "policies" ? (
        <PolicyTab onError={setMessage} />
      ) : (
        <IssuedTab onError={setMessage} />
      )}
    </div>
  );
}

function PolicyTab({ onError }: { onError: (message: string | null) => void }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/coupons/policies");
      if (!response.ok) {
        onError(await readError(response, "쿠폰 정책을 불러오지 못했습니다."));
        return;
      }
      const body = (await response.json()) as { data: Policy[] };
      setPolicies(body.data);
      onError(null);
    } catch {
      onError("쿠폰 정책을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (policy: Policy) => {
    setEditingId(policy.id);
    setForm({
      code: policy.code,
      trigger: policy.trigger,
      title: policy.title,
      description: policy.description ?? "",
      rewardLabel: policy.rewardLabel,
      rewardAmount: policy.rewardAmount === null ? "" : String(policy.rewardAmount),
      rewardKind: policy.rewardKind,
      termsNote: policy.termsNote ?? "",
      validDays: policy.validDays === null ? "" : String(policy.validDays),
      displayOrder: String(policy.displayOrder),
      isActive: policy.isActive,
    });
  };

  const submit = async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description.trim() === "" ? null : form.description,
        rewardLabel: form.rewardLabel,
        rewardAmount: toNullableNumber(form.rewardAmount),
        rewardKind: form.rewardKind,
        termsNote: form.termsNote.trim() === "" ? null : form.termsNote,
        validDays: toNullableNumber(form.validDays),
        displayOrder: toNullableNumber(form.displayOrder) ?? 0,
        isActive: form.isActive,
        // code 와 trigger 는 수정 시 전송하지 않는다. 서버도 받지 않는다.
        ...(editingId ? {} : { code: form.code, trigger: form.trigger }),
      };

      const response = await fetch(
        editingId ? `/api/admin/coupons/policies/${editingId}` : "/api/admin/coupons/policies",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        onError(await readError(response, "쿠폰 정책을 저장하지 못했습니다."));
        return;
      }

      setForm(null);
      setEditingId(null);
      await load();
    } catch {
      onError("쿠폰 정책을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (policy: Policy) => {
    if (saving) return;
    if (!window.confirm(`"${policy.title}" 정책을 삭제할까요?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/coupons/policies/${policy.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        onError(await readError(response, "쿠폰 정책을 삭제하지 못했습니다."));
        return;
      }
      await load();
    } catch {
      onError("쿠폰 정책을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          disabled={saving}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#1A1A2E] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          정책 추가
        </button>
      </div>

      {form && (
        <div className="mb-5 rounded-xl border border-[#E8EAF0] bg-white p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="코드">
              <input
                value={form.code}
                disabled={editingId !== null}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SIGNUP_FUEL_100K"
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm disabled:bg-[#F4F5F8]"
              />
            </Field>
            <Field label="트리거">
              <select
                value={form.trigger}
                disabled={editingId !== null}
                onChange={(e) => setForm({ ...form, trigger: e.target.value as Trigger })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm disabled:bg-[#F4F5F8]"
              >
                <option value="SIGNUP">첫가입</option>
                <option value="FIRST_CONTRACT">첫계약</option>
              </select>
            </Field>
            <Field label="제목">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="리워드 표시">
              <input
                value={form.rewardLabel}
                onChange={(e) => setForm({ ...form, rewardLabel: e.target.value })}
                placeholder="주유권 10만원"
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="리워드 금액(원)">
              <input
                type="number"
                value={form.rewardAmount}
                onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="리워드 종류">
              <select
                value={form.rewardKind}
                onChange={(e) => setForm({ ...form, rewardKind: e.target.value as RewardKind })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              >
                <option value="FUEL">주유</option>
                <option value="CASH">현금성</option>
                <option value="GIFT">상품</option>
              </select>
            </Field>
            <Field label="유효일수(비우면 무기한)">
              <input
                type="number"
                value={form.validDays}
                onChange={(e) => setForm({ ...form, validDays: e.target.value })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="정렬 순서">
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="카드 설명">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="계약을 완료하면 지급돼요"
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
            <Field label="유의사항">
              <input
                value={form.termsNote}
                onChange={(e) => setForm({ ...form, termsNote: e.target.value })}
                className="w-full rounded-lg border border-[#E8EAF0] px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-[#1A1A2E]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            활성 (끄면 신규 발급만 멈추고 기존 쿠폰은 유지됩니다)
          </label>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="min-h-10 rounded-lg bg-[#1A1A2E] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              disabled={saving}
              className="min-h-10 rounded-lg border border-[#E8EAF0] px-4 text-sm font-semibold text-[#6B7399]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-[#6B7399]">불러오는 중…</p>
      ) : policies.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#6B7399]">등록된 쿠폰 정책이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {policies.map((policy) => (
            <li
              key={policy.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EAF0] bg-white px-4 py-3"
            >
              <span className="rounded-md bg-[#F4F5F8] px-2 py-1 text-xs font-semibold text-[#6B7399]">
                {TRIGGER_LABEL[policy.trigger]}
              </span>
              <span className="font-semibold text-[#1A1A2E]">{policy.title}</span>
              <span className="text-sm text-[#6B7399]">{policy.rewardLabel}</span>
              <span className="font-mono text-xs text-[#6B7399]">{policy.code}</span>
              <span className="text-xs text-[#6B7399]">
                {policy.validDays === null ? "무기한" : `${policy.validDays}일`}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold",
                  policy.isActive ? "bg-emerald-50 text-emerald-600" : "bg-[#F4F5F8] text-[#6B7399]"
                )}
              >
                {policy.isActive ? "활성" : "비활성"}
              </span>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(policy)}
                  className="min-h-9 rounded-lg border border-[#E8EAF0] px-3 text-xs font-semibold text-[#1A1A2E]"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => remove(policy)}
                  disabled={saving}
                  className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IssuedTab({ onError }: { onError: (message: string | null) => void }) {
  const [rows, setRows] = useState<IssuedCouponRow[]>([]);
  const [status, setStatus] = useState<IssuedStatus>("PENDING");
  // query 는 입력창의 현재 값, submittedQuery 는 실제로 조회에 쓰인 값이다.
  // 둘을 나누지 않으면 load 의 의존성이 매 타이핑마다 바뀌어 글자 하나마다 API 를 때린다.
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (submittedQuery.trim() !== "") params.set("q", submittedQuery.trim());
      const response = await fetch(`/api/admin/coupons/issued?${params.toString()}`);
      if (!response.ok) {
        onError(await readError(response, "발급 현황을 불러오지 못했습니다."));
        return;
      }
      const body = (await response.json()) as { data: IssuedCouponRow[] };
      setRows(body.data);
      onError(null);
    } catch {
      onError("발급 현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onError, submittedQuery, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pay = async (row: IssuedCouponRow) => {
    if (paying) return;
    const memo = window.prompt(`${row.user.name}님에게 "${row.titleSnapshot}" 지급 메모`, "");
    if (memo === null) return;
    setPaying(true);
    try {
      const response = await fetch(`/api/admin/coupons/issued/${row.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo }),
      });
      if (!response.ok) {
        onError(await readError(response, "지급 처리에 실패했습니다."));
        return;
      }
      await load();
    } catch {
      onError("지급 처리에 실패했습니다.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as IssuedStatus)}
          aria-label="상태 필터"
          className="min-h-10 rounded-lg border border-[#E8EAF0] px-3 text-sm"
        >
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>
              {value === "ALL" ? "전체" : STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSubmittedQuery(query);
          }}
          aria-label="쿠폰 검색"
          placeholder="회원명 · 전화 · 쿠폰코드"
          className="min-h-10 flex-1 rounded-lg border border-[#E8EAF0] px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => setSubmittedQuery(query)}
          disabled={loading}
          className="min-h-10 rounded-lg bg-[#1A1A2E] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          검색
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-[#6B7399]">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#6B7399]">해당 조건의 쿠폰이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E8EAF0] bg-white px-4 py-3"
            >
              <span className="font-semibold text-[#1A1A2E]">{row.user.name}</span>
              <span className="text-sm text-[#6B7399]">{row.user.phone ?? "연락처 없음"}</span>
              <span className="text-sm text-[#1A1A2E]">{row.titleSnapshot}</span>
              <span className="text-sm text-[#6B7399]">{row.rewardLabelSnapshot}</span>
              <span className="font-mono text-xs text-[#6B7399]">{row.code}</span>
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold",
                  row.status === "PENDING"
                    ? "bg-amber-50 text-amber-700"
                    : row.status === "PAID"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-[#F4F5F8] text-[#6B7399]"
                )}
              >
                {STATUS_LABEL[row.status]}
              </span>
              <span className="text-xs text-[#6B7399]">발급 {formatDate(row.issuedAt)}</span>
              {row.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => pay(row)}
                  disabled={paying}
                  className="ml-auto min-h-9 rounded-lg bg-[#1A1A2E] px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  지급 완료 처리
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#6B7399]">{label}</span>
      {children}
    </label>
  );
}
