"use client";

import { useState, useEffect } from "react";
import { UserPlus, ShieldCheck, Mail, Calendar, Power, MoreVertical } from "lucide-react";

export default function AdminManager() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // 신규 추가 폼 상태
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "", role: "operator" });

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
    } catch (error) {
      alert("오류 발생");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/settings/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewAdmin({ name: "", email: "", password: "", role: "operator" });
        fetchAdmins();
      } else {
        const d = await res.json();
        alert(d.error || "추가 실패");
      }
    } catch (error) {
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
    } catch (error) {
      alert("상태 변경 실패");
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-[#9BA4C0]">조회 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[#1A1A2E]">운영 파트너 목록</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6066EE] text-white rounded-lg text-xs font-bold hover:bg-[#5055DD] transition-all"
        >
          <UserPlus size={14} />
          신규 계정 추가
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-[#1A1A2E] mb-6">운영자 신규 초대</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#9BA4C0] block mb-1">이름</label>
                <input
                  required
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  placeholder="실명 입력"
                  className="w-full px-3 py-2 border border-[#E8EAF0] rounded-xl text-sm focus:outline-none focus:border-[#6066EE]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#9BA4C0] block mb-1">이메일 (ID)</label>
                <input
                  required
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 border border-[#E8EAF0] rounded-xl text-sm focus:outline-none focus:border-[#6066EE]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#9BA4C0] block mb-1">초기 비밀번호</label>
                <input
                  required
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  placeholder="8자 이상"
                  className="w-full px-3 py-2 border border-[#E8EAF0] rounded-xl text-sm focus:outline-none focus:border-[#6066EE]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#9BA4C0] block mb-1">권한 역할</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E8EAF0] rounded-xl text-sm focus:outline-none focus:border-[#6066EE] appearance-none bg-white"
                >
                  <option value="admin">마스터 관리자 (Admin)</option>
                  <option value="staff">일반 운영자 (Staff)</option>
                  <option value="dealer">제휴 딜러 (Dealer)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 text-sm font-bold text-[#9BA4C0] hover:text-[#5A6080]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#000666] text-white rounded-2xl text-sm font-bold hover:bg-[#000888]"
                >
                  초대하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {admins.map((admin) => (
          <div key={admin.id} className="bg-white border border-[#E8EAF0] rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${admin.isActive ? 'bg-[#6066EE] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {admin.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1A1A2E]">{admin.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${admin.role === 'admin' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                    {admin.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9BA4C0]">
                  <span className="flex items-center gap-1"><Mail size={10} /> {admin.email}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> 가입일: {new Date(admin.createdAt).toLocaleDateString()}</span>
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
                <option value="admin">관리자 (Admin)</option>
                <option value="staff">운영자 (Staff)</option>
                <option value="dealer">제휴 딜러 (Dealer)</option>
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
