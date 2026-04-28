"use client";

import { useState, useEffect } from "react";
import { FileSearch, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 타입 ────────────────────────────────────────────────
interface VerificationRecord {
  id: string;
  sessionId: string;
  customerType: string;
  connectedId: string | null;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  licenseData: Record<string, unknown> | null;
  insuranceData: Record<string, unknown> | null;
  bizData: Record<string, unknown> | null;
  consentedAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

interface Props {
  sessionId: string;
}

// ─── 상태 뱃지 ───────────────────────────────────────────
function StatusBadge({
  status,
}: {
  status: "verified" | "failed" | "pending";
}) {
  const map = {
    verified: {
      icon: <CheckCircle2 size={12} />,
      label: "확인됨",
      cls: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    failed: {
      icon: <XCircle size={12} />,
      label: "불일치",
      cls: "bg-red-50 text-red-600 border-red-200",
    },
    pending: {
      icon: <Clock size={12} />,
      label: "미조회",
      cls: "bg-[#F4F5F8] text-[#9BA4C0] border-[#E8EAF0]",
    },
  } as const;

  const { icon, label, cls } = map[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[4px] border",
        cls
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ─── 결과 행 ─────────────────────────────────────────────
function ResultRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: "verified" | "failed" | "pending";
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F0F2F8] last:border-0">
      <div>
        <p className="text-[12px] font-medium text-[#1A1A2E]">{label}</p>
        {detail && (
          <p className="text-[11px] text-[#9BA4C0] mt-0.5">{detail}</p>
        )}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

// ─── 고객 유형 한글 변환 ──────────────────────────────────
function formatCustomerType(type: string) {
  const map: Record<string, string> = {
    individual: "개인",
    self_employed: "개인사업자",
    corporate: "법인",
    nonprofit: "비영리법인",
  };
  return map[type] ?? type;
}

// ─── 날짜 포맷 ───────────────────────────────────────────
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export function VerificationResult({ sessionId }: Props) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "none" }
    | { status: "error" }
    | { status: "ok"; data: VerificationRecord }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setState({ status: "loading" });
      try {
        const res = await fetch(
          `/api/verification/session/${encodeURIComponent(sessionId)}`
        );

        if (!res.ok) {
          if (!cancelled) setState({ status: "none" });
          return;
        }

        const json = (await res.json()) as {
          success: boolean;
          data?: VerificationRecord;
        };

        if (!cancelled) {
          if (json.success && json.data) {
            setState({ status: "ok", data: json.data });
          } else {
            setState({ status: "none" });
          }
        }
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="rounded-[10px] border border-[#E8EAF0] overflow-hidden">
      {/* 섹션 헤더 */}
      <div className="bg-[#F8F9FC] px-4 py-3 flex items-center gap-2 border-b border-[#E8EAF0]">
        <FileSearch size={14} className="text-[#6B7399]" />
        <p className="text-[12px] font-semibold text-[#6B7399] uppercase tracking-wide">
          서류 확인 결과
        </p>
      </div>

      <div className="bg-white p-4">
        {/* 로딩 */}
        {state.status === "loading" && (
          <div className="flex items-center gap-2 py-3">
            <div className="w-3 h-3 rounded-full border-2 border-[#000666] border-t-transparent animate-spin" />
            <p className="text-[12px] text-[#9BA4C0]">조회 중...</p>
          </div>
        )}

        {/* 서류 미제출 */}
        {(state.status === "none" || state.status === "error") && (
          <div className="flex items-center gap-2.5 py-3 text-[#9BA4C0]">
            <AlertCircle size={14} />
            <p className="text-[12px]">
              {state.status === "none" ? "서류 미제출" : "조회 중 오류가 발생했습니다."}
            </p>
          </div>
        )}

        {/* 결과 있음 */}
        {state.status === "ok" && (
          <div className="space-y-3">
            {/* 메타 정보 */}
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F2F8]">
              <span className="text-[11px] text-[#9BA4C0]">
                고객 유형:{" "}
                <span className="font-medium text-[#4A5270]">
                  {formatCustomerType(state.data.customerType)}
                </span>
              </span>
              {state.data.verifiedAt && (
                <span className="text-[11px] text-[#9BA4C0]">
                  조회:{" "}
                  <span className="font-medium text-[#4A5270]">
                    {formatDateTime(state.data.verifiedAt)}
                  </span>
                </span>
              )}
            </div>

            {/* 운전면허 */}
            <ResultRow
              label="운전면허 진위확인"
              status={
                state.data.verifiedAt === null
                  ? "pending"
                  : state.data.licenseVerified
                  ? "verified"
                  : "failed"
              }
              detail={
                state.data.licenseData
                  ? extractLicenseDetail(state.data.licenseData)
                  : undefined
              }
            />

            {/* 건강보험 (개인/개인사업자) */}
            {(state.data.customerType === "individual" ||
              state.data.customerType === "self_employed") && (
              <ResultRow
                label="건강보험 자격득실"
                status={
                  state.data.verifiedAt === null
                    ? "pending"
                    : state.data.insuranceVerified
                    ? "verified"
                    : "failed"
                }
                detail={
                  state.data.insuranceData
                    ? extractInsuranceDetail(state.data.insuranceData)
                    : undefined
                }
              />
            )}

            {/* 사업자등록 (개인사업자/법인) */}
            {(state.data.customerType === "self_employed" ||
              state.data.customerType === "corporate" ||
              state.data.customerType === "nonprofit") && (
              <ResultRow
                label="사업자등록 상태"
                status={
                  state.data.verifiedAt === null
                    ? "pending"
                    : state.data.bizVerified
                    ? "verified"
                    : "failed"
                }
                detail={
                  state.data.bizData
                    ? extractBizDetail(state.data.bizData)
                    : undefined
                }
              />
            )}

            {/* 동의 일시 */}
            <p className="text-[11px] text-[#B0B8D0] pt-1">
              동의 일시: {formatDateTime(state.data.consentedAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 데이터 추출 헬퍼 ─────────────────────────────────────
// Codef 샌드박스 응답 구조에 맞게 필요한 필드를 안전하게 추출

function extractLicenseDetail(data: Record<string, unknown>): string | undefined {
  // Codef 운전면허 응답: data.resLicenseInfo 등
  const status =
    safeString(data, "resLicenseStatus") ??
    safeString(data, "status");
  return status ?? undefined;
}

function extractInsuranceDetail(data: Record<string, unknown>): string | undefined {
  // Codef 건강보험 응답: 직장명, 취득일 등
  const workplace =
    safeString(data, "resWorkplaceName") ??
    safeString(data, "workplaceName");
  return workplace ?? undefined;
}

function extractBizDetail(data: Record<string, unknown>): string | undefined {
  // Codef 사업자등록 응답: 사업자번호, 상태
  const status =
    safeString(data, "resBizStatus") ??
    safeString(data, "bizStatus") ??
    safeString(data, "status");
  return status ?? undefined;
}

function safeString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const val = obj[key];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}
