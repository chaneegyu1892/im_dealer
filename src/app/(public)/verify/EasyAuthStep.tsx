"use client";

import { useState } from "react";
import { ChevronLeft, Smartphone, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/constants/customer-types";
import { DOC_TYPES, docTypesForCustomer, type DocType } from "@/lib/codef/doc-types";

// ─── 간편인증 제공자 (loginTypeLevel) ─────────────────────
const PROVIDERS: { level: string; label: string; icon: string }[] = [
  { level: "1", label: "카카오", icon: "💬" },
  { level: "5", label: "통신사 PASS", icon: "📱" },
  { level: "6", label: "네이버", icon: "🟢" },
  { level: "8", label: "토스", icon: "🔵" },
];

const TELECOMS: { value: string; label: string }[] = [
  { value: "0", label: "SKT" },
  { value: "1", label: "KT" },
  { value: "2", label: "LG U+" },
];

export interface EasyAuthInfo {
  userName: string;
  birthDate: string; // YYYYMMDD (홈택스 회원 간편인증 본인확인값)
  phoneNo: string;
}

// 부가세 과세기간(기수 코드 yyyyMM): 가장 최근 신고완료 기수.
// 1기(상반기) 신고기한 ~7/25, 2기(하반기) 신고기한 ~익년 1/25 기준 보수적 선택.
// ⚠️ 데모 실호출로 발급 가능 기수 재확인 필요(미신고 기수는 CF 오류).
function vatPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 8) return `${y}01`; // 올해 1기
  if (m >= 2) return `${y - 1}07`; // 작년 2기
  return `${y - 1}01`; // 1월: 작년 1기
}

