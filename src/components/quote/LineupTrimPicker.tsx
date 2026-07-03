"use client";

import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LineupChoice {
  readonly name: string;
  readonly trimCount: number;
}

export interface TrimChoice {
  readonly id: string;
  readonly name: string;
  readonly extra: string | null;
  readonly price: number;
  readonly discountPrice: number | null;
}

interface LineupTrimPickerProps {
  readonly hasCascade: boolean;
  readonly lineups: readonly LineupChoice[];
  readonly selectedLineup: string | null;
  readonly onLineupChange: (lineup: string | null) => void;
  readonly trims: readonly TrimChoice[];
  readonly selectedTrimId: string | null;
  readonly onTrimChange: (trimId: string | null) => void;
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string;
  readonly helper: string;
  readonly placeholder: string;
  readonly value: string | null;
  readonly options: readonly SelectOption[];
  readonly disabled: boolean;
  readonly onChange: (value: string | null) => void;
}

const EMPTY_SELECT_VALUE = "";

function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

function trimOptionLabel(trim: TrimChoice) {
  const extra = trim.extra ? ` (${trim.extra})` : "";
  const price = trim.discountPrice ? `${fmtMan(trim.discountPrice)} (할인)` : fmtMan(trim.price);
  return `${trim.name}${extra} · ${price}`;
}

function StepBadge({
  step,
  label,
  state,
}: {
  readonly step: number;
  readonly label: string;
  readonly state: "done" | "current" | "pending";
}) {
  const isActive = state !== "pending";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold transition-colors duration-state",
          state === "done"
            ? "bg-brand text-surface"
            : state === "current"
              ? "bg-brand-soft text-brand ring-1 ring-brand/20"
              : "bg-surface-soft text-text-muted ring-1 ring-border-subtle"
        )}
      >
        {state === "done" ? <Check size={13} strokeWidth={3} /> : step}
      </span>
      <span
        className={cn(
          "truncate text-[12px] font-extrabold",
          isActive ? "text-text-strong" : "text-text-muted"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SelectField({
  id,
  label,
  ariaLabel,
  helper,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: SelectFieldProps) {
  const helperId = `${id}-helper`;

  return (
    <div>
      <label htmlFor={id} className="public-quiet-label">
        {label}
      </label>
      <p id={helperId} className="mt-1 text-[12px] leading-relaxed text-public-muted">
        {helper}
      </p>
      <div className="relative mt-2">
        <select
          id={id}
          aria-label={ariaLabel}
          aria-describedby={helperId}
          value={value ?? EMPTY_SELECT_VALUE}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            onChange(nextValue === EMPTY_SELECT_VALUE ? null : nextValue);
          }}
          className={cn(
            "min-h-[48px] w-full appearance-none rounded-[16px] border bg-surface px-4 py-3 pr-11 text-[14px] font-bold text-text-strong shadow-card transition-colors duration-state focus:border-brand focus:outline-none focus:ring-4 focus:ring-focus-ring/20",
            disabled
              ? "cursor-not-allowed border-border-subtle bg-surface-soft text-text-muted"
              : "cursor-pointer border-border-strong hover:border-brand/40"
          )}
        >
          <option value={EMPTY_SELECT_VALUE} disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className={cn(
            "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2",
            disabled ? "text-text-muted" : "text-brand"
          )}
        />
      </div>
    </div>
  );
}

export function LineupTrimPicker({
  hasCascade,
  lineups,
  selectedLineup,
  onLineupChange,
  trims,
  selectedTrimId,
  onTrimChange,
}: LineupTrimPickerProps) {
  const canChooseTrim = !hasCascade || selectedLineup !== null;
  const lineupDone = !hasCascade || selectedLineup !== null;
  const selectedTrim = trims.find((trim) => trim.id === selectedTrimId) ?? null;
  const trimDone = selectedTrim !== null;
  const lineupOptions = lineups.map((lineup) => ({
    value: lineup.name,
    label: `${lineup.name} · ${lineup.trimCount}개 트림`,
  }));
  const trimOptions = trims.map((trim) => ({
    value: trim.id,
    label: trimOptionLabel(trim),
  }));
  const trimDisabled = !canChooseTrim || trims.length === 0;
  const trimPlaceholder = !canChooseTrim
    ? "라인업을 먼저 선택하세요"
    : trims.length === 0
      ? "선택 가능한 트림이 없습니다"
      : "트림을 선택하세요";

  return (
    <section className="rounded-[20px] border border-border-subtle bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-ink">라인업과 트림을 선택하세요</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-public-muted">
            라인업을 먼저 고른 뒤 해당 라인업의 세부 트림을 선택합니다.
          </p>
        </div>
        {(selectedLineup || selectedTrim) && (
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-extrabold text-brand">
            {selectedTrim ? "선택 완료" : "라인업 선택됨"}
          </span>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-surface-soft px-3 py-2.5">
        <StepBadge
          step={1}
          label={hasCascade ? "라인업" : "차량 트림"}
          state={lineupDone ? "done" : "current"}
        />
        <ChevronRight size={14} className="shrink-0 text-text-muted" />
        <StepBadge
          step={2}
          label="트림"
          state={trimDone ? "done" : canChooseTrim ? "current" : "pending"}
        />
      </div>

      <div className="space-y-4">
        {hasCascade && (
          <SelectField
            id="lineup-trim-picker-lineup"
            label="1. 라인업 선택"
            ariaLabel="라인업 선택"
            helper="연식, 엔진, 인승 기준을 먼저 선택하세요."
            placeholder="라인업을 선택하세요"
            value={selectedLineup}
            options={lineupOptions}
            disabled={lineupOptions.length === 0}
            onChange={(lineup) => {
              onLineupChange(lineup);
              if (lineup !== selectedLineup) onTrimChange(null);
            }}
          />
        )}

        <SelectField
          id="lineup-trim-picker-trim"
          label={hasCascade ? "2. 트림 선택" : "트림 선택"}
          ariaLabel="트림 선택"
          helper={
            canChooseTrim
              ? "선택한 라인업에 포함된 세부 트림과 기준 가격입니다."
              : "라인업을 선택하면 해당 트림 목록이 활성화됩니다."
          }
          placeholder={trimPlaceholder}
          value={selectedTrim?.id ?? null}
          options={trimOptions}
          disabled={trimDisabled}
          onChange={onTrimChange}
        />
      </div>
    </section>
  );
}
