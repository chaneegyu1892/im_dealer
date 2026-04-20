'use client';
export const dynamic = 'force-dynamic';
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }

      router.replace("/admin");
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC]">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <p className="text-[26px] font-bold text-[#000666] tracking-tight">아임딜러</p>
          <p className="text-[13px] text-[#9BA4C0] mt-1">관리자 콘솔</p>
        </div>

        {/* 카드 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-[#E8EAF0] p-8 space-y-4"
        >
          <h1 className="text-[18px] font-semibold text-[#1A1A2E] mb-2">로그인</h1>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#9BA4C0]">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[14px] text-[#1A1A2E] placeholder:text-[#C5CAD9] focus:outline-none focus:border-[#6066EE] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-medium text-[#9BA4C0]">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E8EAF0] text-[14px] text-[#1A1A2E] placeholder:text-[#C5CAD9] focus:outline-none focus:border-[#6066EE] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#000666] text-white text-[14px] font-semibold hover:bg-[#000555] active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
