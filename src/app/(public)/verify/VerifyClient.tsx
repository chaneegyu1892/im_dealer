"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Shield, FileText, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectionCard } from "@/components/recommend/SelectionCard";
import { cn } from "@/lib/utils";
import {
  type CustomerType,
  CUSTOMER_TYPE_LABELS,
  isCustomerType,
} from "@/constants/customer-types";
import {
  LEGACY_QUOTE_STORAGE_PREFIX,
  QUOTE_DRAFT_STORAGE_PREFIX,
  parseLegacyQuoteDraft,
  parseQuoteDraft,
} from "@/lib/quote-draft";
import { EasyAuthStep } from "./EasyAuthStep";

// ─── 타입 ────────────────────────────────────────────────
type Step = 1 | 2 | 3 | "easyauth" | "done";

interface FormState {
  name: string;
  rrnFront: string; // 주민번호 앞 6자리
  rrnBack: string; // 주민번호 뒤 7자리
  phone: string;
}

// 주민번호에서 생년월일 YYYYMMDD 생성 (홈택스 loginIdentity 용)
function rrnToBirthDate(rrn: string): string {
  if (rrn.length < 7) return "";
  const yy = rrn.slice(0, 2);
  const mmdd = rrn.slice(2, 6);
  const g = rrn[6];
  const century =
    g === "1" || g === "2" || g === "5" || g === "6"
      ? "19"
      : g === "3" || g === "4" || g === "7" || g === "8"
      ? "20"
      : "19";
  return `${century}${yy}${mmdd}`;
}

// ─── StepIndicator ────────────────────────────────────────
const VERIFY_STEPS = [
  { id: 1 as const, label: "동의" },
  { id: 2 as const, label: "유형" },
  { id: 3 as const, label: "정보입력" },
  { id: 4 as const, label: "간편인증" },
];

function stepToNum(step: Step): number {
  if (step === "done") return VERIFY_STEPS.length + 1;
  if (step === "easyauth") return 4;
  return step;
}

