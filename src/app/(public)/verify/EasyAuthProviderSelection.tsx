"use client";

import {
  type LucideIcon,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { DOC_TYPES, type DocType } from "@/lib/codef/doc-types";

const PROVIDERS = [
  { level: "1", label: "카카오", icon: MessageCircle },
  { level: "5", label: "통신사 PASS", icon: Smartphone },
  { level: "6", label: "네이버", icon: CircleDot },
  { level: "8", label: "토스", icon: BadgeCheck },
] as const satisfies readonly { readonly level: string; readonly label: string; readonly icon: LucideIcon }[];

const TELECOMS = [
  { value: "0", label: "SKT" },
  { value: "1", label: "KT" },
  { value: "2", label: "LG U+" },
] as const;

interface EasyAuthProviderSelectionProps {
  readonly docTypes: readonly DocType[];
  readonly provider: string;
  readonly telecom: string;
  readonly onProviderChange: (provider: string) => void;
  readonly onTelecomChange: (telecom: string) => void;
  readonly onBack: () => void;
  readonly onBegin: () => void;
}

export function EasyAuthProviderSelection({
  docTypes,
  provider,
  telecom,
  onProviderChange,
  onTelecomChange,
  onBack,
  onBegin,
}: EasyAuthProviderSelectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[18px] font-semibold text-ink">간편인증으로 서류를 받습니다</p>
        <p className="text-[12px] leading-relaxed text-public-muted">
          아래 {docTypes.length}개 서류를 공공기관에서 직접 발급받습니다. 사용할 간편인증을 선택하세요.
        </p>
      </div>

      <div className="rounded-[14px] border border-public-border bg-surface-soft p-3">
        <p className="public-quiet-label mb-2">받을 서류</p>
        <div className="space-y-1.5">
          {docTypes.map((docType) => (
            <div key={docType} className="flex items-center gap-2 text-[13px] text-ink">
              <CheckCircle2 size={14} className="text-primary/50" />
              {DOC_TYPES[docType].label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="public-quiet-label mb-2">간편인증 수단</p>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((item) => (
            <ProviderButton
              key={item.level}
              provider={item}
              selected={provider === item.level}
              onSelect={onProviderChange}
            />
          ))}
        </div>
      </div>

      {provider === "5" && (
        <div>
          <p className="public-quiet-label mb-2">통신사</p>
          <div className="grid grid-cols-3 gap-2">
            {TELECOMS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onTelecomChange(item.value)}
                className={cn(
                  "rounded-[12px] border py-2.5 text-[13px] font-medium transition-all",
                  telecom === item.value
                    ? "border-primary bg-primary/[0.06] text-primary"
                    : "border-public-border bg-white text-ink-label"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onBack}
          className="min-h-[48px] shrink-0 rounded-[12px] border-public-border bg-white px-4 text-ink-label"
        >
          <ChevronLeft size={16} />
          이전
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          onClick={onBegin}
          className="min-h-[48px] rounded-[12px] font-semibold"
        >
          간편인증 시작
        </Button>
      </div>
    </div>
  );
}

function ProviderButton({
  provider,
  selected,
  onSelect,
}: {
  readonly provider: (typeof PROVIDERS)[number];
  readonly selected: boolean;
  readonly onSelect: (level: string) => void;
}) {
  const Icon = provider.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(provider.level)}
      className={cn(
        "flex items-center gap-2 rounded-[12px] border p-3 text-left transition-all active:scale-[0.99]",
        selected ? "border-primary bg-primary/[0.06]" : "border-public-border bg-white hover:border-primary/30"
      )}
    >
      <Icon size={18} className={selected ? "text-primary" : "text-public-muted"} />
      <span className="text-[13px] font-medium text-ink">{provider.label}</span>
    </button>
  );
}
