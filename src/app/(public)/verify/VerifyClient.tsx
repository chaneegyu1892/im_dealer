"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Shield, FileText, Building2, HeartPulse, CheckCircle2, Loader2 } from "lucide-react";
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
import { validateBizNumber } from "@/lib/validators/korean";

// ─── 타입 ────────────────────────────────────────────────
type Step = 1 | 2 | 3 | "done";

interface FormState {
  name: string;
  birthDate: string;
  licenseNo: string;
  bizNo: string;
}

// ─── 3단계 커스텀 StepIndicator ───────────────────────────
const VERIFY_STEPS = [
  { id: 1 as const, label: "동의" },
  { id: 2 as const, label: "유형" },
  { id: 3 as const, label: "정보입력" },
];

function VerifyStepIndicator({ currentStep }: { currentStep: Step }) {
  const activeNum = currentStep === "done" ? 4 : currentStep;
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="public-quiet-label">심사 진행</span>
        <span className="text-[12px] font-semibold text-primary">
          {currentStep === "done" ? "완료" : `${currentStep} / ${VERIFY_STEPS.length}`}
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
                step.id <= activeNum ? "bg-primary" : "bg-[#DDE1EC]"
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                  "text-[11px] font-semibold transition-all duration-300",
                  isDone && "bg-primary text-white",
                  isActive && "bg-primary text-white",
                  !isDone && !isActive && "bg-[#E8EBF3] text-public-muted"
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
      title: "운전면허 진위확인",
      desc: "도로교통공단을 통해 면허 유효 여부를 확인합니다.",
    },
    {
      icon: <HeartPulse size={18} className="text-primary" />,
      title: "건강보험 자격득실 확인",
      desc: "국민건강보험공단을 통해 직장인·개인사업자 가입 이력을 확인합니다.",
    },
    {
      icon: <Building2 size={18} className="text-primary" />,
      title: "사업자등록 상태조회",
      desc: "국세청을 통해 사업자 등록 상태를 확인합니다.",
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
              <div className="mt-0.5 w-7 h-7 rounded-full bg-white border border-[#F0F0F0] flex items-center justify-center flex-shrink-0 shadow-sm">
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
              sub: "이름, 생년월일, 운전면허번호 등을 서류 확인 목적으로 수집합니다.",
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
                  consents[key] ? "border-primary bg-primary" : "border-[#D0D0D0] bg-white"
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
  icon: string;
  label: string;
  desc: string;
}[] = [
  { type: "individual", icon: "👔", label: "개인", desc: "운전면허와 건강보험 자격 확인" },
  { type: "self_employed", icon: "💼", label: "개인사업자", desc: "건강보험 지역 가입자 + 사업자등록" },
  { type: "corporate", icon: "🏢", label: "법인", desc: "법인 사업자등록 조회" },
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
            icon={opt.icon}
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
  customerType: CustomerType;
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
  customerType,
  form,
  onChange,
  onSubmit,
  onBack,
  loading,
  error,
}: Step3Props) {
  const needsBiz =
    customerType === "self_employed" ||
    customerType === "corporate" ||
    false;

  const isValid =
    form.name.trim() !== "" &&
    form.birthDate.trim().length === 8 &&
    form.licenseNo.trim() !== "" &&
    (!needsBiz || form.bizNo.trim() !== "");

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
        <InputField
          label="생년월일"
          id="birthDate"
          value={form.birthDate}
          onChange={(v) => onChange("birthDate", v)}
          placeholder="19900101"
          hint="YYYYMMDD 형식으로 입력하세요"
        />
        <InputField
          label="운전면허번호"
          id="licenseNo"
          type="password"
          value={form.licenseNo}
          onChange={(v) => onChange("licenseNo", v)}
          placeholder="운전면허번호 입력"
          hint="보안을 위해 마스킹 처리됩니다"
        />
        {needsBiz && (
          <InputField
            label="사업자등록번호"
            id="bizNo"
            type="password"
            value={form.bizNo}
            onChange={(v) => onChange("bizNo", v)}
            placeholder="사업자등록번호 10자리"
            hint="'-' 없이 숫자만 입력하세요"
          />
        )}
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
              확인 중...
            </span>
          ) : (
            "서류 확인 요청"
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

// ─── 메인 클라이언트 컴포넌트 ─────────────────────────────
function formatVehicleSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const vehicleSlug = searchParams.get("vehicle");
  const customerTypeParam = searchParams.get("customerType");
  const presetCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;

  const [step, setStep] = useState<Step>(1);
  const [consents, setConsents] = useState({ privacy: false, codef: false });
  const [customerType, setCustomerType] = useState<CustomerType>(
    presetCustomerType ?? "individual"
  );
  const [form, setForm] = useState<FormState>({
    name: "",
    birthDate: "",
    licenseNo: "",
    bizNo: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sessionId 없으면 홈으로 redirect
  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
    }
  }, [sessionId, router]);

  const toggleConsent = (key: "privacy" | "codef") => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFormChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!sessionId) return;

    // 사업자등록번호 체크섬 검증 — 잘못된 번호로 Codef 호출 시 비용 낭비.
    const needsBiz =
      customerType === "self_employed" ||
      customerType === "corporate" ||
      false;
    if (needsBiz && !validateBizNumber(form.bizNo)) {
      setError("사업자등록번호가 올바르지 않습니다. 10자리 숫자를 다시 확인해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. 동의 저장
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
        const data = await consentRes.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "동의 저장에 실패했습니다.");
      }

      const { data: consentData } = await consentRes.json() as {
        data: { verificationId: string };
      };

      // 2. Codef 서류 조회
      const fetchRes = await fetch("/api/verification/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: consentData.verificationId,
          connectedId: sessionId, // sessionId를 connectedId 대용으로 사용 (실제 연동 시 교체)
          name: form.name,
          birthDate: form.birthDate,
          licenseNo: form.licenseNo,
          bizNo: form.bizNo || undefined,
        }),
      });

      if (!fetchRes.ok) {
        const data = await fetchRes.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "서류 조회에 실패했습니다.");
      }

      // 3. 저장된 견적 초안이 있으면 DB에 저장
      const draftKey = `${QUOTE_DRAFT_STORAGE_PREFIX}${sessionId}`;
      const legacyKey = `${LEGACY_QUOTE_STORAGE_PREFIX}${sessionId}`;
      const draftQuote = parseQuoteDraft(localStorage.getItem(draftKey), sessionId);
      const legacyQuote = draftQuote
        ? null
        : parseLegacyQuoteDraft(sessionStorage.getItem(legacyKey), sessionId);
      const quoteDraft = draftQuote ?? legacyQuote;

      if (quoteDraft) {
        // 시나리오 중 표준형을 기본으로 저장한다. 없으면 보수형을 사용한다.
        const scenario = quoteDraft.scenarios.standard ?? quoteDraft.scenarios.conservative;

        const saveRes = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            vehicleId: quoteDraft.vehicleSlug,
            trimId: quoteDraft.trimId,
            contractMonths: quoteDraft.contractMonths,
            annualMileage: quoteDraft.annualMileage,
            depositRate: scenario?.depositAmount ? 20 : 0, // 대략적인 값
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
            phone: "연락처 미입력", // 폰 번호 입력 필드가 없으므로 일단 고정
          }),
        });

        if (!saveRes.ok) {
          const data = await saveRes.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? "견적 저장에 실패했습니다.");
        }

        localStorage.removeItem(draftKey);
        sessionStorage.removeItem(legacyKey);
      }

      setStep("done");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "요청 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) return null;

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
            customerType={customerType}
            form={form}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            onBack={() => setStep(presetCustomerType ? 1 : 2)}
            loading={loading}
            error={error}
          />
        )}

        {step === "done" && <DoneScreen />}
      </div>

      {/* 진행 텍스트 */}
      {step !== "done" && (
        <p className="text-center text-[12px] text-public-muted mt-4">
          {typeof step === "number" ? `${step} / 3 단계` : ""} · 입력 정보는 암호화되어 전송됩니다
        </p>
      )}
    </div>
  );
}
