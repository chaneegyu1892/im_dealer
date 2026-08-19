import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ReferralLedgerPage,
  ReferralStatusFilter,
} from "@/lib/admin-queries/referral";
import { formatRelativeTime } from "@/lib/admin-queries/shared";
import { ReferralStatusActions } from "./ReferralStatusActions";

// 서버 컴포넌트 — 페이지 진입 시점의 SSR 스냅샷을 렌더한다.
// 상태 변경 액션만 클라이언트(ReferralStatusActions)로 위임한다.

const STATUS_CARDS: {
  key: ReferralStatusFilter;
  label: string;
  desc: string;
  tone: string;
}[] = [
  { key: "REWARDED", label: "인정", desc: "보상 지급 완료", tone: "bg-emerald-50 text-emerald-700" },
  { key: "BLOCKED", label: "차단", desc: "자기 추천 등 어뷰즈", tone: "bg-red-50 text-red-600" },
  { key: "REVOKED", label: "철회", desc: "보상 철회 완료", tone: "bg-[#F0F2F8] text-[#6B7399]" },
];

const FILTERS: { key: ReferralStatusFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "REWARDED", label: "인정" },
  { key: "BLOCKED", label: "차단" },
  { key: "REVOKED", label: "철회" },
];

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function filterHref(status: ReferralStatusFilter): string {
  return status === "ALL" ? "/admin/referrals" : `/admin/referrals?status=${status}`;
}

export function ReferralLedgerBoard({ page }: { page: ReferralLedgerPage }) {
  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-[#1A1A2E] flex items-center gap-2">
          <Users size={20} className="text-[#000666]" /> 추천인 원장
        </h1>
        <p className="text-sm text-[#9BA4C0] mt-1">
          추천 인정 원장(Referral) 전체 내역입니다. 추천인·피추천인은 마스킹된 식별자로만
          표기되며, 차단 해제·보상 철회 처리는 감사 로그에 기록됩니다.
        </p>
      </div>

      {/* 상태별 카운트 */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_CARDS.map(({ key, label, desc, tone }) => (
          <div key={key} className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className={cn("px-2 py-0.5 rounded-[4px] text-[11px] font-semibold", tone)}>
                {label}
              </span>
              <span className="text-[10px] font-mono text-[#9BA4C0]">{key}</span>
            </div>
            <p className="mt-2 text-[26px] font-bold text-[#1A1A2E] tabular-nums leading-none">
              {page.counts[key as "REWARDED"].toLocaleString("ko-KR")}
            </p>
            <p className="text-[11px] text-[#9BA4C0] mt-1.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* 원장 목록 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-semibold text-[#1A1A2E]">원장 내역</h2>
          <span className="text-[12px] text-[#9BA4C0]">
            총 {page.total.toLocaleString("ko-KR")}건 · 페이지당 {page.pageSize}건
          </span>
          <div className="ml-auto flex items-center gap-1">
            {FILTERS.map(({ key, label }) => (
              <Link
                key={key}
                href={filterHref(key)}
                className={cn(
                  "px-2.5 py-1 rounded-[6px] text-[12px] font-medium border transition-colors",
                  page.statusFilter === key
                    ? "bg-[#000666] text-white border-[#000666]"
                    : "bg-white text-[#5A6080] border-[#E8EAF0] hover:border-[#6B7399]"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[8px] border border-[#E8EAF0] overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13px]">
            <thead>
              <tr className="bg-[#F8F9FC] border-b border-[#E8EAF0]">
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">일시</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">추천인</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">피추천인</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">코드</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">상태</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#5A6080]">가입 IP 해시</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#5A6080]">처리</th>
              </tr>
            </thead>
            <tbody>
              {page.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-[#9BA4C0]">
                    추천 인정 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                page.items.map((item) => {
                  const card = STATUS_CARDS.find((c) => c.key === item.status);
                  return (
                    <tr key={item.id} className="border-b border-[#F0F2F8] hover:bg-[#F8F9FC]">
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="text-[#1A1A2E]">
                          {formatRelativeTime(new Date(item.createdAt))}
                        </div>
                        <div className="text-[11px] text-[#9BA4C0] font-mono">
                          {formatDate(item.createdAt)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#1A1A2E]">
                        <div className="break-all">{item.referrer.masked}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#1A1A2E]">
                        <div className="break-all">{item.referee.masked}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#1A1A2E] font-mono text-[11px]">
                        {item.code}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-[4px] text-[11px] font-semibold",
                            card?.tone
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[#6B7399] font-mono text-[11px] break-all max-w-[160px]">
                        {item.signupIpHash ?? "-"}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right">
                        <ReferralStatusActions referralId={item.id} status={item.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 — 링크 기반(SSR 유지) */}
        {page.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-[13px]">
            {page.page > 1 ? (
              <Link
                href={`/admin/referrals?${buildParams(page.statusFilter, page.page - 1)}`}
                className="px-3 py-1.5 rounded-[6px] bg-white border border-[#E8EAF0] text-[#5A6080] hover:border-[#6B7399]"
              >
                이전
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-[6px] bg-[#F8F9FC] border border-[#F0F2F8] text-[#9BA4C0]">
                이전
              </span>
            )}
            <span className="text-[#5A6080] tabular-nums">
              {page.page} / {page.totalPages}
            </span>
            {page.page < page.totalPages ? (
              <Link
                href={`/admin/referrals?${buildParams(page.statusFilter, page.page + 1)}`}
                className="px-3 py-1.5 rounded-[6px] bg-white border border-[#E8EAF0] text-[#5A6080] hover:border-[#6B7399]"
              >
                다음
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-[6px] bg-[#F8F9FC] border border-[#F0F2F8] text-[#9BA4C0]">
                다음
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function buildParams(status: ReferralStatusFilter, page: number): string {
  if (status === "ALL") return `page=${page}`;
  return `status=${status}&page=${page}`;
}
