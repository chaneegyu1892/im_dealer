"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Calendar, Power, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole, type UsersListItem } from "@/lib/user-roles";

const ROLE_FILTERS: ReadonlyArray<{ value: UserRole | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "member", label: "일반 회원" },
  { value: "dealer", label: "딜러" },
  { value: "staff", label: "운영자" },
  { value: "admin", label: "관리자" },
  { value: "superadmin", label: "최고 관리자" },
];

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  member: "bg-slate-50 text-slate-500",
  dealer: "bg-emerald-50 text-emerald-600",
  staff: "bg-sky-50 text-sky-600",
  admin: "bg-amber-50 text-amber-600",
  superadmin: "bg-[#1A1A2E] text-white",
};

type Me = { id: string; email: string; name: string; role: string };

const LIMIT = 20;

export default function UserManager() {
  const [users, setUsers] = useState<UsersListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / LIMIT)), [total]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));

      const res = await fetch(`/api/admin/settings/users?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
        setTotal(result.meta?.total ?? 0);
      } else {
        alert(result.error ?? "사용자 목록을 불러오지 못했습니다.");
      }
    } catch {
      alert("사용자 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMe(d.data);
      })
      .catch(() => alert("내 정보를 불러오는 중 오류가 발생했습니다."));
  }, []);

  const isSuperAdmin = me?.role === "superadmin";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeRole = async (user: UsersListItem, newRole: UserRole) => {
    if (user.role === newRole) return;
    if (user.id === me?.id) {
      alert("본인의 권한은 변경할 수 없습니다.");
      return;
    }
    const fromLabel = USER_ROLE_LABELS[user.role];
    const toLabel = USER_ROLE_LABELS[newRole];
    if (!confirm(`${user.name} 님의 권한을 [${fromLabel}] → [${toLabel}] 로 변경하시겠습니까?`)) {
      return;
    }
    const res = await fetch("/api/admin/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role: newRole }),
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "권한 변경에 실패했습니다.");
    }
  };

  const toggleActive = async (user: UsersListItem) => {
    if (user.id === me?.id) {
      alert("본인의 활성 상태는 변경할 수 없습니다.");
      return;
    }
    const next = !user.isActive;
    if (!confirm(`${user.name} 님을 ${next ? "활성화" : "비활성화"} 하시겠습니까?`)) return;
    const res = await fetch("/api/admin/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, isActive: next }),
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "상태 변경에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#9BA4C0]">
        카카오 로그인한 모든 사용자를 확인하고, 슈퍼어드민이 역할을 변경할 수 있습니다.
      </p>

      {/* 필터 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setRoleFilter(f.value);
                setPage(1);
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                roleFilter === f.value
                  ? "bg-[#000666] text-white"
                  : "bg-[#F0F1FA] text-[#5A6080] hover:bg-[#E5E5FA]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-1.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름·이메일·전화 검색"
              className="text-xs pl-9 pr-3 py-2 rounded-xl border border-[#E8EAF0] w-64 focus:outline-none focus:border-[#6066EE]"
            />
          </div>
          <button
            type="submit"
            className="text-xs px-3 py-2 bg-[#6066EE] text-white rounded-xl font-bold hover:bg-[#000666]"
          >
            검색
          </button>
        </form>
      </div>

      {/* 결과 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#9BA4C0]">조회 중...</div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#9BA4C0]">조건에 맞는 사용자가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-[#F8F9FC] border border-[#E8EAF0] rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    u.isActive ? "bg-[#6066EE] text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {u.name[0] ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1A1A2E] truncate">{u.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                        ROLE_BADGE_STYLE[u.role] ?? ROLE_BADGE_STYLE.member
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.provider && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-bold uppercase">
                        {u.provider}
                      </span>
                    )}
                    {!u.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400 font-bold">
                        비활성
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#9BA4C0] flex-wrap">
                    <span className="flex items-center gap-1 truncate max-w-[280px]">
                      <Mail size={10} /> {u.email ?? "(이메일 없음)"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                    {u.lastLoginAt && (
                      <span className="text-[10px]">
                        최근 로그인 {new Date(u.lastLoginAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u, e.target.value as UserRole)}
                  disabled={!isSuperAdmin || u.id === me?.id}
                  className="text-xs px-2.5 py-1.5 border border-[#E8EAF0] rounded-xl focus:outline-none focus:border-[#6066EE] bg-white text-[#5A6080] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!isSuperAdmin ? "슈퍼어드민만 역할을 변경할 수 있습니다" : ""}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {USER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => toggleActive(u)}
                  disabled={!isSuperAdmin || u.id === me?.id}
                  className={`p-2 rounded-lg transition-colors ${
                    u.isActive
                      ? "hover:bg-red-50 text-emerald-500 hover:text-red-500"
                      : "hover:bg-[#F0F1FA] text-gray-300 hover:text-[#6066EE]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={u.isActive ? "비활성화" : "활성화"}
                >
                  <Power size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-[#9BA4C0]">
            전체 {total}명 · {page} / {totalPages} 페이지
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-[#5A6080] hover:bg-[#F0F1FA] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-[#5A6080] hover:bg-[#F0F1FA] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
