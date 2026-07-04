"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/constants/customer-types";
import { DOC_TYPES, docTypesForCustomer, type DocType } from "@/lib/codef/doc-types";
import { EasyAuthAwaitingAction } from "./EasyAuthAwaitingAction";
import { EasyAuthProviderSelection } from "./EasyAuthProviderSelection";

export interface EasyAuthInfo {
  userName: string;
  birthDate: string; // YYYYMMDD (홈택스 회원 간편인증 본인확인값)
  phoneNo: string;
}

// 부가세 과세기간(기수 코드 yyyyMM): 가장 최근 신고완료 기수.
// 1기(상반기) 신고기한 ~7/25, 2기(하반기) 신고기한 ~익년 1/25 기준 보수적 선택.
// 데모 실호출로 발급 가능 기수 재확인 필요(미신고 기수는 CF 오류).
function vatPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 8) return `${y}01`; // 올해 1기
  if (m >= 2) return `${y - 1}07`; // 작년 2기
  return `${y - 1}01`; // 1월: 작년 1기
}

// 재무제표 사업종료년월(yyyyMM): 12월 결산법인 가정, 최근 신고완료 사업연도.
// 법인세 신고기한은 익년 3/31이고 전산반영 익월말 기준이므로 5월부터 작년분 안전.
// 비(非)12월 결산법인은 값이 달라질 수 있어 데모 검증 필요.
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
  // 컴포넌트가 언마운트된 뒤에도 setTimeout 콜백이 state/요청을 건드리지 않도록 가드한다.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  // 문서 i 의 1차 요청으로 간편인증 푸시 발송
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

  // 사용자 인증 완료 후 2차 요청으로 문서 수신
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
      window.setTimeout(() => {
        if (mountedRef.current) onDone();
      }, 600);
      return;
    }
    setCurrent(next);
    window.setTimeout(() => {
      if (mountedRef.current) startDoc(next);
    }, 300);
  }

  function begin() {
    setPhase("run");
    setCurrent(0);
    void startDoc(0);
  }

  // ─── 제공자 선택 화면 ───────────────────────────────────
  if (phase === "select") {
    return (
      <EasyAuthProviderSelection
        docTypes={docTypes}
        provider={provider}
        telecom={telecom}
        onProviderChange={setProvider}
        onTelecomChange={setTelecom}
        onBack={onBack}
        onBegin={begin}
      />
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
        {docs.map((d, i) => {
          const isFailed = d.phase === "failed";
          return (
            <div
              key={d.docType}
              className={cn(
                "rounded-[12px] border px-4 py-3",
                isFailed
                  ? "border-red-200 bg-red-50/60"
                  : i === current
                    ? "border-primary/40 bg-primary/[0.04]"
                    : "border-public-border bg-white"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-ink">{DOC_TYPES[d.docType].label}</span>
                <DocBadge phase={d.phase} />
              </div>
              {isFailed && d.error && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-red-600">
                  {d.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 현재 문서 액션 */}
      {cur.phase === "awaiting" && (
        <EasyAuthAwaitingAction
          key={cur.docType}
          docLabel={DOC_TYPES[cur.docType].label}
          busy={busy}
          onConfirm={() => confirmDoc(current)}
        />
      )}
    </div>
  );
}

function DocBadge({ phase }: { phase: DocPhase }) {
  if (phase === "done")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
        <CheckCircle2 size={14} /> 완료
      </span>
    );
  if (phase === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-red-500">
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
