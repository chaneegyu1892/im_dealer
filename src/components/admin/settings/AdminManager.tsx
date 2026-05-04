"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Mail, Calendar, Power } from "lucide-react";

export default function AdminManager() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/admins");
      const result = await res.json();
      if (result.success) setAdmins(result.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMe(d.data);
      });
  }, []);

  const changeRole = async (id: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/settings/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: newRole }),
      });
      if (res.ok) {
        fetchAdmins();
      } else {
        const d = await res.json();
        alert(d.error || "권한 변경 실패");
      }
    } catch {
      alert("오류 발생");
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch("/api/admin/settings/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      fetchAdmins();
    } catch {
      alert("상태 변경 실패");
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-[#9BA4C0]">조회 중...</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#9BA4C0]">
        사용자 관리 페이지에서 카카오 로그인 계정에 관리자 권한을 부여할 수 있습니다.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {admins.map((admin) => (
          <div key={admin.id} className="bg-[#F8F9FC] border border-[#E8EAF0] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${admin.isActive ? 'bg-[#6066EE] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {admin.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1A1A2E]">{admin.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    admin.role === 'superadmin'
                      ? 'bg-[#1A1A2E] text-white'
                      : admin.role === 'admin'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-50 text-slate-500'
                  }`}>
                    {admin.role}
                  </span>
                  {!admin.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400 font-bold">비활성</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9BA4C0]">
                  <span className="flex items-center gap-1"><Mail size={10} /> {admin.email}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(admin.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={admin.role}
                onChange={(e) => changeRole(admin.id, e.target.value)}
                disabled={admin.id === me?.id}
                className="text-xs px-2.5 py-1.5 border border-[#E8EAF0] rounded-xl focus:outline-none focus:border-[#6066EE] bg-white text-[#5A6080] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="superadmin">최고 관리자 (Super Admin)</option>
                <option value="admin">관리자 (Admin)</option>
                <option value="dealer">제휴 딜러 (Dealer)</option>
                <option value="staff">운영자 (Staff)</option>
              </select>
              <button
                onClick={() => toggleStatus(admin.id, admin.isActive)}
                disabled={admin.id === me?.id}
                className={`p-2 rounded-lg transition-colors ${admin.isActive ? 'hover:bg-red-50 text-emerald-500 hover:text-red-500' : 'hover:bg-[#F0F1FA] text-gray-300 hover:text-[#6066EE]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title={admin.isActive ? "비활성화" : "활성화"}
              >
                <Power size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
