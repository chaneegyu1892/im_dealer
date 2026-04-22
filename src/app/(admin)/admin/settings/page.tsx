'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, ShieldCheck, Settings2, Sparkles } from "lucide-react";
import PolicyManager from "@/components/admin/settings/PolicyManager";
import AdminManager from "@/components/admin/settings/AdminManager";
import { Check } from "lucide-react";

interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [info, setInfo] = useState<AdminInfo | null>(null);

  // 폼 상태 (개인 정보)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

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

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
    setLoading(false);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert("비밀번호 불일치");
    setLoading(true);
    const res = await fetch("/api/admin/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } else {
      const d = await res.json();
      alert(d.error || "비밀번호 변경 실패");
    }
    setLoading(false);
  };

  const tabs = [
    { id: "profile", label: "내 정보 설정", icon: User },
    { id: "policy", label: "운영 정책 관리", icon: Settings2, hide: info?.role !== "admin" },
    { id: "admins", label: "운영자 권한 관리", icon: ShieldCheck, hide: info?.role !== "admin" },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">시스템 설정</h1>
          <p className="text-sm text-[#9BA4C0] mt-1">계정 관리와 서비스 운영에 필요한 정책을 설정합니다.</p>
      </div>

      <div className="flex gap-8">
        {/* 사이드 탭 */}
        <div className="w-64 flex flex-col gap-1 shrink-0">
          {tabs.filter(t => !t.hide).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-[#6066EE] text-white shadow-lg shadow-indigo-100 translate-x-1"
                  : "bg-white text-[#9BA4C0] hover:bg-[#F8F9FC] hover:text-[#5A6080] border border-transparent hover:border-[#E8EAF0]"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 컨텐츠 영역 */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="bg-white rounded-3xl border border-[#E8EAF0] p-8 shadow-sm">
                 <h2 className="text-lg font-bold text-[#1A1A2E] mb-6 flex items-center gap-2">
                    <User size={20} className="text-[#6066EE]" />
                    기본 프로필 정보
                 </h2>
                 <form onSubmit={handleProfileUpdate} className="grid grid-cols-2 gap-6">
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm focus:outline-none focus:border-[#6066EE]"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end items-center gap-4 border-t border-[#F8F9FC] pt-6">
                      {profileSuccess && <span className="text-emerald-500 text-xs font-bold animate-pulse">정상적으로 저장되었습니다.</span>}
                      <button className="px-8 py-3 bg-[#000666] text-white rounded-2xl text-sm font-bold hover:bg-[#000888] transition-all">
                        기본 정보 저장
                      </button>
                    </div>
                 </form>
               </div>

               <div className="bg-white rounded-3xl border border-[#E8EAF0] p-8 shadow-sm">
                 <h2 className="text-lg font-bold text-[#1A1A2E] mb-6 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-orange-500" />
                    비밀번호 변경
                 </h2>
                 <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#9BA4C0] ml-1">현재 비밀번호</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm focus:outline-none focus:border-[#6066EE]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#9BA4C0] ml-1">새 비밀번호</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm focus:outline-none focus:border-[#6066EE]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#9BA4C0] ml-1">비밀번호 확인</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl border border-[#E8EAF0] text-sm focus:outline-none focus:border-[#6066EE]"
                        />
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end items-center gap-4">
                      {pwSuccess && <span className="text-emerald-500 text-xs font-bold">비밀번호가 변경되었습니다.</span>}
                      <button className="px-8 py-3 bg-[#1A1A2E] text-white rounded-2xl text-sm font-bold hover:bg-[#2A2A4E] transition-all">
                        보안 업데이트
                      </button>
                    </div>
                 </form>
               </div>
            </div>
          )}

          {activeTab === "policy" && info?.role === "admin" && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <PolicyManager />
            </div>
          )}

          {activeTab === "admins" && info?.role === "admin" && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <AdminManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

