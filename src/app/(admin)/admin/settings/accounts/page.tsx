"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Shield, User, Check, X, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 신규 계정 폼
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "operator">("operator");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // 비밀번호 리셋 모달
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/accounts").then((r) => r.json()),
      fetch("/api/admin/auth/me").then((r) => r.json()),
    ]).then(([accounts, me]) => {
      if (accounts.success) setAccounts(accounts.data);
      if (me.success) setMyId(me.data.id);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
    });
    const data = await res.json();
    setFormLoading(false);

    if (!res.ok) {
      setFormError(data.error ?? "생성 실패");
    } else {
      setAccounts((prev) => [...prev, data.data]);
      setShowForm(false);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("operator");
    }
  }

  async function toggleActive(account: Account) {
    const res = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    const data = await res.json();
    if (data.success) {
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? data.data : a)));
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetLoading(true);

    const res = await fetch(`/api/admin/accounts/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const data = await res.json();
    setResetLoading(false);

    if (!res.ok) {
      setResetError(data.error ?? "변경 실패");
    } else {
      setResetTarget(null);
      setResetPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F8] p-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-[#9BA4C0]"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-[20px] font-semibold text-[#1A1A2E]">계정 관리</h1>
              <p className="text-[12px] text-[#9BA4C0] mt-0.5">관리자 및 운영자 계정</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#000666] text-white text-[13px] font-semibold hover:bg-[#000555] transition-colors"
          >
            <Plus size={14} />
            계정 추가
          </button>
        </div>

        {/* 신규 계정 폼 */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl border border-[#E8EAF0] p-5 mb-5 space-y-3"
          >
            <h2 className="text-[13px] font-semibold text-[#1A1A2E]">새 계정</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1">이름</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#E8EAF0] text-[13px] focus:outline-none focus:border-[#6066EE]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1">역할</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "operator")}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8EAF0] text-[13px] focus:outline-none focus:border-[#6066EE] bg-white"
                >
                  <option value="operator">운영자</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1">이메일</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[#E8EAF0] text-[13px] focus:outline-none focus:border-[#6066EE]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1">초기 비밀번호 (8자 이상)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-[#E8EAF0] text-[13px] focus:outline-none focus:border-[#6066EE]"
              />
            </div>
            {formError && (
              <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 rounded-lg bg-[#000666] text-white text-[13px] font-semibold hover:bg-[#000555] disabled:opacity-60 transition-colors"
              >
                {formLoading ? "생성 중..." : "생성"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-[#E8EAF0] text-[13px] text-[#9BA4C0] hover:bg-[#F4F5F8] transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* 계정 목록 */}
        <div className="bg-white rounded-xl border border-[#E8EAF0] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[13px] text-[#9BA4C0]">불러오는 중...</div>
          ) : (
            <ul className="divide-y divide-[#F4F5F8]">
              {accounts.map((account) => {
                const isMe = account.id === myId;
                return (
                  <li key={account.id} className="flex items-center gap-4 px-5 py-4">
                    {/* 아바타 */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold text-white shrink-0",
                        account.role === "admin" ? "bg-[#000666]" : "bg-[#6066EE]"
                      )}
                    >
                      {account.name[0]}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#1A1A2E] truncate">{account.name}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[4px]",
                          account.role === "admin"
                            ? "bg-[#EEF0FF] text-[#6066EE]"
                            : "bg-[#F4F5F8] text-[#9BA4C0]"
                        )}>
                          {account.role === "admin" ? <Shield size={9} /> : <User size={9} />}
                          {account.role === "admin" ? "관리자" : "운영자"}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-medium text-[#9BA4C0] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">나</span>
                        )}
                        {!account.isActive && (
                          <span className="text-[10px] font-medium text-red-400 bg-red-50 px-1.5 py-0.5 rounded-[4px]">비활성</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9BA4C0] mt-0.5">{account.email}</p>
                      <p className="text-[10px] text-[#C5CAD9] mt-0.5">
                        마지막 로그인: {account.lastLoginAt
                          ? new Date(account.lastLoginAt).toLocaleDateString("ko-KR")
                          : "없음"}
                      </p>
                    </div>

                    {/* 액션 */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setResetTarget(account); setResetPassword(""); setResetError(""); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E8EAF0] text-[#9BA4C0] hover:text-[#6066EE] hover:border-[#6066EE] transition-colors"
                          title="비밀번호 초기화"
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(account)}
                          className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-lg border transition-colors",
                            account.isActive
                              ? "border-[#E8EAF0] text-[#9BA4C0] hover:text-red-400 hover:border-red-200"
                              : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                          )}
                          title={account.isActive ? "비활성화" : "활성화"}
                        >
                          {account.isActive ? <X size={13} /> : <Check size={13} />}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 비밀번호 초기화 모달 */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl"
          >
            <h2 className="text-[15px] font-semibold text-[#1A1A2E]">비밀번호 초기화</h2>
            <p className="text-[12px] text-[#9BA4C0]">
              <span className="font-medium text-[#1A1A2E]">{resetTarget.name}</span> ({resetTarget.email}) 의 새 비밀번호를 설정합니다.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">새 비밀번호 (8자 이상)</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] focus:outline-none focus:border-[#6066EE]"
              />
            </div>
            {resetError && (
              <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{resetError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 py-2 rounded-lg bg-[#000666] text-white text-[13px] font-semibold hover:bg-[#000555] disabled:opacity-60 transition-colors"
              >
                {resetLoading ? "변경 중..." : "변경"}
              </button>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="flex-1 py-2 rounded-lg border border-[#E8EAF0] text-[13px] text-[#9BA4C0] hover:bg-[#F4F5F8] transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
