"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resource: string;
  targetId: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogTableProps {
  logs: AuditLog[];
  filter: { action?: string; resource?: string; actorId?: string };
}

const ACTION_TONE: Record<string, string> = {
  LOGIN: "text-emerald-600 bg-emerald-50",
  LOGOUT: "text-slate-500 bg-slate-100",
  LOGIN_FAILED: "text-red-600 bg-red-50",
};

function actionTone(action: string): string {
  if (ACTION_TONE[action]) return ACTION_TONE[action];
  if (action.endsWith("_DELETE")) return "text-red-600 bg-red-50";
  if (action.endsWith("_CREATE")) return "text-blue-600 bg-blue-50";
  if (action.endsWith("_UPDATE")) return "text-amber-700 bg-amber-50";
  return "text-slate-600 bg-slate-100";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function AuditLogTable({ logs, filter }: AuditLogTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actionFilter, setActionFilter] = useState(filter.action ?? "");
  const [resourceFilter, setResourceFilter] = useState(filter.resource ?? "");
  const [actorFilter, setActorFilter] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter && !log.action.includes(actionFilter.toUpperCase())) return false;
      if (resourceFilter && !log.resource.toLowerCase().includes(resourceFilter.toLowerCase())) return false;
      if (actorFilter && !log.actorEmail.toLowerCase().includes(actorFilter.toLowerCase())) return false;
      return true;
    });
  }, [logs, actionFilter, resourceFilter, actorFilter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setActionFilter("");
    setResourceFilter("");
    setActorFilter("");
  };

  const hasFilter = actionFilter || resourceFilter || actorFilter;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#6066EE]" />
          <h1 className="text-[18px] font-semibold text-[#1A1A2E]">감사 로그</h1>
          <span className="text-[12px] text-[#9BA4C0]">
            최근 {logs.length}건 (최대 100건)
          </span>
        </div>
      </header>

      <div className="bg-white rounded-[8px] border border-[#E8EAF0] p-4 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-[#9BA4C0]" />
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="액션 (예: VEHICLE)"
          className="px-3 py-1.5 text-[12px] rounded-[6px] border border-[#E8EAF0] focus:border-[#6066EE] outline-none w-[180px]"
        />
        <input
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          placeholder="리소스 (예: Vehicle)"
          className="px-3 py-1.5 text-[12px] rounded-[6px] border border-[#E8EAF0] focus:border-[#6066EE] outline-none w-[180px]"
        />
        <input
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          placeholder="관리자 이메일"
          className="px-3 py-1.5 text-[12px] rounded-[6px] border border-[#E8EAF0] focus:border-[#6066EE] outline-none w-[200px]"
        />
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-[12px] text-[#5A6080] hover:text-[#1A1A2E]"
          >
            <X size={12} /> 초기화
          </button>
        )}
        <span className="ml-auto text-[12px] text-[#9BA4C0]">
          {filtered.length}건 표시
        </span>
      </div>

      <div className="bg-white rounded-[8px] border border-[#E8EAF0] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#F8F9FC] border-b border-[#E8EAF0]">
              <th className="w-8 px-3 py-2.5"></th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">시각</th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">관리자</th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">액션</th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">리소스</th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">대상 ID</th>
              <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-[#9BA4C0]">
                  표시할 감사 로그가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const isOpen = expanded.has(log.id);
                const hasDiff = log.diff && Object.keys(log.diff).length > 0;
                return (
                  <>
                    <tr
                      key={log.id}
                      className={cn(
                        "border-b border-[#F0F2F8] hover:bg-[#F8F9FC]",
                        hasDiff && "cursor-pointer"
                      )}
                      onClick={() => hasDiff && toggle(log.id)}
                    >
                      <td className="px-3 py-2.5 align-top">
                        {hasDiff ? (
                          isOpen ? (
                            <ChevronDown size={14} className="text-[#9BA4C0]" />
                          ) : (
                            <ChevronRight size={14} className="text-[#9BA4C0]" />
                          )
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="text-[#1A1A2E]">{formatRelative(log.createdAt)}</div>
                        <div className="text-[11px] text-[#9BA4C0]">
                          {new Date(log.createdAt).toLocaleString("ko-KR")}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#1A1A2E]">{log.actorEmail}</td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded-[4px] text-[11px] font-semibold",
                            actionTone(log.action)
                          )}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#1A1A2E]">{log.resource}</td>
                      <td className="px-3 py-2.5 align-top text-[#5A6080] font-mono text-[11px]">
                        {log.targetId ?? "-"}
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#9BA4C0] text-[11px]">
                        {log.ip ?? "-"}
                      </td>
                    </tr>
                    {isOpen && hasDiff && (
                      <tr className="bg-[#FAFBFD]">
                        <td colSpan={7} className="px-6 py-3">
                          <pre className="text-[11px] text-[#1A1A2E] whitespace-pre-wrap break-all bg-white border border-[#E8EAF0] rounded-[6px] p-3 max-h-[400px] overflow-auto">
                            {JSON.stringify(log.diff, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