function VerifyStepIndicator({ currentStep }: { currentStep: Step }) {
  const activeNum = stepToNum(currentStep);
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="public-quiet-label">심사 진행</span>
        <span className="text-[12px] font-semibold text-primary">
          {currentStep === "done" ? "완료" : `${stepToNum(currentStep)} / ${VERIFY_STEPS.length}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
      {VERIFY_STEPS.map((step) => {
        const isDone = step.id < activeNum;
        const isActive = step.id === activeNum;
        return (
          <div key={step.id} className="min-w-0 flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                step.id <= activeNum ? "bg-primary" : "bg-border-subtle"
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                  "text-[11px] font-semibold transition-all duration-300",
                  isDone && "bg-primary text-white",
                  isActive && "bg-primary text-white",
                  !isDone && !isActive && "bg-surface-soft text-public-muted"
                )}
              >
                {isDone ? <Check size={11} strokeWidth={3} /> : <span>{step.id}</span>}
              </div>
              <span
                className={cn(
                  "truncate text-[11px] leading-none",
                  isActive ? "text-primary font-medium" : "text-ink-label"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ─── Step 1: 동의 ─────────────────────────────────────────
interface Step1Props {
  consents: { privacy: boolean; codef: boolean };
  onChange: (key: "privacy" | "codef") => void;
  onNext: () => void;
}

function Step1Consent({ consents, onChange, onNext }: Step1Props) {
  const allConsented = consents.privacy && consents.codef;

  const items = [
    {
      icon: <FileText size={18} className="text-primary" />,
      title: "근로소득 원천징수영수증",
      desc: "국세청 홈택스에서 발급받습니다. (개인)",
    },
    {
      icon: <Building2 size={18} className="text-primary" />,
      title: "사업자등록증명",
      desc: "국세청 홈택스에서 발급받습니다. (개인사업자·법인)",
    },
    {
      icon: <FileText size={18} className="text-primary" />,
      title: "부가가치세과세표준증명",
      desc: "국세청 홈택스에서 발급받습니다. (개인사업자·법인)",
    },
    {
      icon: <FileText size={18} className="text-primary" />,
      title: "표준재무제표증명",
      desc: "국세청 홈택스에서 발급받습니다. (법인)",
    },
  ];

  return (
    <div className="space-y-5">
      {/* 안내 카드 */}
      <div className="rounded-[16px] border border-primary/15 bg-primary/[0.04] p-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-full bg-white border border-primary/15 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink">공공기관 데이터 조회 안내</p>
            <p className="text-[12px] text-public-muted mt-0.5">Codef를 통해 필요한 서류만 확인합니다</p>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="mt-0.5 w-7 h-7 rounded-full bg-white border border-border-subtle flex items-center justify-center flex-shrink-0 shadow-sm">
                {item.icon}
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink">{item.title}</p>
                <p className="text-[12px] text-public-muted mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 동의 체크박스 */}
      <div className="space-y-3">
        {(
          [
            {
              key: "privacy" as const,
              label: "[필수] 개인정보 수집·이용에 동의합니다",
              sub: "이름, 주민등록번호, 주소 등을 서류 발급 목적으로 수집합니다.",
            },
            {
              key: "codef" as const,
              label: "[필수] 공공기관 데이터 조회에 동의합니다",
              sub: "Codef를 통해 공공기관 API로 서류를 자동 조회합니다.",
            },
          ] as const
        ).map(({ key, label, sub }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "w-full text-left rounded-[14px] border p-4 transition-all duration-200 active:scale-[0.99]",
              consents[key]
                ? "border-primary bg-primary/[0.06]"
                : "border-public-border bg-white hover:border-primary/30"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                  consents[key] ? "border-primary bg-primary" : "border-border-strong bg-white"
                )}
              >
                {consents[key] && <Check size={10} strokeWidth={3} className="text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{label}</p>
                <p className="text-[12px] text-public-muted mt-1 leading-relaxed">{sub}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!allConsented}
        onClick={onNext}
        className="min-h-[48px] rounded-[12px] text-[15px] font-semibold"
      >
        동의하고 계속
      </Button>
    </div>
  );
}

// ─── Step 2: 고객 유형 선택 ───────────────────────────────
interface Step2Props {
  value: CustomerType;
  onChange: (v: CustomerType) => void;
  onNext: () => void;
  onBack: () => void;
}

const CUSTOMER_TYPE_OPTIONS: {
  type: CustomerType;
  label: string;
  desc: string;
}[] = [
  { type: "individual", label: "개인", desc: "근로소득 원천징수영수증" },
  { type: "self_employed", label: "개인사업자", desc: "사업자등록증명 · 부가가치세 과세표준증명" },
  { type: "corporate", label: "법인", desc: "사업자등록증명 · 재무제표 · 부가가치세 과세표준증명" },
];

function Step2CustomerType({ value, onChange, onNext, onBack }: Step2Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[18px] font-semibold text-ink">고객 유형을 선택하세요</p>
        <p className="text-[12px] leading-relaxed text-public-muted">유형에 따라 확인할 서류가 달라집니다.</p>
      </div>

      <div className="space-y-3">
        {CUSTOMER_TYPE_OPTIONS.map((opt) => (
          <SelectionCard
            key={opt.type}
            label={opt.label}
            desc={opt.desc}
            selected={value === opt.type}
            onClick={() => onChange(opt.type)}
          />
        ))}
      </div>

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
        <Button variant="primary" size="md" fullWidth onClick={onNext} className="min-h-[48px] rounded-[12px] font-semibold">
          다음
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: 정보 입력 ────────────────────────────────────
interface Step3Props {
  form: FormState;
  onChange: (key: keyof FormState, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}

function InputField({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "w-full rounded-[12px] border border-public-border bg-white px-4 py-3.5",
          "text-[14px] text-ink placeholder:text-ink-caption",
          "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15",
          "transition-all duration-150"
        )}
      />
      {hint && <p className="text-[11px] text-public-muted">{hint}</p>}
    </div>
  );
}

function Step3Form({
  form,
  onChange,
  onSubmit,
  onBack,
  loading,
  error,
}: Step3Props) {
  const isValid =
    form.name.trim() !== "" &&
    form.rrnFront.length === 6 &&
    form.rrnBack.length === 7 &&
    form.phone.trim() !== "";

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[18px] font-semibold text-ink">본인 정보를 입력하세요</p>
        <p className="text-[12px] leading-relaxed text-public-muted">
          입력하신 정보는 서류 확인 후 즉시 파기됩니다.
        </p>
      </div>

      <div className="space-y-4">
        <InputField
          label="이름"
          id="name"
          value={form.name}
          onChange={(v) => onChange("name", v)}
          placeholder="홍길동"
        />
        <div className="space-y-1.5">
          <label className="block text-[13px] font-semibold text-ink">주민등록번호</label>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={form.rrnFront}
              onChange={(e) => onChange("rrnFront", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="앞 6자리"
              className={cn(
                "w-full rounded-[12px] border border-public-border bg-white px-4 py-3.5",
                "text-[14px] text-ink placeholder:text-ink-caption tracking-wider",
                "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              )}
            />
            <span className="font-semibold text-ink-caption">-</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={form.rrnBack}
              onChange={(e) => onChange("rrnBack", e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder="뒤 7자리"
              className={cn(
                "w-full rounded-[12px] border border-public-border bg-white px-4 py-3.5",
                "text-[14px] text-ink placeholder:text-ink-caption tracking-wider",
                "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              )}
            />
          </div>
          <p className="text-[11px] text-public-muted">공공기관 본인확인용. 뒷자리는 가려지고 암호화 처리됩니다.</p>
        </div>
        <InputField
          label="휴대폰 번호"
          id="phone"
          value={form.phone}
          onChange={(v) => onChange("phone", v.replace(/\D/g, "").slice(0, 11))}
          placeholder="01012345678"
          hint="간편인증 푸시를 받을 번호"
        />
      </div>

      {error && (
        <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="secondary"
          size="md"
          onClick={onBack}
          disabled={loading}
          className="min-h-[48px] shrink-0 rounded-[12px] border-public-border bg-white px-4 text-ink-label"
        >
          <ChevronLeft size={16} />
          이전
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={!isValid || loading}
          onClick={onSubmit}
          className="min-h-[48px] rounded-[12px] font-semibold"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              준비 중...
            </span>
          ) : (
            "간편인증으로 진행"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── 완료 화면 ────────────────────────────────────────────
function DoneScreen() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center text-center py-10 space-y-6">
      <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-emerald-500" />
      </div>
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-ink">확인 요청이 완료되었습니다.</p>
        <p className="text-[13px] text-public-muted leading-relaxed max-w-xs">
          딜러가 서류를 검토한 후 순차적으로 연락드립니다.
          <br />
          보통 영업일 기준 1~2일 내에 연락드립니다.
        </p>
      </div>
      <div className="w-full pt-4">
        <Button
          variant="outlined"
          size="md"
          fullWidth
          onClick={() => router.push("/")}
          className="min-h-[48px] rounded-[12px] border-public-border bg-white font-semibold"
        >
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}

function NoSessionScreen() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <div className="rounded-[28px] border border-border-subtle bg-surface p-5 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-brand-soft text-brand">
          <Shield size={22} />
        </span>
        <h2 className="mt-5 break-keep text-[24px] font-extrabold leading-[1.22] text-text-strong">
          견적을 선택한 뒤
          <br />
          서류 확인을 진행해요
        </h2>
        <p className="mt-3 break-keep text-[14px] font-medium leading-relaxed text-text-body">
          서류 확인은 선택한 차량과 견적 조건에 연결됩니다. 먼저 차량을 고르고 월 납입 구조를 확인해주세요.
        </p>
        <div className="mt-6 grid gap-2">
          <Link
            href="/cars"
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-text-strong px-5 text-[14px] font-extrabold text-surface transition-colors duration-state hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          >
            차량 탐색하기
          </Link>
          <Link
            href="/recommend"
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-5 text-[14px] font-extrabold text-text-strong transition-colors duration-state hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          >
            AI 추천으로 시작하기
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 클라이언트 컴포넌트 ─────────────────────────────
function formatVehicleSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function VerifyClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("sessionId") ?? null;
  const vehicleSlug = searchParams?.get("vehicle") ?? null;
  const customerTypeParam = searchParams?.get("customerType") ?? null;
  const presetCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;

  const [step, setStep] = useState<Step>(1);
  const [consents, setConsents] = useState({ privacy: false, codef: false });
  const [customerType, setCustomerType] = useState<CustomerType>(
    presetCustomerType ?? "individual"
  );
  const [form, setForm] = useState<FormState>({
    name: "",
    rrnFront: "",
    rrnBack: "",
    phone: "",
  });
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleConsent = (key: "privacy" | "codef") => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFormChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // 동의 저장 후 verificationId 발급, 간편인증 단계로 진입
      const consentRes = await fetch("/api/verification/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerType,
          consentedAt: new Date().toISOString(),
        }),
      });
      if (!consentRes.ok) {
        const data = (await consentRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "동의 저장에 실패했습니다.");
      }
      const { data: consentData } = (await consentRes.json()) as {
        data: { verificationId: string };
      };
      setVerificationId(consentData.verificationId);
      setStep("easyauth");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  // 간편인증 문서수집 완료 후 견적 초안 저장, 완료 화면
  const handleEasyAuthDone = async () => {
    if (!sessionId) {
      setStep("done");
      return;
    }
    try {
      const draftKey = `${QUOTE_DRAFT_STORAGE_PREFIX}${sessionId}`;
      const legacyKey = `${LEGACY_QUOTE_STORAGE_PREFIX}${sessionId}`;
      const draftQuote = parseQuoteDraft(localStorage.getItem(draftKey), sessionId);
      const legacyQuote = draftQuote
        ? null
        : parseLegacyQuoteDraft(sessionStorage.getItem(legacyKey), sessionId);
      const quoteDraft = draftQuote ?? legacyQuote;

      if (quoteDraft) {
        const scenario = quoteDraft.scenarios.standard ?? quoteDraft.scenarios.conservative;
        await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            vehicleId: quoteDraft.vehicleSlug,
            trimId: quoteDraft.trimId,
            contractMonths: quoteDraft.contractMonths,
            annualMileage: quoteDraft.annualMileage,
            depositRate: scenario?.depositAmount ? 20 : 0,
            prepayRate: scenario?.prepayAmount ? 30 : 0,
            contractType: quoteDraft.contractType,
            customerType: quoteDraft.customerType ?? customerType,
            monthlyPayment: scenario?.monthlyPayment || 0,
            totalCost: (scenario?.monthlyPayment || 0) * quoteDraft.contractMonths,
            breakdown: {
              productType: quoteDraft.productType,
              selectedOptionIds: quoteDraft.selectedOptionIds,
              optionsTotalPrice: quoteDraft.optionsTotalPrice,
              totalVehiclePrice: quoteDraft.totalVehiclePrice,
              scenarioBreakdown: scenario?.breakdown || {},
              surcharges: scenario?.surcharges || {},
            },
            customerName: form.name,
            phone: form.phone || "연락처 미입력",
          }),
        });
        localStorage.removeItem(draftKey);
        sessionStorage.removeItem(legacyKey);
      }
    } catch {
      // 견적 저장 실패는 치명적이지 않다 — 서류는 이미 수집됨. 완료로 진행.
    } finally {
      setStep("done");
    }
  };

  if (!sessionId) return <NoSessionScreen />;

  return (
    <div className="page-container max-w-md mx-auto py-4 md:py-8">
      {/* 차량 컨텍스트 배너 */}
      {vehicleSlug && step !== "done" && (
        <div className="mb-4 rounded-[16px] border border-primary/15 bg-primary/[0.05] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/60">신청 차량</p>
              <p className="truncate text-[14px] font-semibold text-primary">
                {formatVehicleSlug(vehicleSlug)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary">
              {CUSTOMER_TYPE_LABELS[customerType]}
            </span>
          </div>
        </div>
      )}

      {/* 스텝 인디케이터 */}
      {step !== "done" && (
        <div className="mb-5">
          <VerifyStepIndicator currentStep={step} />
        </div>
      )}

      <div className="public-mobile-section p-4 md:p-5">
        {/* 스텝 콘텐츠 */}
        {step === 1 && (
          <Step1Consent
            consents={consents}
            onChange={toggleConsent}
            onNext={() => setStep(presetCustomerType ? 3 : 2)}
          />
        )}

        {step === 2 && (
          <Step2CustomerType
            value={customerType}
            onChange={setCustomerType}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <Step3Form
            form={form}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            onBack={() => setStep(presetCustomerType ? 1 : 2)}
            loading={loading}
            error={error}
          />
        )}

        {step === "easyauth" && verificationId && (
          <EasyAuthStep
            verificationId={verificationId}
            customerType={customerType}
            info={{
              userName: form.name,
              birthDate: rrnToBirthDate(form.rrnFront + form.rrnBack),
              phoneNo: form.phone,
            }}
            onDone={handleEasyAuthDone}
            onBack={() => setStep(3)}
          />
        )}

        {step === "done" && <DoneScreen />}
      </div>

      {/* 진행 텍스트 */}
      {step !== "done" && (
        <p className="text-center text-[12px] text-public-muted mt-4">
          {`${stepToNum(step)} / ${VERIFY_STEPS.length} 단계`} · 입력 정보는 암호화되어 전송됩니다
        </p>
      )}
    </div>
  );
}
