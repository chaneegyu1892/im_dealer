'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [info, setInfo] = useState<AdminInfo | null>(null);

  // 폼 상태
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 피드백 상태
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setInfo(d.data);
          setName(d.data.name);
          setEmail(d.data.email);
        }
      });
  }, []);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);
    setLoading(true);

    const res = await fetch("/api/admin/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setProfileError(data.error ?? "수정 실패");
    } else {
      setInfo(data.data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setPwError(data.error ?? "비밀번호 변경 실패");
    } else {
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F8] p-8">
      <div className="max-w-xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-[#9BA4C0]"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[20px] font-semibold text-[#1A1A2E]">계정 설정</h1>
            <p className="text-[12px] text-[#9BA4C0] mt-0.5">{info?.role === "admin" ? "관리자" : "운영자"} · {info?.email}</p>
          </div>
        </div>

        {/* 기본 정보 */}
        <form onSubmit={handleProfileUpdate} className="bg-white rounded-xl border border-[#E8EAF0] p-6 mb-5">
          <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">기본 정보</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#6066EE] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#6066EE] transition-colors"
              />
            </div>
          </div>

          {profileError && (
            <p className="mt-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="mt-3 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check size={12} /> 저장됐습니다.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 px-4 py-2 rounded-lg bg-[#000666] text-white text-[13px] font-semibold hover:bg-[#000555] disabled:opacity-60 transition-colors"
          >
            저장
          </button>
        </form>

        {/* 비밀번호 변경 */}
        <form onSubmit={handlePasswordUpdate} className="bg-white rounded-xl border border-[#E8EAF0] p-6">
          <h2 className="text-[14px] font-semibold text-[#1A1A2E] mb-4">비밀번호 변경</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">현재 비밀번호</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#6066EE] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="8자 이상"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] text-[#1A1A2E] placeholder:text-[#C5CAD9] focus:outline-none focus:border-[#6066EE] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#9BA4C0] mb-1.5">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#6066EE] transition-colors"
              />
            </div>
          </div>

          {pwError && (
            <p className="mt-3 text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="mt-3 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check size={12} /> 비밀번호가 변경됐습니다.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 px-4 py-2 rounded-lg bg-[#1A1A2E] text-white text-[13px] font-semibold hover:bg-[#2A2A4E] disabled:opacity-60 transition-colors"
          >
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  );
}