// 재무제표 사업종료년월(yyyyMM): 12월 결산법인 가정, 최근 신고완료 사업연도.
// 법인세 신고기한 ~익년 3/31 + 전산반영 익월말 → 5월부터 작년분 안전.
// ⚠️ 비(非)12월 결산법인은 값이 달라질 수 있어 데모 검증 필요.
function corpFiscalEndMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${m >= 5 ? y - 1 : y - 2}12`;
}

interface Props {
  verificationId: string;
  customerType: CustomerType;
  info: EasyAuthInfo;
  onDone: () => void;
  onBack: () => void;
}

type DocPhase = "pending" | "awaiting" | "running" | "done" | "failed";

interface DocState {
  docType: DocType;
  phase: DocPhase;
  error?: string;
}

interface TwoWayInfo {
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: number;
}

export function EasyAuthStep({ verificationId, customerType, info, onDone, onBack }: Props) {
  const docTypes = docTypesForCustomer(customerType);

  const [provider, setProvider] = useState<string>("1");
  const [telecom, setTelecom] = useState<string>("0");
  const [phase, setPhase] = useState<"select" | "run">("select");
  const [docs, setDocs] = useState<DocState[]>(
    docTypes.map((d) => ({ docType: d, phase: "pending" }))
  );
  const [current, setCurrent] = useState(0);
  const [twoWay, setTwoWay] = useState<TwoWayInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const body = (docType: DocType) => {
    const base = {
      verificationId,
      docType,
      userName: info.userName,
      birthDate: info.birthDate || undefined,
      phoneNo: info.phoneNo,
      loginTypeLevel: provider,
      telecom: provider === "5" ? telecom : undefined,
      id: verificationId,
    };
    // 과세기간은 상품별로 형식이 달라 docType 시점에 계산해 주입한다.
    if (docType === "vat_taxbase") {
      const period = vatPeriod();
      return { ...base, taxStartMonth: period, taxEndMonth: period };
    }
    if (docType === "financial_statements") {
      return { ...base, taxStartMonth: corpFiscalEndMonth() };
    }
    return base;
  };

  const setDoc = (i: number, patch: Partial<DocState>) =>
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  // 문서 i 의 1차 요청 → 간편인증 푸시 발송
  async function startDoc(i: number) {
    setBusy(true);
    setDoc(i, { phase: "running", error: undefined });
    try {
      const res = await fetch("/api/verification/easyauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(docs[i].docType)),
      });
      const data = (await res.json().catch(() => ({}))) as {
        twoWayInfo?: TwoWayInfo;
        error?: string;
      };
      if (!res.ok || !data.twoWayInfo) {
        setDoc(i, { phase: "failed", error: data.error ?? "간편인증 요청 실패" });
        advance(i);
        return;
      }
      setTwoWay(data.twoWayInfo);
      setDoc(i, { phase: "awaiting" });
    } catch {
      setDoc(i, { phase: "failed", error: "네트워크 오류" });
      advance(i);
    } finally {
      setBusy(false);
    }
  }

  // 사용자 인증 완료 후 2차 요청 → 문서 수신
  async function confirmDoc(i: number) {
    if (!twoWay) return;
    setBusy(true);
    setDoc(i, { phase: "running" });
    try {
      const res = await fetch("/api/verification/easyauth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body(docs[i].docType), twoWayInfo: twoWay }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; code?: string };
      setDoc(i, data.success ? { phase: "done" } : { phase: "failed", error: data.code ?? "발급 실패" });
    } catch {
      setDoc(i, { phase: "failed", error: "네트워크 오류" });
    } finally {
      setTwoWay(null);
      setBusy(false);
      advance(i);
    }
  }

  // 다음 문서로 진행, 끝이면 완료
  function advance(i: number) {
    const next = i + 1;
    if (next >= docs.length) {
      window.setTimeout(onDone, 600);
      return;
    }
    setCurrent(next);
    window.setTimeout(() => startDoc(next), 300);
  }

  function begin() {
    setFatal(null);
    setPhase("run");
    setCurrent(0);
    void startDoc(0);
  }

  // ─── 제공자 선택 화면 ───────────────────────────────────
  if (phase === "select") {
    return (
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-[18px] font-semibold text-ink">간편인증으로 서류를 받습니다</p>
          <p className="text-[12px] leading-relaxed text-public-muted">
            아래 {docTypes.length}개 서류를 공공기관에서 직접 발급받습니다. 사용할 간편인증을 선택하세요.
          </p>
        </div>

        <div className="rounded-[14px] border border-public-border bg-[#FAFBFE] p-3">
          <p className="public-quiet-label mb-2">받을 서류</p>
          <div className="space-y-1.5">
            {docTypes.map((d) => (
              <div key={d} className="flex items-center gap-2 text-[13px] text-ink">
                <CheckCircle2 size={14} className="text-primary/50" />
                {DOC_TYPES[d].label}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="public-quiet-label mb-2">간편인증 수단</p>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.level}
                type="button"
                onClick={() => setProvider(p.level)}
                className={cn(
                  "flex items-center gap-2 rounded-[12px] border p-3 text-left transition-all active:scale-[0.99]",
                  provider === p.level
                    ? "border-primary bg-primary/[0.06]"
                    : "border-public-border bg-white hover:border-primary/30"
                )}
              >
                <span className="text-[18px]">{p.icon}</span>
                <span className="text-[13px] font-medium text-ink">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {provider === "5" && (
          <div>
            <p className="public-quiet-label mb-2">통신사</p>
            <div className="grid grid-cols-3 gap-2">
              {TELECOMS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTelecom(t.value)}
                  className={cn(
                    "rounded-[12px] border py-2.5 text-[13px] font-medium transition-all",
                    telecom === t.value
                      ? "border-primary bg-primary/[0.06] text-primary"
                      : "border-public-border bg-white text-ink-label"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="md"
            onClick={onBack}
            className="min-h-[48px] shrink-0 rounded-[12px] border-public-border bg-white px-4 text-ink-label"
          >
            <ChevronLeft size={16} />
            이전
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={begin}
            className="min-h-[48px] rounded-[12px] font-semibold"
          >
            간편인증 시작
          </Button>
        </div>
      </div>
    );
  }

  // ─── 진행 화면 ──────────────────────────────────────────
  const cur = docs[current];
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[18px] font-semibold text-ink">서류 발급 중</p>
        <p className="text-[12px] leading-relaxed text-public-muted">
          {cur.phase === "awaiting"
            ? "휴대폰 간편인증 앱에서 인증을 완료한 뒤 아래 버튼을 눌러주세요."
            : "각 서류를 순서대로 발급합니다."}
        </p>
      </div>

      {/* 문서별 진행 상태 */}
      <div className="space-y-2">
        {docs.map((d, i) => (
          <div
            key={d.docType}
            className={cn(
              "flex items-center justify-between rounded-[12px] border px-4 py-3",
              i === current ? "border-primary/40 bg-primary/[0.04]" : "border-public-border bg-white"
            )}
          >
            <span className="text-[13px] font-medium text-ink">{DOC_TYPES[d.docType].label}</span>
            <DocBadge phase={d.phase} error={d.error} />
          </div>
        ))}
      </div>

      {/* 현재 문서 액션 */}
      {cur.phase === "awaiting" && (
        <div className="rounded-[14px] border border-primary/20 bg-primary/[0.05] p-4 text-center">
          <Smartphone size={28} className="mx-auto mb-2 text-primary" />
          <p className="text-[13px] font-medium text-ink">{DOC_TYPES[cur.docType].label} 인증 대기 중</p>
          <p className="mb-3 mt-1 text-[12px] text-public-muted">휴대폰에서 인증을 완료하세요 (4분 30초 내)</p>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={busy}
            onClick={() => confirmDoc(current)}
            className="min-h-[48px] rounded-[12px] font-semibold"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> 확인 중...
              </span>
            ) : (
              "인증을 완료했어요"
            )}
          </Button>
        </div>
      )}

      {fatal && (
        <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {fatal}
        </div>
      )}
    </div>
  );
}

function DocBadge({ phase, error }: { phase: DocPhase; error?: string }) {
  if (phase === "done")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
        <CheckCircle2 size={14} /> 완료
      </span>
    );
  if (phase === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-red-500" title={error}>
        <XCircle size={14} /> 실패
      </span>
    );
  if (phase === "awaiting" || phase === "running")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary">
        <Loader2 size={14} className="animate-spin" /> 진행 중
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-public-muted">
      <Clock size={14} /> 대기
    </span>
  );
}
