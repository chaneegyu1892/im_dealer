'use client';

import { useEffect, useState } from "react";
import { User, Check } from "lucide-react";
import AdminManager from "@/components/admin/settings/AdminManager";
import UserManager from "@/components/admin/settings/UserManager";
import { isAdminLike } from "@/lib/admin-roles";

interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

type PartnerTab = "admins" | "users";

export default function AdminSettingsPage() {
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [partnerTab, setPartnerTab] = useState<PartnerTab>("admins");

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setInfo(d.data);
          setName(d.data.name);
        }
      });
  }, []);

  const handleProfileUpdate = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">계정 관리</h1>
        <p className="text-sm text-[#9BA4C0] mt-1">내 계정 정보와 운영 파트너 권한을 관리합니다.</p>
      </div>

      <div className="space-y-6 animate-in fade-in duration-300">
        {/* 기본 프로필 */}
        <div className="bg-white rounded-3xl border border-[#E8EAF0] p-8 shadow-sm max-w-2xl">
          <h2 className="text-lg font-bold text-[#1A1A2E] mb-6 flex items-center gap-2">
            <User size={20} className="text-[#6066EE]" />
            기본 프로필 정보
          </h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#9BA4C0] ml-1">이름</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm focus:outline-none focus:border-[#6066EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#9BA4C0] ml-1">이메일 계정</label>
                <input
                  value={info?.email ?? ""}
                  readOnly
                  className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm bg-[#F8F9FC] text-[#9BA4C0] cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex justify-end items-center gap-4 border-t border-[#F8F9FC] pt-6">
              {profileSuccess && (
                <span className="text-emerald-500 text-xs font-bold animate-pulse flex items-center gap-1">
                  <Check size={12} /> 저장되었습니다.
                </span>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-[#000666] text-white rounded-2xl text-sm font-bold hover:bg-[#000888] transition-all disabled:opacity-60"
              >
                저장
              </button>
            </div>
          </form>
        </div>

        {/* 운영 파트너 관리 — admin/superadmin 전용 */}
        {isAdminLike(info?.role) && (
          <div className="bg-white rounded-3xl border border-[#E8EAF0] p-8 shadow-sm max-w-5xl">
            <div className="flex items-end justify-between mb-6 border-b border-[#F0F1FA] pb-3">
              <h2 className="text-lg font-bold text-[#1A1A2E]">운영 파트너 관리</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPartnerTab("admins")}
                  className={`text-xs px-4 py-2 rounded-xl font-bold transition-colors ${
                    partnerTab === "admins"
                      ? "bg-[#000666] text-white"
                      : "text-[#5A6080] hover:bg-[#F0F1FA]"
                  }`}
                >
                  어드민 관리
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerTab("users")}
                  className={`text-xs px-4 py-2 rounded-xl font-bold transition-colors ${
                    partnerTab === "users"
                      ? "bg-[#000666] text-white"
                      : "text-[#5A6080] hover:bg-[#F0F1FA]"
                  }`}
                >
                  전체 사용자 관리
                </button>
              </div>
            </div>
            {partnerTab === "admins" ? <AdminManager /> : <UserManager />}
          </div>
        )}
      </div>
    </div>
  );
}
